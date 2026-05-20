package api

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"edge-gateway/can"
	"edge-gateway/models"
)

type CANController struct {
	replay *can.CANReplay
	ecuSim  *ECUSimulator
}

type ECUSimulator struct {
	msgChan  chan *models.CANMessage
	stopChan chan struct{}
	running  bool
}

func NewCANController() *CANController {
	return &CANController{
		replay: can.NewCANReplay(),
		ecuSim: &ECUSimulator{
			msgChan:  make(chan *models.CANMessage, 1000),
			stopChan: make(chan struct{}),
		},
	}
}

func (c *CANController) RegisterRoutes(router *gin.RouterGroup) {
	canGroup := router.Group("/can")
	{
		canGroup.POST("/load", c.LoadLogFile)
		canGroup.POST("/start", c.StartReplay)
		canGroup.POST("/pause", c.PauseReplay)
		canGroup.POST("/resume", c.ResumeReplay)
		canGroup.POST("/stop", c.StopReplay)
		canGroup.GET("/status", c.GetStatus)
		canGroup.GET("/progress", c.GetProgress)
		canGroup.GET("/messages", c.GetMessages)
		canGroup.POST("/generate-sample", c.GenerateSample)
	}
}

type LoadLogRequest struct {
	Filename string `json:"filename" binding:"required"`
}

func (c *CANController) LoadLogFile(ctx *gin.Context) {
	var req LoadLogRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := c.replay.LoadLogFile(req.Filename); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Log file loaded successfully",
	})
}

type StartReplayRequest struct {
	SpeedFactor  float64  `json:"speed_factor" default:"1.0"`
	LoopCount    int      `json:"loop_count" default:"1"`
	StartOffsetMs int64   `json:"start_offset_ms" default:"0"`
	EndOffsetMs   int64   `json:"end_offset_ms" default:"0"`
	FilterIDs    []uint32 `json:"filter_ids"`
	BusFilter    []uint8  `json:"bus_filter"`
}

func (c *CANController) StartReplay(ctx *gin.Context) {
	var req StartReplayRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	config := &models.ReplayConfig{
		SpeedFactor:  req.SpeedFactor,
		LoopCount:    req.LoopCount,
		StartOffsetMs: req.StartOffsetMs,
		EndOffsetMs:   req.EndOffsetMs,
		FilterIDs:    req.FilterIDs,
		BusFilter:    req.BusFilter,
	}

	c.replay.SetMessageCallback(func(msg *models.CANMessage) error {
		select {
		case c.ecuSim.msgChan <- msg:
		default:
		}
		return nil
	})

	if err := c.replay.Start(config); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	go c.ecuSim.run()

	ctx.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "CAN replay started",
		"config":  config,
	})
}

func (c *CANController) PauseReplay(ctx *gin.Context) {
	if err := c.replay.Pause(); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"status": "success", "message": "Replay paused"})
}

func (c *CANController) ResumeReplay(ctx *gin.Context) {
	if err := c.replay.Resume(); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"status": "success", "message": "Replay resumed"})
}

func (c *CANController) StopReplay(ctx *gin.Context) {
	if err := c.replay.Stop(); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.ecuSim.stop()
	ctx.JSON(http.StatusOK, gin.H{"status": "success", "message": "Replay stopped"})
}

func (c *CANController) GetStatus(ctx *gin.Context) {
	ctx.JSON(http.StatusOK, gin.H{
		"status": c.replay.GetStatus(),
	})
}

func (c *CANController) GetProgress(ctx *gin.Context) {
	ctx.JSON(http.StatusOK, c.replay.GetProgress())
}

func (c *CANController) GetMessages(ctx *gin.Context) {
	count := 100
	messages := make([]*models.CANMessage, 0, count)

	timeout := time.After(100 * time.Millisecond)
	for i := 0; i < count; i++ {
		select {
		case msg := <-c.replay.GetMessageChannel():
			messages = append(messages, msg)
		case <-timeout:
			break
		}
	}

	ctx.JSON(http.StatusOK, gin.H{
		"count":    len(messages),
		"messages": messages,
	})
}

type GenerateSampleRequest struct {
	Filename   string `json:"filename" default:"sample_can_log.json"`
	NumMessages int   `json:"num_messages" default:"1000"`
	IntervalMs  int   `json:"interval_ms" default:"10"`
}

func (c *CANController) GenerateSample(ctx *gin.Context) {
	var req GenerateSampleRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Filename == "" {
		req.Filename = "sample_can_log.json"
	}
	if req.NumMessages <= 0 {
		req.NumMessages = 1000
	}
	if req.IntervalMs <= 0 {
		req.IntervalMs = 10
	}

	if err := can.GenerateSampleLogFile(req.Filename, req.NumMessages, req.IntervalMs); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Sample log file generated",
		"filename": req.Filename,
		"num_messages": req.NumMessages,
		"interval_ms": req.IntervalMs,
	})
}

func (e *ECUSimulator) run() {
	e.running = true
	for {
		select {
		case <-e.stopChan:
			e.running = false
			return
		case <-e.msgChan:
		}
	}
}

func (e *ECUSimulator) stop() {
	select {
	case <-e.stopChan:
	default:
		close(e.stopChan)
		e.stopChan = make(chan struct{})
	}
}

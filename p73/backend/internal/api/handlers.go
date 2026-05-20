package api

import (
	"encoding/csv"
	"fermentation-monitor/internal/database"
	"fermentation-monitor/internal/models"
	"fermentation-monitor/internal/sensor"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var (
	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}
	clients   = make(map[*websocket.Conn]bool)
	broadcast = make(chan []byte)
	mu        sync.Mutex
)

func GetFermenters(c *gin.Context) {
	fermenters, err := database.GetFermenters()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, fermenters)
}

func GetSettings(c *gin.Context) {
	settings, err := database.GetSettings()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, settings)
}

func UpdateSettings(c *gin.Context) {
	var settings models.Settings
	if err := c.ShouldBindJSON(&settings); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	settings.ID = 1
	if err := database.UpdateSettings(&settings); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, settings)
}

func GetCurrentData(c *gin.Context) {
	fermenterIDStr := c.Param("id")
	fermenterID, err := strconv.ParseUint(fermenterIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid fermenter ID"})
		return
	}

	data, err := database.GetLatestSensorData(uint(fermenterID))
	if err != nil {
		simulator := sensor.GetOrCreateSimulator(uint(fermenterID))
		data = simulator.ReadData(uint(fermenterID))
	}
	c.JSON(http.StatusOK, data)
}

func GetHistoryData(c *gin.Context) {
	fermenterIDStr := c.Param("id")
	fermenterID, err := strconv.ParseUint(fermenterIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid fermenter ID"})
		return
	}

	hoursStr := c.DefaultQuery("hours", "24")
	hours, err := strconv.Atoi(hoursStr)
	if err != nil {
		hours = 24
	}

	data, err := database.GetHistorySensorData(uint(fermenterID), hours)
	if err != nil || len(data) == 0 {
		simulator := sensor.GetOrCreateSimulator(uint(fermenterID))
		data = make([]models.SensorData, hours*12)
		for i := range data {
			d := simulator.ReadData(uint(fermenterID))
			data[i] = *d
			data[i].Timestamp = time.Now().Add(-time.Duration(hours*60-i*5) * time.Minute)
		}
	}
	c.JSON(http.StatusOK, data)
}

func GetAlerts(c *gin.Context) {
	limitStr := c.DefaultQuery("limit", "50")
	limit, err := strconv.Atoi(limitStr)
	if err != nil {
		limit = 50
	}

	alerts, err := database.GetAlerts(limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, alerts)
}

func GetAnalysis(c *gin.Context) {
	fermenterIDStr := c.Param("id")
	fermenterID, err := strconv.ParseUint(fermenterIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid fermenter ID"})
		return
	}

	settings, _ := database.GetSettings()
	history, _ := database.GetHistorySensorData(uint(fermenterID), 24)
	analysis := sensor.AnalyzeData(history, settings, uint(fermenterID))
	c.JSON(http.StatusOK, analysis)
}

func HandleWebSocket(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	mu.Lock()
	clients[conn] = true
	mu.Unlock()

	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			mu.Lock()
			delete(clients, conn)
			mu.Unlock()
			break
		}
	}
}

func GetAdjustmentRecords(c *gin.Context) {
	fermenterIDStr := c.Query("fermenterId")
	limitStr := c.DefaultQuery("limit", "20")

	fermenterID, _ := strconv.ParseUint(fermenterIDStr, 10, 32)
	limit, _ := strconv.Atoi(limitStr)

	records, err := database.GetRecentAdjustments(uint(fermenterID), limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, records)
}

func GetFaultDiagnosis(c *gin.Context) {
	fermenterIDStr := c.Query("fermenterId")
	fermenterID, _ := strconv.ParseUint(fermenterIDStr, 10, 32)

	faults, err := database.GetActiveFaults(uint(fermenterID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, faults)
}

func ResolveFault(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid fault ID"})
		return
	}

	if err := database.ResolveFault(uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "故障已解决"})
}

func ExportReport(c *gin.Context) {
	var req models.ExportReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	startTime, _ := time.Parse(time.RFC3339, req.StartTime)
	endTime, _ := time.Parse(time.RFC3339, req.EndTime)

	if startTime.IsZero() {
		startTime = time.Now().Add(-24 * time.Hour)
	}
	if endTime.IsZero() {
		endTime = time.Now()
	}

	data, err := database.GetSensorDataByTimeRange(req.FermenterID, startTime, endTime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	switch strings.ToLower(req.Format) {
	case "csv":
		exportCSV(c, data, req.FermenterID)
	case "json":
		exportJSON(c, data, req.FermenterID)
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "不支持的格式，请使用csv或json"})
	}
}

func exportCSV(c *gin.Context, data []models.SensorData, fermenterID uint) {
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=fermentation_report_%d_%s.csv", fermenterID, time.Now().Format("20060102_150405")))

	writer := csv.NewWriter(c.Writer)
	defer writer.Flush()

	header := []string{"时间", "发酵罐ID", "温度(°C)", "湿度(%)", "微生物浓度(CFU/mL)", "状态"}
	writer.Write(header)

	for _, d := range data {
		row := []string{
			d.Timestamp.Format("2006-01-02 15:04:05"),
			fmt.Sprintf("%d", d.FermenterID),
			fmt.Sprintf("%.2f", d.Temperature),
			fmt.Sprintf("%.2f", d.Humidity),
			fmt.Sprintf("%.0f", d.MicrobeConcentration),
			d.Status,
		}
		writer.Write(row)
	}
}

func exportJSON(c *gin.Context, data []models.SensorData, fermenterID uint) {
	c.Header("Content-Type", "application/json")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=fermentation_report_%d_%s.json", fermenterID, time.Now().Format("20060102_150405")))

	type ReportData struct {
		FermenterID uint             `json:"fermenterId"`
		GeneratedAt string           `json:"generatedAt"`
		RecordCount int              `json:"recordCount"`
		Data        []models.SensorData `json:"data"`
	}

	report := ReportData{
		FermenterID: fermenterID,
		GeneratedAt: time.Now().Format("2006-01-02 15:04:05"),
		RecordCount: len(data),
		Data:        data,
	}

	c.JSON(http.StatusOK, report)
}

func BroadcastData() {
	for {
		time.Sleep(5 * time.Second)

		fermenters, err := database.GetFermenters()
		if err != nil {
			continue
		}

		for _, f := range fermenters {
			if f.Status == "running" {
				simulator := sensor.GetOrCreateSimulator(f.ID)
				data := simulator.ReadData(f.ID)
				settings, _ := database.GetSettings()
				alerts := simulator.CheckThresholds(data, settings)

				database.SaveSensorData(data)
				for _, alert := range alerts {
					database.CreateAlert(alert)
				}
			}
		}
	}
}

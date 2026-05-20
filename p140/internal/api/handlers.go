package api

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"path/filepath"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gabriel-vasile/mimetype"
	"github.com/google/uuid"
	"github.com/video-transcoder/internal/database"
	"github.com/video-transcoder/internal/models"
	"github.com/video-transcoder/internal/storage"
)

type Handler struct {
	minioClient *storage.MinIOClient
}

func NewHandler(minioClient *storage.MinIOClient) *Handler {
	return &Handler{
		minioClient: minioClient,
	}
}

type WatermarkRequest struct {
	Enabled   bool   `form:"watermark_enabled"`
	ImageURL  string `form:"watermark_image_url"`
	Text      string `form:"watermark_text"`
	Position  string `form:"watermark_position"`
	Opacity   string `form:"watermark_opacity"`
	Scale     string `form:"watermark_scale"`
	PaddingX  string `form:"watermark_padding_x"`
	PaddingY  string `form:"watermark_padding_y"`
	FontSize  string `form:"watermark_font_size"`
	FontColor string `form:"watermark_font_color"`
}

type CropRequest struct {
	Enabled bool   `form:"crop_enabled"`
	X       string `form:"crop_x"`
	Y       string `form:"crop_y"`
	Width   string `form:"crop_width"`
	Height  string `form:"crop_height"`
}

type BitrateRequest struct {
	Mode        string `form:"bitrate_mode"`
	Target      string `form:"target_bitrate"`
	Max         string `form:"max_bitrate"`
	Min         string `form:"min_bitrate"`
}

type HLSRequest struct {
	Enabled        bool   `form:"hls_enabled"`
	SegmentDuration string `form:"hls_segment_duration"`
	PlaylistType   string `form:"hls_playlist_type"`
	Encrypted      bool   `form:"hls_encrypted"`
}

type DASHRequest struct {
	Enabled        bool   `form:"dash_enabled"`
	SegmentDuration string `form:"dash_segment_duration"`
	AdaptationSets bool   `form:"dash_adaptation_sets"`
}

type UploadRequest struct {
	Codec        models.CodecType    `form:"codec" binding:"required,oneof=h264 h265 av1"`
	OutputFormat models.OutputFormat `form:"output_format" binding:"required,oneof=mp4 hls dash"`
	Watermark    WatermarkRequest
	Crop         CropRequest
	Bitrate      BitrateRequest
	HLS          HLSRequest
	DASH         DASHRequest
}

type TaskResponse struct {
	ID        uuid.UUID       `json:"id"`
	Filename  string          `json:"filename"`
	Codec     models.CodecType `json:"codec"`
	Status    models.TaskStatus `json:"status"`
	Progress  int             `json:"progress"`
	Duration  float64         `json:"duration,omitempty"`
	CreatedAt time.Time       `json:"created_at"`
}

func parseWatermarkConfig(req WatermarkRequest) models.WatermarkConfig {
	opacity := 0.8
	if val, err := strconv.ParseFloat(req.Opacity, 64); err == nil {
		opacity = val
	}
	scale := 0.5
	if val, err := strconv.ParseFloat(req.Scale, 64); err == nil {
		scale = val
	}
	paddingX := 20
	if val, err := strconv.Atoi(req.PaddingX); err == nil {
		paddingX = val
	}
	paddingY := 20
	if val, err := strconv.Atoi(req.PaddingY); err == nil {
		paddingY = val
	}
	fontSize := 48
	if val, err := strconv.Atoi(req.FontSize); err == nil {
		fontSize = val
	}
	fontColor := req.FontColor
	if fontColor == "" {
		fontColor = "white"
	}
	position := models.WatermarkPosition(req.Position)
	if position == "" {
		position = models.WatermarkBottomRight
	}
	return models.WatermarkConfig{
		Enabled:   req.Enabled,
		ImageURL:  req.ImageURL,
		Text:      req.Text,
		Position:  position,
		Opacity:   opacity,
		Scale:     scale,
		PaddingX:  paddingX,
		PaddingY:  paddingY,
		FontSize:  fontSize,
		FontColor: fontColor,
	}
}

func parseCropConfig(req CropRequest) models.CropConfig {
	x, _ := strconv.Atoi(req.X)
	y, _ := strconv.Atoi(req.Y)
	width, _ := strconv.Atoi(req.Width)
	height, _ := strconv.Atoi(req.Height)
	return models.CropConfig{
		Enabled: req.Enabled,
		X:       x,
		Y:       y,
		Width:   width,
		Height:  height,
	}
}

func parseBitrateConfig(req BitrateRequest) models.BitrateConfig {
	mode := models.BitrateMode(req.Mode)
	if mode == "" {
		mode = models.BitrateModeSmart
	}
	return models.BitrateConfig{
		Mode:         mode,
		TargetBitrate: req.Target,
		MaxBitrate:   req.Max,
		MinBitrate:   req.Min,
	}
}

func parseHLSConfig(req HLSRequest) models.HLSConfig {
	segmentDuration, _ := strconv.Atoi(req.SegmentDuration)
	if segmentDuration == 0 {
		segmentDuration = 10
	}
	return models.HLSConfig{
		Enabled:         req.Enabled,
		SegmentDuration: segmentDuration,
		PlaylistType:    req.PlaylistType,
		Encrypted:       req.Encrypted,
	}
}

func parseDASHConfig(req DASHRequest) models.DASHConfig {
	segmentDuration, _ := strconv.Atoi(req.SegmentDuration)
	if segmentDuration == 0 {
		segmentDuration = 10
	}
	return models.DASHConfig{
		Enabled:         req.Enabled,
		SegmentDuration: segmentDuration,
		AdaptationSets:  req.AdaptationSets,
	}
}

func (h *Handler) UploadVideo(c *gin.Context) {
	var req UploadRequest
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	file, header, err := c.Request.FormFile("video")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No video file provided"})
		return
	}
	defer file.Close()

	buf := make([]byte, 512)
	if _, err := file.Read(buf); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read file"})
		return
	}
	file.Seek(0, 0)

	mime := mimetype.Detect(buf)
	if !mime.Is("video/*") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File is not a video"})
		return
	}

	taskID := uuid.New()
	ext := filepath.Ext(header.Filename)
	objectName := taskID.String() + ext

	taskConfig := models.TaskConfig{
		Watermark: parseWatermarkConfig(req.Watermark),
		Crop:      parseCropConfig(req.Crop),
		Bitrate:   parseBitrateConfig(req.Bitrate),
		HLS:       parseHLSConfig(req.HLS),
		DASH:      parseDASHConfig(req.DASH),
	}

	configJSON, _ := json.Marshal(taskConfig)

	task := &models.Task{
		ID:            taskID,
		Filename:      header.Filename,
		Codec:         req.Codec,
		OutputFormat:  req.OutputFormat,
		Status:        models.StatusUploading,
		FileSize:      header.Size,
		ConfigJSON:    string(configJSON),
	}

	if err := database.DB.Create(task).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create task"})
		return
	}

	contentType := mime.String()
	if err := h.minioClient.UploadInput(c.Request.Context(), objectName, file, header.Size, contentType); err != nil {
		database.DB.Model(task).Update("status", models.StatusFailed)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to upload video"})
		return
	}

	presignedURL, err := h.minioClient.GetInputPresignedURL(c.Request.Context(), objectName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate URL"})
		return
	}

	database.DB.Model(task).Updates(map[string]interface{}{
		"status":      models.StatusUploaded,
		"original_url": presignedURL,
	})

	c.JSON(http.StatusCreated, gin.H{
		"task_id": taskID,
		"message": "Video uploaded successfully",
	})
}

func (h *Handler) GetTask(c *gin.Context) {
	taskID := c.Param("id")
	id, err := uuid.Parse(taskID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
		return
	}

	var task models.Task
	if err := database.DB.First(&task, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	if task.Status == models.StatusCompleted && task.OutputURL != "" {
		presignedURL, err := h.minioClient.GetOutputPresignedURL(c.Request.Context(), task.OutputURL)
		if err == nil {
			task.OutputURL = presignedURL
		}
	}

	c.JSON(http.StatusOK, task)
}

func (h *Handler) ListTasks(c *gin.Context) {
	var tasks []models.Task
	if err := database.DB.Order("created_at DESC").Find(&tasks).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch tasks"})
		return
	}

	c.JSON(http.StatusOK, tasks)
}

func (h *Handler) DownloadOutput(c *gin.Context) {
	taskID := c.Param("id")
	id, err := uuid.Parse(taskID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
		return
	}

	var task models.Task
	if err := database.DB.First(&task, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	if task.Status != models.StatusCompleted {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Task not completed"})
		return
	}

	obj, err := h.minioClient.GetOutput(c.Request.Context(), task.OutputURL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get output file"})
		return
	}
	defer obj.Close()

	stat, err := obj.Stat()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get file info"})
		return
	}

	c.Header("Content-Disposition", "attachment; filename="+task.Filename)
	c.Header("Content-Type", "video/mp4")
	c.Header("Content-Length", string(rune(stat.Size)))

	io.Copy(c.Writer, obj)
}

func (h *Handler) StartTranscoding(c *gin.Context) {
	taskID := c.Param("id")
	id, err := uuid.Parse(taskID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
		return
	}

	var task models.Task
	if err := database.DB.First(&task, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	if task.Status != models.StatusUploaded {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Task not ready for transcoding"})
		return
	}

	task.Status = models.StatusSplitting
	database.DB.Save(&task)

	c.JSON(http.StatusOK, gin.H{
		"message": "Transcoding started",
		"task_id": taskID,
	})
}

func (h *Handler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "healthy",
		"time":   time.Now().UTC(),
	})
}

func (h *Handler) DeleteTask(c *gin.Context) {
	taskID := c.Param("id")
	id, err := uuid.Parse(taskID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
		return
	}

	var task models.Task
	if err := database.DB.First(&task, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	ctx := context.Background()

	ext := filepath.Ext(task.Filename)
	inputObjectName := task.ID.String() + ext
	h.minioClient.DeleteInput(ctx, inputObjectName)

	if task.OutputURL != "" {
		h.minioClient.DeleteOutput(ctx, task.OutputURL)
	}

	var segments []models.Segment
	database.DB.Where("task_id = ?", id).Find(&segments)
	for _, seg := range segments {
		if seg.InputPath != "" {
			h.minioClient.DeleteSegment(ctx, seg.InputPath)
		}
		if seg.OutputPath != "" {
			h.minioClient.DeleteSegment(ctx, seg.OutputPath)
		}
	}

	database.DB.Where("task_id = ?", id).Delete(&models.Segment{})
	database.DB.Delete(&task)

	c.JSON(http.StatusOK, gin.H{"message": "Task deleted successfully"})
}

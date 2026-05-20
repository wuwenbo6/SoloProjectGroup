package api

import (
	"net/http"
	"papermonitor/internal/models"
	"papermonitor/internal/sensor"
	"papermonitor/internal/ws"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

func GetSensorData(c *gin.Context) {
	processType := c.Query("process_type")
	limitStr := c.DefaultQuery("limit", "50")
	limit, _ := strconv.Atoi(limitStr)

	var data []models.SensorData
	var err error

	if processType != "" {
		data, err = sensor.GetRecentSensorData(models.ProcessType(processType), limit)
	} else {
		var soakingData, beatingData, papermakingData []models.SensorData
		soakingData, _ = sensor.GetRecentSensorData(models.ProcessSoaking, limit/3)
		beatingData, _ = sensor.GetRecentSensorData(models.ProcessBeating, limit/3)
		papermakingData, _ = sensor.GetRecentSensorData(models.ProcessPaperMaking, limit/3)
		data = append(append(soakingData, beatingData...), papermakingData...)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}

func GetAlerts(c *gin.Context) {
	limitStr := c.DefaultQuery("limit", "20")
	limit, _ := strconv.Atoi(limitStr)

	alerts, err := sensor.GetActiveAlerts(limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"alerts": alerts})
}

func AcknowledgeAlert(c *gin.Context) {
	id := c.Param("id")
	alertID, err := strconv.ParseUint(id, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid alert ID"})
		return
	}

	now := time.Now()
	result := sensor.DB.Model(&models.Alert{}).
		Where("id = ?", alertID).
		Updates(map[string]interface{}{
			"acknowledged":    true,
			"acknowledged_at": now,
		})

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Alert acknowledged"})
}

func GetProcessConfigs(c *gin.Context) {
	configs, err := sensor.GetProcessConfigs()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"configs": configs})
}

func UpdateProcessConfig(c *gin.Context) {
	processType := c.Param("process_type")
	var cfg models.ProcessConfig
	if err := c.ShouldBindJSON(&cfg); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := sensor.UpdateProcessConfig(models.ProcessType(processType), &cfg)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Config updated successfully"})
}

func GetHistoricalData(c *gin.Context) {
	processType := c.Query("process_type")
	startStr := c.Query("start")
	endStr := c.Query("end")

	start, err := time.Parse(time.RFC3339, startStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid start time"})
		return
	}

	end, err := time.Parse(time.RFC3339, endStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid end time"})
		return
	}

	var data []models.SensorData
	query := sensor.DB.Where("timestamp BETWEEN ? AND ?", start, end)

	if processType != "" {
		query = query.Where("process_type = ?", processType)
	}

	query.Order("timestamp asc").Find(&data)

	c.JSON(http.StatusOK, gin.H{"data": data})
}

func WebSocketHandler(c *gin.Context) {
	ws.HandleWebSocket(c.Writer, c.Request)
}

func DownloadReport(c *gin.Context) {
	processType := c.Query("process_type")
	startStr := c.Query("start")
	endStr := c.Query("end")
	format := c.DefaultQuery("format", "csv")

	start, err := time.Parse(time.RFC3339, startStr)
	if err != nil {
		start = time.Now().Add(-24 * time.Hour)
	}
	end, err := time.Parse(time.RFC3339, endStr)
	if err != nil {
		end = time.Now()
	}

	req := sensor.ReportRequest{
		ProcessType: models.ProcessType(processType),
		StartTime:   start,
		EndTime:     end,
		Format:      format,
	}

	data, filename, err := sensor.GenerateReport(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	contentType := "text/csv"
	if format == "json" {
		contentType = "application/json"
	}

	c.Header("Content-Type", contentType+"; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename="+filename)
	c.Writer.Write(data)
}

func GetDiagnostics(c *gin.Context) {
	results, err := sensor.GetLatestDiagnostics()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"diagnostics": results})
}

func GetDiagnosticHistory(c *gin.Context) {
	deviceID := c.Query("device_id")
	limitStr := c.DefaultQuery("limit", "10")
	limit, _ := strconv.Atoi(limitStr)

	results, err := sensor.GetDiagnosticHistory(deviceID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"history": results})
}

func GetAutoAdjustStatus(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"enabled": sensor.IsAutoAdjustEnabled(),
	})
}

func SetAutoAdjustStatus(c *gin.Context) {
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	sensor.SetAutoAdjustEnabled(req.Enabled)
	c.JSON(http.StatusOK, gin.H{
		"enabled": sensor.IsAutoAdjustEnabled(),
		"message": "Auto-adjust status updated",
	})
}

func GetAdjustmentHistory(c *gin.Context) {
	processType := c.Query("process_type")
	limitStr := c.DefaultQuery("limit", "20")
	limit, _ := strconv.Atoi(limitStr)

	records, err := sensor.GetAdjustmentHistory(models.ProcessType(processType), limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"adjustments": records})
}

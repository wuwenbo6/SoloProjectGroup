package controllers

import (
	"ceramic-api/database"
	"ceramic-api/models"
	"context"
	"fmt"
	"math"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

var (
	alertThresholdCache = make(map[string][]models.AlertThreshold)
	alertCacheMutex    sync.RWMutex
	lastCacheRefresh   time.Time
)

const cacheDuration = 5 * time.Minute

func refreshAlertThresholds() {
	alertCacheMutex.Lock()
	defer alertCacheMutex.Unlock()

	if time.Since(lastCacheRefresh) < cacheDuration {
		return
	}

	var thresholds []models.AlertThreshold
	database.FiringDB.Where("enabled = ?", true).Find(&thresholds)

	thresholdMap := make(map[string][]models.AlertThreshold)
	for _, t := range thresholds {
		key := t.ParamType + ":" + t.KilnID
		thresholdMap[key] = append(thresholdMap[key], t)
	}

	alertThresholdCache = thresholdMap
	lastCacheRefresh = time.Now()
}

func CheckForAlerts(param *models.FiringParam) []models.AlertRecord {
	refreshAlertThresholds()

	alertCacheMutex.RLock()
	defer alertCacheMutex.RUnlock()

	var alerts []models.AlertRecord

	keys := []string{
		param.ParamType + ":" + param.KilnID,
		param.ParamType + ":",
	}

	for _, key := range keys {
		if thresholds, ok := alertThresholdCache[key]; ok {
			for _, t := range thresholds {
				if param.ParamValue < t.MinValue || param.ParamValue > t.MaxValue {
					alertType := "HIGH"
					if param.ParamValue < t.MinValue {
						alertType = "LOW"
					}

					deviation := 0.0
					if t.MaxValue > t.MinValue {
						expected := (t.MinValue + t.MaxValue) / 2
						deviation = math.Abs(param.ParamValue - expected) / ((t.MaxValue - t.MinValue) / 2) * 100
					}

					alert := models.AlertRecord{
						BatchID:      param.BatchID,
						KilnID:       param.KilnID,
						ParamType:    param.ParamType,
						ParamValue:   param.ParamValue,
						ThresholdMin: t.MinValue,
						ThresholdMax: t.MaxValue,
						AlertLevel:   t.AlertLevel,
						AlertType:    alertType,
						Message: fmt.Sprintf("%s 参数异常: %.2f (范围: %.2f~%.2f), 偏离度: %.1f%%",
							param.ParamType, param.ParamValue, t.MinValue, t.MaxValue, deviation),
						Handled:     false,
						CollectedAt: param.CollectedAt,
						CreatedAt:   time.Now(),
					}
					alerts = append(alerts, alert)
				}
			}
		}
	}

	return alerts
}

func CreateAlertThreshold(c *gin.Context) {
	var req struct {
		ParamType  string  `json:"param_type" binding:"required"`
		KilnID     string  `json:"kiln_id"`
		MinValue   float64 `json:"min_value" binding:"required"`
		MaxValue   float64 `json:"max_value" binding:"required"`
		AlertLevel int     `json:"alert_level" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	threshold := models.AlertThreshold{
		ParamType:  req.ParamType,
		KilnID:     req.KilnID,
		MinValue:   req.MinValue,
		MaxValue:   req.MaxValue,
		AlertLevel: req.AlertLevel,
		Enabled:    true,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	if result := database.FiringDB.Create(&threshold); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create threshold"})
		return
	}

	lastCacheRefresh = time.Time{}
	c.JSON(http.StatusCreated, gin.H{"message": "Threshold created successfully", "data": threshold})
}

func UpdateAlertThreshold(c *gin.Context) {
	id := c.Param("id")

	var threshold models.AlertThreshold
	if result := database.FiringDB.First(&threshold, id); result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Threshold not found"})
		return
	}

	var req struct {
		MinValue   *float64 `json:"min_value"`
		MaxValue   *float64 `json:"max_value"`
		AlertLevel *int     `json:"alert_level"`
		Enabled    *bool    `json:"enabled"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.MinValue != nil {
		threshold.MinValue = *req.MinValue
	}
	if req.MaxValue != nil {
		threshold.MaxValue = *req.MaxValue
	}
	if req.AlertLevel != nil {
		threshold.AlertLevel = *req.AlertLevel
	}
	if req.Enabled != nil {
		threshold.Enabled = *req.Enabled
	}
	threshold.UpdatedAt = time.Now()

	database.FiringDB.Save(&threshold)
	lastCacheRefresh = time.Time{}

	c.JSON(http.StatusOK, gin.H{"message": "Threshold updated successfully", "data": threshold})
}

func GetAlertThresholds(c *gin.Context) {
	paramType := c.Query("param_type")
	kilnID := c.Query("kiln_id")

	query := database.FiringDB.Model(&models.AlertThreshold{})

	if paramType != "" {
		query = query.Where("param_type = ?", paramType)
	}
	if kilnID != "" {
		query = query.Where("kiln_id = ?", kilnID)
	}

	var thresholds []models.AlertThreshold
	query.Order("param_type, kiln_id").Find(&thresholds)

	c.JSON(http.StatusOK, gin.H{"data": thresholds, "count": len(thresholds)})
}

func DeleteAlertThreshold(c *gin.Context) {
	id := c.Param("id")

	if result := database.FiringDB.Delete(&models.AlertThreshold{}, id); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete threshold"})
		return
	}

	lastCacheRefresh = time.Time{}
	c.JSON(http.StatusOK, gin.H{"message": "Threshold deleted successfully"})
}

func GetAlerts(c *gin.Context) {
	batchID := c.Query("batch_id")
	kilnID := c.Query("kiln_id")
	handled := c.Query("handled")
	alertLevel := c.Query("alert_level")
	startTime := c.Query("start_time")
	endTime := c.Query("end_time")
	limit := c.DefaultQuery("limit", "100")

	query := database.FiringDB.Model(&models.AlertRecord{})

	if batchID != "" {
		query = query.Where("batch_id = ?", batchID)
	}
	if kilnID != "" {
		query = query.Where("kiln_id = ?", kilnID)
	}
	if handled != "" {
		query = query.Where("handled = ?", handled == "true")
	}
	if alertLevel != "" {
		query = query.Where("alert_level = ?", alertLevel)
	}
	if startTime != "" {
		query = query.Where("created_at >= ?", startTime)
	}
	if endTime != "" {
		query = query.Where("created_at <= ?", endTime)
	}

	var alerts []models.AlertRecord
	query.Order("created_at DESC").Limit(limit).Find(&alerts)

	c.JSON(http.StatusOK, gin.H{"data": alerts, "count": len(alerts)})
}

func HandleAlert(c *gin.Context) {
	id := c.Param("id")

	var alert models.AlertRecord
	if result := database.FiringDB.First(&alert, id); result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Alert not found"})
		return
	}

	var req struct {
		HandledBy string `json:"handled_by" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	now := time.Now()
	alert.Handled = true
	alert.HandledBy = req.HandledBy
	alert.HandledAt = &now

	database.FiringDB.Save(&alert)
	c.JSON(http.StatusOK, gin.H{"message": "Alert handled successfully", "data": alert})
}

func GetAlertStats(c *gin.Context) {
	batchID := c.Query("batch_id")
	kilnID := c.Query("kiln_id")

	baseQuery := database.FiringDB.Model(&models.AlertRecord{})
	if batchID != "" {
		baseQuery = baseQuery.Where("batch_id = ?", batchID)
	}
	if kilnID != "" {
		baseQuery = baseQuery.Where("kiln_id = ?", kilnID)
	}

	var totalCount int64
	baseQuery.Count(&totalCount)

	var unhandledCount int64
	baseQuery.Where("handled = ?", false).Count(&unhandledCount)

	var levelStats []struct {
		AlertLevel int   `json:"alert_level"`
		Count      int64 `json:"count"`
	}
	baseQuery.Select("alert_level, COUNT(*) as count").Group("alert_level").Scan(&levelStats)

	var typeStats []struct {
		ParamType string `json:"param_type"`
		Count     int64  `json:"count"`
	}
	baseQuery.Select("param_type, COUNT(*) as count").Group("param_type").Scan(&typeStats)

	c.JSON(http.StatusOK, gin.H{
		"total":         totalCount,
		"unhandled":     unhandledCount,
		"by_level":      levelStats,
		"by_param_type": typeStats,
	})
}

func BatchCheckAlerts(c *gin.Context) {
	var req struct {
		BatchID string   `json:"batch_id" binding:"required"`
		Params  []string `json:"params"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	var params []models.FiringParam
	query := database.FiringDB.WithContext(ctx).Where("batch_id = ?", req.BatchID)
	if len(req.Params) > 0 {
		query = query.Where("param_type IN ?", req.Params)
	}
	query.Order("collected_at DESC").Find(&params)

	var allAlerts []models.AlertRecord
	for _, param := range params {
		alerts := CheckForAlerts(&param)
		for _, alert := range alerts {
			allAlerts = append(allAlerts, alert)
		}
	}

	if len(allAlerts) > 0 {
		database.FiringDB.Create(&allAlerts)
	}

	c.JSON(http.StatusOK, gin.H{
		"checked_count":   len(params),
		"alert_count":     len(allAlerts),
		"alerts":          allAlerts,
	})
}

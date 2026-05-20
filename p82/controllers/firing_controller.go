package controllers

import (
	"ceramic-api/database"
	"ceramic-api/models"
	"context"
	"errors"
	"math"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	MaxBatchSize     = 1000
	MaxRetryAttempts = 3
	CollectTimeout   = 5 * time.Second
)

var (
	firingBuffer = make([]models.FiringParam, 0, MaxBatchSize)
	bufferMutex  sync.Mutex
	flushTicker  *time.Ticker
	flushOnce    sync.Once
)

type FiringParamRequest struct {
	BatchID    string  `json:"batch_id" binding:"required"`
	KilnID     string  `json:"kiln_id" binding:"required"`
	ParamType  string  `json:"param_type" binding:"required"`
	ParamValue float64 `json:"param_value" binding:"required"`
	ParamUnit  string  `json:"param_unit"`
}

func InitFiringBuffer() {
	flushOnce.Do(func() {
		flushTicker = time.NewTicker(1 * time.Second)
		go func() {
			for range flushTicker.C {
				flushBuffer()
			}
		}()
	})
}

func flushBuffer() {
	bufferMutex.Lock()
	if len(firingBuffer) == 0 {
		bufferMutex.Unlock()
		return
	}

	batch := make([]models.FiringParam, len(firingBuffer))
	copy(batch, firingBuffer)
	firingBuffer = firingBuffer[:0]
	bufferMutex.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	database.WithRetry(ctx, func() error {
		return database.FiringDB.CreateInBatches(batch, 500).Error
	}, MaxRetryAttempts)
}

func validateFiringParam(req *FiringParamRequest) error {
	if strings.TrimSpace(req.BatchID) == "" {
		return errors.New("batch_id is required")
	}
	if strings.TrimSpace(req.KilnID) == "" {
		return errors.New("kiln_id is required")
	}
	if strings.TrimSpace(req.ParamType) == "" {
		return errors.New("param_type is required")
	}
	if math.IsNaN(req.ParamValue) || math.IsInf(req.ParamValue, 0) {
		return errors.New("invalid param_value")
	}
	return nil
}

func CollectFiringParam(c *gin.Context) {
	var req FiringParamRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format: " + err.Error()})
		return
	}

	if err := validateFiringParam(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	param := models.FiringParam{
		BatchID:     strings.TrimSpace(req.BatchID),
		KilnID:      strings.TrimSpace(req.KilnID),
		ParamType:   strings.TrimSpace(req.ParamType),
		ParamValue:  math.Round(req.ParamValue*1000) / 1000,
		ParamUnit:   strings.TrimSpace(req.ParamUnit),
		CollectedAt: time.Now(),
		CreatedAt:   time.Now(),
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), CollectTimeout)
	defer cancel()

	var createdParam models.FiringParam
	err := database.WithRetry(ctx, func() error {
		result := database.FiringDB.WithContext(ctx).Create(&param)
		if result.Error != nil {
			return result.Error
		}
		createdParam = param
		return nil
	}, MaxRetryAttempts)

	if err != nil {
		bufferMutex.Lock()
		firingBuffer = append(firingBuffer, param)
		bufferMutex.Unlock()
		c.JSON(http.StatusAccepted, gin.H{
			"message": "Data queued for retry",
			"data":    param,
		})
		return
	}

	alerts := CheckForAlerts(&createdParam)
	if len(alerts) > 0 {
		database.FiringDB.Create(&alerts)
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":       "Firing parameter collected successfully",
		"data":          createdParam,
		"alert_count":   len(alerts),
		"alerts":        alerts,
	})
}

func BatchCollectFiringParams(c *gin.Context) {
	var params []FiringParamRequest
	if err := c.ShouldBindJSON(&params); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format: " + err.Error()})
		return
	}

	if len(params) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Empty batch"})
		return
	}

	if len(params) > MaxBatchSize {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":      "Batch too large",
			"max_size":   MaxBatchSize,
			"given_size": len(params),
		})
		return
	}

	now := time.Now()
	var validParams []models.FiringParam
	var failedCount int

	for _, p := range params {
		if err := validateFiringParam(&p); err == nil {
			validParams = append(validParams, models.FiringParam{
				BatchID:     strings.TrimSpace(p.BatchID),
				KilnID:      strings.TrimSpace(p.KilnID),
				ParamType:   strings.TrimSpace(p.ParamType),
				ParamValue:  math.Round(p.ParamValue*1000) / 1000,
				ParamUnit:   strings.TrimSpace(p.ParamUnit),
				CollectedAt: now,
				CreatedAt:   now,
			})
		} else {
			failedCount++
		}
	}

	if len(validParams) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No valid parameters in batch"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	var insertedCount int64
	err := database.WithRetry(ctx, func() error {
		tx := database.FiringDB.WithContext(ctx).Begin()
		if tx.Error != nil {
			return tx.Error
		}

		batchSize := 500
		for i := 0; i < len(validParams); i += batchSize {
			end := i + batchSize
			if end > len(validParams) {
				end = len(validParams)
			}
			if result := tx.Create(validParams[i:end]); result.Error != nil {
				tx.Rollback()
				return result.Error
			}
			insertedCount += result.RowsAffected
		}

		return tx.Commit().Error
	}, MaxRetryAttempts)

	if err != nil {
		bufferMutex.Lock()
		firingBuffer = append(firingBuffer, validParams...)
		bufferMutex.Unlock()
		c.JSON(http.StatusAccepted, gin.H{
			"message":      "Batch queued for retry",
			"queued_count": len(validParams),
			"failed_count": failedCount,
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":      "Batch collection successful",
		"inserted":     insertedCount,
		"failed_count": failedCount,
	})
}

func GetFiringParams(c *gin.Context) {
	batchID := c.Query("batch_id")
	paramType := c.Query("param_type")
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	query := database.FiringDB.Model(&models.FiringParam{})

	if batchID != "" {
		query = query.Where("batch_id = ?", batchID)
	}
	if paramType != "" {
		query = query.Where("param_type = ?", paramType)
	}
	if startDate != "" {
		query = query.Where("collected_at >= ?", startDate)
	}
	if endDate != "" {
		query = query.Where("collected_at <= ?", endDate)
	}

	var params []models.FiringParam
	query.Order("collected_at DESC").Find(&params)

	c.JSON(http.StatusOK, gin.H{
		"data":  params,
		"count": len(params),
	})
}

func GetFiringParamByID(c *gin.Context) {
	id := c.Param("id")

	var param models.FiringParam
	if result := database.FiringDB.First(&param, id); result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Parameter not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": param})
}

func GetFiringParamStats(c *gin.Context) {
	batchID := c.Query("batch_id")
	if batchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "batch_id is required"})
		return
	}

	var stats []struct {
		ParamType string  `json:"param_type"`
		AvgValue  float64 `json:"avg_value"`
		MaxValue  float64 `json:"max_value"`
		MinValue  float64 `json:"min_value"`
		Count     int     `json:"count"`
	}

	database.FiringDB.Model(&models.FiringParam{}).
		Select("param_type, ROUND(AVG(param_value), 6) as avg_value, ROUND(MAX(param_value), 6) as max_value, ROUND(MIN(param_value), 6) as min_value, COUNT(*) as count").
		Where("batch_id = ?", batchID).
		Group("param_type").
		Scan(&stats)

	c.JSON(http.StatusOK, gin.H{"data": stats})
}

package controllers

import (
	"ceramic-api/database"
	"ceramic-api/models"
	"context"
	"math"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	KilnSyncBatchSize  = 2000
	KilnSyncInterval   = 500 * time.Millisecond
	KilnCollectTimeout = 10 * time.Second
	MaxKilnBatchSize   = 5000
)

var (
	kilnSyncQueue    = make(chan models.KilnTempRecord, 10000)
	kilnSyncOnce     sync.Once
	kilnSyncRunning  bool
	kilnSyncMutex    sync.Mutex
)

type KilnTempRequest struct {
	BatchID     string  `json:"batch_id" binding:"required"`
	KilnID      string  `json:"kiln_id" binding:"required"`
	Temperature float64 `json:"temperature" binding:"required"`
	Zone        string  `json:"zone"`
}

func InitKilnSyncWorker() {
	kilnSyncOnce.Do(func() {
		kilnSyncMutex.Lock()
		kilnSyncRunning = true
		kilnSyncMutex.Unlock()

		go syncWorker()
		go periodicSyncWorker()
	})
}

func syncWorker() {
	ticker := time.NewTicker(KilnSyncInterval)
	defer ticker.Stop()

	var batch []models.KilnTempRecord

	for {
		select {
		case record, ok := <-kilnSyncQueue:
			if !ok {
				if len(batch) > 0 {
					processSyncBatch(batch)
				}
				return
			}
			batch = append(batch, record)
			if len(batch) >= KilnSyncBatchSize {
				processSyncBatch(batch)
				batch = batch[:0]
			}
		case <-ticker.C:
			if len(batch) > 0 {
				processSyncBatch(batch)
				batch = batch[:0]
			}
		}
	}
}

func periodicSyncWorker() {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		SyncPendingRecords()
	}
}

func processSyncBatch(records []models.KilnTempRecord) {
	if len(records) == 0 {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	database.WithRetry(ctx, func() error {
		tx := database.KilnTempDB.Begin()
		if tx.Error != nil {
			return tx.Error
		}

		batchSize := 500
		for i := 0; i < len(records); i += batchSize {
			end := i + batchSize
			if end > len(records) {
				end = len(records)
			}
			if result := tx.Create(records[i:end]); result.Error != nil {
				tx.Rollback()
				return result.Error
			}
		}

		return tx.Commit().Error
	}, MaxRetryAttempts)
}

func validateKilnTemp(req *KilnTempRequest) error {
	if strings.TrimSpace(req.BatchID) == "" {
		return nil
	}
	if strings.TrimSpace(req.KilnID) == "" {
		return nil
	}
	if math.IsNaN(req.Temperature) || math.IsInf(req.Temperature, 0) {
		return nil
	}
	return nil
}

func CollectKilnTemp(c *gin.Context) {
	var req KilnTempRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format: " + err.Error()})
		return
	}

	if err := validateKilnTemp(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	record := models.KilnTempRecord{
		BatchID:     strings.TrimSpace(req.BatchID),
		KilnID:      strings.TrimSpace(req.KilnID),
		Temperature: math.Round(req.Temperature*1000) / 1000,
		Zone:        strings.TrimSpace(req.Zone),
		MeasuredAt:  time.Now(),
		SyncStatus:  0,
		CreatedAt:   time.Now(),
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), KilnCollectTimeout)
	defer cancel()

	err := database.WithRetry(ctx, func() error {
		result := database.KilnTempDB.WithContext(ctx).Create(&record)
		return result.Error
	}, MaxRetryAttempts)

	if err != nil {
		select {
		case kilnSyncQueue <- record:
			c.JSON(http.StatusAccepted, gin.H{"message": "Data queued for sync", "data": record})
		default:
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Queue full, try again later"})
		}
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Temperature record collected successfully",
		"data":    record,
	})
}

func BatchCollectKilnTemp(c *gin.Context) {
	var records []KilnTempRequest
	if err := c.ShouldBindJSON(&records); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format: " + err.Error()})
		return
	}

	if len(records) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Empty batch"})
		return
	}

	if len(records) > MaxKilnBatchSize {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":      "Batch too large",
			"max_size":   MaxKilnBatchSize,
			"given_size": len(records),
		})
		return
	}

	now := time.Now()
	var validRecords []models.KilnTempRecord
	var failedCount int

	for _, r := range records {
		if err := validateKilnTemp(&r); err == nil {
			validRecords = append(validRecords, models.KilnTempRecord{
				BatchID:     strings.TrimSpace(r.BatchID),
				KilnID:      strings.TrimSpace(r.KilnID),
				Temperature: math.Round(r.Temperature*1000) / 1000,
				Zone:        strings.TrimSpace(r.Zone),
				MeasuredAt:  now,
				SyncStatus:  0,
				CreatedAt:   now,
			})
		} else {
			failedCount++
		}
	}

	if len(validRecords) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No valid records in batch"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	var insertedCount int64
	err := database.WithRetry(ctx, func() error {
		tx := database.KilnTempDB.WithContext(ctx).Begin()
		if tx.Error != nil {
			return tx.Error
		}

		batchSize := 500
		for i := 0; i < len(validRecords); i += batchSize {
			end := i + batchSize
			if end > len(validRecords) {
				end = len(validRecords)
			}
			if result := tx.Create(validRecords[i:end]); result.Error != nil {
				tx.Rollback()
				return result.Error
			}
			insertedCount += result.RowsAffected
		}

		return tx.Commit().Error
	}, MaxRetryAttempts)

	if err != nil {
		for _, r := range validRecords {
			select {
			case kilnSyncQueue <- r:
			default:
			}
		}
		c.JSON(http.StatusAccepted, gin.H{
			"message":      "Batch queued for retry",
			"queued_count": len(validRecords),
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

func SyncPendingRecords() error {
	var unsyncedRecords []models.KilnTempRecord
	database.KilnTempDB.Where("sync_status = ?", 0).Limit(5000).Find(&unsyncedRecords)

	if len(unsyncedRecords) == 0 {
		return nil
	}

	now := time.Now()
	ids := make([]uint, len(unsyncedRecords))
	for i, r := range unsyncedRecords {
		ids[i] = r.ID
	}

	return database.WithRetry(context.Background(), func() error {
		return database.KilnTempDB.Model(&models.KilnTempRecord{}).
			Where("id IN ?", ids).
			Updates(map[string]interface{}{
				"sync_status": 1,
				"synced_at":   now,
			}).Error
	}, MaxRetryAttempts)
}

func SyncKilnTemp(c *gin.Context) {
	var unsyncedRecords []models.KilnTempRecord
	database.KilnTempDB.Where("sync_status = ?", 0).Limit(10000).Find(&unsyncedRecords)

	if len(unsyncedRecords) == 0 {
		c.JSON(http.StatusOK, gin.H{"message": "No records to sync", "synced_count": 0})
		return
	}

	now := time.Now()
	ids := make([]uint, len(unsyncedRecords))
	for i, r := range unsyncedRecords {
		ids[i] = r.ID
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	var syncedCount int64
	err := database.WithRetry(ctx, func() error {
		result := database.KilnTempDB.WithContext(ctx).Model(&models.KilnTempRecord{}).
			Where("id IN ?", ids).
			Updates(map[string]interface{}{
				"sync_status": 1,
				"synced_at":   now,
			})
		syncedCount = result.RowsAffected
		return result.Error
	}, MaxRetryAttempts)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Sync failed: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "Temperature records synced successfully",
		"synced_count": syncedCount,
	})
}

func GetKilnTempRecords(c *gin.Context) {
	batchID := c.Query("batch_id")
	kilnID := c.Query("kiln_id")
	zone := c.Query("zone")
	syncStatus := c.Query("sync_status")
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	limit := c.DefaultQuery("limit", "1000")

	query := database.KilnTempDB.Model(&models.KilnTempRecord{})

	if batchID != "" {
		query = query.Where("batch_id = ?", batchID)
	}
	if kilnID != "" {
		query = query.Where("kiln_id = ?", kilnID)
	}
	if zone != "" {
		query = query.Where("zone = ?", zone)
	}
	if syncStatus != "" {
		query = query.Where("sync_status = ?", syncStatus)
	}
	if startDate != "" {
		query = query.Where("measured_at >= ?", startDate)
	}
	if endDate != "" {
		query = query.Where("measured_at <= ?", endDate)
	}

	var records []models.KilnTempRecord
	query.Order("measured_at DESC").Limit(limit).Find(&records)

	c.JSON(http.StatusOK, gin.H{
		"data":  records,
		"count": len(records),
	})
}

func GetKilnTempStats(c *gin.Context) {
	batchID := c.Query("batch_id")
	kilnID := c.Query("kiln_id")

	if batchID == "" && kilnID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "batch_id or kiln_id is required"})
		return
	}

	var stats []struct {
		Zone       string  `json:"zone"`
		AvgTemp    float64 `json:"avg_temp"`
		MaxTemp    float64 `json:"max_temp"`
		MinTemp    float64 `json:"min_temp"`
		RecordCount int    `json:"record_count"`
	}

	query := database.KilnTempDB.Model(&models.KilnTempRecord{})
	if batchID != "" {
		query = query.Where("batch_id = ?", batchID)
	}
	if kilnID != "" {
		query = query.Where("kiln_id = ?", kilnID)
	}

	query.Select("zone, ROUND(AVG(temperature), 6) as avg_temp, ROUND(MAX(temperature), 6) as max_temp, ROUND(MIN(temperature), 6) as min_temp, COUNT(*) as record_count").
		Group("zone").
		Scan(&stats)

	c.JSON(http.StatusOK, gin.H{"data": stats})
}

func GetUnsyncedCount(c *gin.Context) {
	var totalCount int64
	database.KilnTempDB.Model(&models.KilnTempRecord{}).Where("sync_status = ?", 0).Count(&totalCount)

	var byKiln []struct {
		KilnID       string `json:"kiln_id"`
		UnsyncedCount int64 `json:"unsynced_count"`
	}
	database.KilnTempDB.Model(&models.KilnTempRecord{}).
		Select("kiln_id, COUNT(*) as unsynced_count").
		Where("sync_status = ?", 0).
		Group("kiln_id").
		Scan(&byKiln)

	c.JSON(http.StatusOK, gin.H{
		"total_unsynced": totalCount,
		"by_kiln":        byKiln,
	})
}

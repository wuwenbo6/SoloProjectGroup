package controllers

import (
	"ceramic-api/database"
	"ceramic-api/models"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type CreateBatchRequest struct {
	BatchID     string `json:"batch_id" binding:"required"`
	ProductName string `json:"product_name" binding:"required"`
	ProductType string `json:"product_type"`
	Quantity    int    `json:"quantity"`
}

type UpdateBatchStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

func CreateBatch(c *gin.Context) {
	var req CreateBatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var existingBatch models.Batch
	if result := database.FiringDB.Where("batch_id = ?", req.BatchID).First(&existingBatch); result.Error == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Batch ID already exists"})
		return
	}

	batch := models.Batch{
		BatchID:     req.BatchID,
		ProductName: req.ProductName,
		ProductType: req.ProductType,
		Quantity:    req.Quantity,
		Status:      "created",
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if result := database.FiringDB.Create(&batch); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create batch"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Batch created successfully",
		"data":    batch,
	})
}

func GetBatches(c *gin.Context) {
	status := c.Query("status")
	productType := c.Query("product_type")
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	query := database.FiringDB.Model(&models.Batch{})

	if status != "" {
		query = query.Where("status = ?", status)
	}
	if productType != "" {
		query = query.Where("product_type = ?", productType)
	}
	if startDate != "" {
		query = query.Where("created_at >= ?", startDate)
	}
	if endDate != "" {
		query = query.Where("created_at <= ?", endDate)
	}

	var batches []models.Batch
	query.Order("created_at DESC").Find(&batches)

	c.JSON(http.StatusOK, gin.H{
		"data":  batches,
		"count": len(batches),
	})
}

func GetBatchByID(c *gin.Context) {
	batchID := c.Param("batch_id")

	var batch models.Batch
	if result := database.FiringDB.Where("batch_id = ?", batchID).First(&batch); result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Batch not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": batch})
}

func UpdateBatchStatus(c *gin.Context) {
	batchID := c.Param("batch_id")
	var req UpdateBatchStatusRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var batch models.Batch
	if result := database.FiringDB.Where("batch_id = ?", batchID).First(&batch); result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Batch not found"})
		return
	}

	now := time.Now()
	batch.Status = req.Status
	batch.UpdatedAt = now

	if req.Status == "in_progress" && batch.StartTime == nil {
		batch.StartTime = &now
	}
	if req.Status == "completed" && batch.EndTime == nil {
		batch.EndTime = &now
	}

	database.FiringDB.Save(&batch)

	c.JSON(http.StatusOK, gin.H{
		"message": "Batch status updated successfully",
		"data":    batch,
	})
}

func UpdateBatchQuality(c *gin.Context) {
	batchID := c.Param("batch_id")
	var req struct {
		QualityResult string `json:"quality_result" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result := database.FiringDB.Model(&models.Batch{}).
		Where("batch_id = ?", batchID).
		Updates(map[string]interface{}{
			"quality_result": req.QualityResult,
			"updated_at":     time.Now(),
		})

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update quality result"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Quality result updated successfully"})
}

func GetBatchStats(c *gin.Context) {
	var stats []struct {
		Status string `json:"status"`
		Count  int    `json:"count"`
	}

	database.FiringDB.Model(&models.Batch{}).
		Select("status, COUNT(*) as count").
		Group("status").
		Scan(&stats)

	var totalQuantity int64
	database.FiringDB.Model(&models.Batch{}).Select("COALESCE(SUM(quantity), 0)").Scan(&totalQuantity)

	c.JSON(http.StatusOK, gin.H{
		"status_breakdown": stats,
		"total_quantity":   totalQuantity,
	})
}

func DeleteBatch(c *gin.Context) {
	batchID := c.Param("batch_id")

	result := database.FiringDB.Where("batch_id = ?", batchID).Delete(&models.Batch{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete batch"})
		return
	}

	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Batch not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Batch deleted successfully"})
}

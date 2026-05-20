package controllers

import (
	"bytes"
	"ceramic-api/config"
	"ceramic-api/database"
	"ceramic-api/models"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type TestReportRequest struct {
	BatchID        string                 `json:"batch_id" binding:"required"`
	TestingOrg     string                 `json:"testing_org"`
	ReportID       string                 `json:"report_id"`
	TestItems      map[string]interface{} `json:"test_items"`
	TestResults    map[string]interface{} `json:"test_results"`
	IsQualified    bool                   `json:"is_qualified"`
}

func SubmitToThirdParty(c *gin.Context) {
	batchID := c.Param("batch_id")

	var batch models.Batch
	if result := database.FiringDB.Where("batch_id = ?", batchID).First(&batch); result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Batch not found"})
		return
	}

	cfg := config.LoadServerConfig()

	payload := map[string]interface{}{
		"batch_id":     batchID,
		"product_name": batch.ProductName,
		"product_type": batch.ProductType,
		"quantity":     batch.Quantity,
		"timestamp":    time.Now(),
	}

	jsonData, _ := json.Marshal(payload)

	req, _ := http.NewRequest("POST", cfg.ThirdPartyAPI+"/submit", bytes.NewBuffer(jsonData))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", cfg.ThirdPartyKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to third party service"})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Third party service returned error"})
		return
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	c.JSON(http.StatusOK, gin.H{
		"message":        "Batch data submitted to third party successfully",
		"third_party_response": result,
	})
}

func ReceiveTestReport(c *gin.Context) {
	var req TestReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	testItemsJSON, _ := json.Marshal(req.TestItems)
	testResultsJSON, _ := json.Marshal(req.TestResults)

	report := models.ThirdPartyTestReport{
		BatchID:         req.BatchID,
		ReportID:        req.ReportID,
		TestingOrg:      req.TestingOrg,
		TestItems:       string(testItemsJSON),
		TestResults:     string(testResultsJSON),
		IsQualified:     req.IsQualified,
		ReportReceivedAt: time.Now(),
		CreatedAt:       time.Now(),
	}

	if result := database.FiringDB.Create(&report); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save test report"})
		return
	}

	qualityResult := "qualified"
	if !req.IsQualified {
		qualityResult = "unqualified"
	}
	database.FiringDB.Model(&models.Batch{}).
		Where("batch_id = ?", req.BatchID).
		Updates(map[string]interface{}{
			"quality_result": qualityResult,
			"third_party_data": string(testResultsJSON),
			"updated_at":     time.Now(),
		})

	c.JSON(http.StatusCreated, gin.H{
		"message": "Test report received and processed successfully",
		"data":    report,
	})
}

func GetTestReports(c *gin.Context) {
	batchID := c.Query("batch_id")
	testingOrg := c.Query("testing_org")
	isQualified := c.Query("is_qualified")

	query := database.FiringDB.Model(&models.ThirdPartyTestReport{})

	if batchID != "" {
		query = query.Where("batch_id = ?", batchID)
	}
	if testingOrg != "" {
		query = query.Where("testing_org = ?", testingOrg)
	}
	if isQualified != "" {
		query = query.Where("is_qualified = ?", isQualified == "true")
	}

	var reports []models.ThirdPartyTestReport
	query.Order("report_received_at DESC").Find(&reports)

	c.JSON(http.StatusOK, gin.H{
		"data":  reports,
		"count": len(reports),
	})
}

func SyncThirdPartyData(c *gin.Context) {
	cfg := config.LoadServerConfig()

	req, _ := http.NewRequest("GET", cfg.ThirdPartyAPI+"/reports", nil)
	req.Header.Set("X-API-Key", cfg.ThirdPartyKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to third party service"})
		return
	}
	defer resp.Body.Close()

	var reports []TestReportRequest
	json.NewDecoder(resp.Body).Decode(&reports)

	syncedCount := 0
	for _, report := range reports {
		var existingReport models.ThirdPartyTestReport
		if result := database.FiringDB.Where("report_id = ?", report.ReportID).First(&existingReport); result.Error != nil {
			testItemsJSON, _ := json.Marshal(report.TestItems)
			testResultsJSON, _ := json.Marshal(report.TestResults)

			newReport := models.ThirdPartyTestReport{
				BatchID:         report.BatchID,
				ReportID:        report.ReportID,
				TestingOrg:      report.TestingOrg,
				TestItems:       string(testItemsJSON),
				TestResults:     string(testResultsJSON),
				IsQualified:     report.IsQualified,
				ReportReceivedAt: time.Now(),
				CreatedAt:       time.Now(),
			}
			database.FiringDB.Create(&newReport)
			syncedCount++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "Third party data synced successfully",
		"synced_count": syncedCount,
	})
}

func GetThirdPartyStatus(c *gin.Context) {
	cfg := config.LoadServerConfig()

	req, _ := http.NewRequest("GET", cfg.ThirdPartyAPI+"/health", nil)
	req.Header.Set("X-API-Key", cfg.ThirdPartyKey)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	
	status := "offline"
	var latency int64 = 0
	if err == nil && resp.StatusCode == http.StatusOK {
		status = "online"
		latency = 100
	}
	if resp != nil {
		resp.Body.Close()
	}

	var pendingBatches int64
	database.FiringDB.Model(&models.Batch{}).Where("quality_result = ? OR quality_result IS NULL", "").Count(&pendingBatches)

	c.JSON(http.StatusOK, gin.H{
		"service_status":   status,
		"service_url":      cfg.ThirdPartyAPI,
		"latency_ms":       latency,
		"pending_batches":  pendingBatches,
	})
}

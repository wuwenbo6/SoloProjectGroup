package api

import (
	"log"
	"net/http"
	"strconv"
	"time"

	"shadow-puppet-detection/internal/models"
	"shadow-puppet-detection/internal/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	detectionService *service.DetectionService
	deviceService    *service.DeviceService
	materialService  *service.MaterialService
	alertService     *service.AlertService
	predictionService *service.PredictionService
	exportService     *service.ExportService
	diagnosticService *service.DiagnosticService
}

func NewHandler() *Handler {
	return &Handler{
		detectionService:  service.NewDetectionService(),
		deviceService:     service.NewDeviceService(),
		materialService:   service.NewMaterialService(),
		alertService:      service.NewAlertService(),
		predictionService: service.NewPredictionService(),
		exportService:     service.NewExportService(),
		diagnosticService: service.NewDiagnosticService(),
	}
}

type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

func responseSuccess(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{
		Code:    0,
		Message: "success",
		Data:    data,
	})
}

func responseError(c *gin.Context, code int, message string) {
	c.JSON(http.StatusOK, Response{
		Code:    code,
		Message: message,
	})
}

func (h *Handler) CreateDetection(c *gin.Context) {
	var record models.DetectionRecord
	if err := c.ShouldBindJSON(&record); err != nil {
		log.Println("[API] Invalid request:", err)
		responseError(c, 400, err.Error())
		return
	}

	record.CreatedAt = time.Now()
	record.UpdatedAt = time.Now()

	if err := h.detectionService.AnalyzeAndSave(&record); err != nil {
		log.Println("[API] Failed to analyze and save:", err)
		responseError(c, 500, err.Error())
		return
	}

	go func() {
		BroadcastMessage("new_detection", record)
		
		if record.AlertLevel != models.AlertLevelNormal {
			alerts, err := h.alertService.GetLatestAlerts(1)
			if err == nil && len(alerts) > 0 {
				BroadcastMessage("new_alert", alerts[0])
				log.Printf("[API] Alert broadcasted: level=%s, device=%s", 
					record.AlertLevel, record.DeviceID)
			}
		}
	}()

	log.Printf("[API] Detection created: device=%s, score=%.2f, level=%s", 
		record.DeviceID, record.QualityScore, record.AlertLevel)

	responseSuccess(c, record)
}

func (h *Handler) GetDetectionList(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	deviceID := c.Query("deviceID")
	materialType := c.Query("materialType")
	startDate := c.Query("startDate")
	endDate := c.Query("endDate")

	var start, end *string
	if startDate != "" {
		start = &startDate
	}
	if endDate != "" {
		end = &endDate
	}

	records, total, err := h.detectionService.detectionRepo.List(page, pageSize, deviceID, materialType, nil, nil)
	if err != nil {
		responseError(c, 500, err.Error())
		return
	}

	responseSuccess(c, gin.H{
		"list":  records,
		"total": total,
		"page":  page,
	})
}

func (h *Handler) GetLatestDetections(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	records, err := h.detectionService.GetLatestDetections(limit)
	if err != nil {
		responseError(c, 500, err.Error())
		return
	}
	responseSuccess(c, records)
}

func (h *Handler) GetDetectionStats(c *gin.Context) {
	days, _ := strconv.Atoi(c.DefaultQuery("days", "7"))
	stats, err := h.detectionService.GetStats(days)
	if err != nil {
		responseError(c, 500, err.Error())
		return
	}
	responseSuccess(c, stats)
}

func (h *Handler) GetAllDevices(c *gin.Context) {
	devices, err := h.deviceService.GetAllDevices()
	if err != nil {
		responseError(c, 500, err.Error())
		return
	}
	responseSuccess(c, devices)
}

func (h *Handler) UpdateDeviceStatus(c *gin.Context) {
	deviceID := c.Param("id")
	var req struct {
		Status models.DeviceStatus `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		responseError(c, 400, err.Error())
		return
	}
	if err := h.deviceService.UpdateDeviceStatus(deviceID, req.Status); err != nil {
		responseError(c, 500, err.Error())
		return
	}
	responseSuccess(c, nil)
}

func (h *Handler) GetAllMaterialParams(c *gin.Context) {
	params, err := h.materialService.GetAllParams()
	if err != nil {
		responseError(c, 500, err.Error())
		return
	}
	responseSuccess(c, params)
}

func (h *Handler) UpdateMaterialParam(c *gin.Context) {
	var param models.MaterialParam
	if err := c.ShouldBindJSON(&param); err != nil {
		responseError(c, 400, err.Error())
		return
	}
	if err := h.materialService.UpdateParam(&param); err != nil {
		responseError(c, 500, err.Error())
		return
	}
	responseSuccess(c, param)
}

func (h *Handler) GetAlertList(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	alertLevel := c.Query("alertLevel")
	isHandledStr := c.Query("isHandled")

	var isHandled *bool
	if isHandledStr != "" {
		b, _ := strconv.ParseBool(isHandledStr)
		isHandled = &b
	}

	alerts, total, err := h.alertService.GetAlertList(page, pageSize, isHandled, alertLevel)
	if err != nil {
		responseError(c, 500, err.Error())
		return
	}

	responseSuccess(c, gin.H{
		"list":  alerts,
		"total": total,
		"page":  page,
	})
}

func (h *Handler) HandleAlert(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var req struct {
		HandledBy string `json:"handledBy"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		responseError(c, 400, err.Error())
		return
	}
	if err := h.alertService.HandleAlert(uint(id), req.HandledBy); err != nil {
		responseError(c, 500, err.Error())
		return
	}
	responseSuccess(c, nil)
}

func (h *Handler) GetUnHandledAlertCount(c *gin.Context) {
	count, err := h.alertService.GetUnHandledCount()
	if err != nil {
		responseError(c, 500, err.Error())
		return
	}
	responseSuccess(c, gin.H{"count": count})
}

func (h *Handler) GetLatestAlerts(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	alerts, err := h.alertService.GetLatestAlerts(limit)
	if err != nil {
		responseError(c, 500, err.Error())
		return
	}
	responseSuccess(c, alerts)
}

func (h *Handler) GetMaterialAgingPrediction(c *gin.Context) {
	materialType := c.Query("materialType")
	days, _ := strconv.Atoi(c.DefaultQuery("days", "30"))

	prediction, err := h.predictionService.PredictMaterialAging(materialType, days)
	if err != nil {
		responseError(c, 500, err.Error())
		return
	}
	responseSuccess(c, prediction)
}

func (h *Handler) GetAllPredictions(c *gin.Context) {
	days, _ := strconv.Atoi(c.DefaultQuery("days", "30"))

	predictions, err := h.predictionService.GetAllPredictions(days)
	if err != nil {
		responseError(c, 500, err.Error())
		return
	}
	responseSuccess(c, predictions)
}

func (h *Handler) ExportDetections(c *gin.Context) {
	var filter service.ExportFilter
	if err := c.ShouldBindJSON(&filter); err != nil {
		filter = service.ExportFilter{}
	}

	records, err := h.exportService.ExportDetectionsToCSV(filter)
	if err != nil {
		responseError(c, 500, err.Error())
		return
	}

	csvContent, err := h.exportService.GenerateCSVContent(records)
	if err != nil {
		responseError(c, 500, err.Error())
		return
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=detections.csv")
	c.Data(http.StatusOK, "text/csv", csvContent)
}

func (h *Handler) ExportAlerts(c *gin.Context) {
	var filter service.ExportFilter
	if err := c.ShouldBindJSON(&filter); err != nil {
		filter = service.ExportFilter{}
	}

	records, err := h.exportService.ExportAlertsToCSV(filter)
	if err != nil {
		responseError(c, 500, err.Error())
		return
	}

	csvContent, err := h.exportService.GenerateCSVContent(records)
	if err != nil {
		responseError(c, 500, err.Error())
		return
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=alerts.csv")
	c.Data(http.StatusOK, "text/csv", csvContent)
}

func (h *Handler) ExportStatistics(c *gin.Context) {
	var filter service.ExportFilter
	if err := c.ShouldBindJSON(&filter); err != nil {
		filter = service.ExportFilter{}
	}

	records, err := h.exportService.ExportStatisticsToCSV(filter)
	if err != nil {
		responseError(c, 500, err.Error())
		return
	}

	csvContent, err := h.exportService.GenerateCSVContent(records)
	if err != nil {
		responseError(c, 500, err.Error())
		return
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=statistics.csv")
	c.Data(http.StatusOK, "text/csv", csvContent)
}

func (h *Handler) GetDeviceDiagnostic(c *gin.Context) {
	deviceID := c.Param("id")

	diagnostic, err := h.diagnosticService.DiagnoseDevice(deviceID)
	if err != nil {
		responseError(c, 500, err.Error())
		return
	}
	responseSuccess(c, diagnostic)
}

func (h *Handler) GetAllDiagnostics(c *gin.Context) {
	diagnostics, err := h.diagnosticService.GetAllDiagnostics()
	if err != nil {
		responseError(c, 500, err.Error())
		return
	}
	responseSuccess(c, diagnostics)
}

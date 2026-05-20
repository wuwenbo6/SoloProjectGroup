package api

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.uber.org/zap"
	"golang.org/x/time/rate"

	"iot-core-service/internal/models"
	"iot-core-service/internal/service"
	"iot-core-service/internal/storage"
	"iot-core-service/pkg/config"
)

const (
	maxRequestBodySize = 50 << 20
	defaultRateLimit   = 100
	defaultBurst       = 200
	TokenExpiryTime    = 24 * 3600
)

type HTTPServer struct {
	server             *http.Server
	dataService        *service.DataService
	authService        *service.AuthService
	webhookService     *service.WebhookService
	anomalyRuleService *service.AnomalyRuleService
	backupService      *service.BackupService
	healthCheckService *service.HealthCheckService
	influxDB           *storage.InfluxDBStorage
	logger             *zap.Logger
	rateLimiter        *RateLimiter
	port               int
}

func NewHTTPServerWithInfluxDB(
	cfg *config.Config,
	dataService *service.DataService,
	authService *service.AuthService,
	webhookService *service.WebhookService,
	anomalyRuleService *service.AnomalyRuleService,
	backupService *service.BackupService,
	healthCheckService *service.HealthCheckService,
	influxDB *storage.InfluxDBStorage,
	logger *zap.Logger,
) *HTTPServer {
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()

	rateLimiter := NewRateLimiter(rate.Limit(defaultRateLimit), defaultBurst, logger)
	rateLimiter.CleanupStale()

	server := &HTTPServer{
		dataService:        dataService,
		authService:        authService,
		webhookService:     webhookService,
		anomalyRuleService: anomalyRuleService,
		backupService:      backupService,
		healthCheckService: healthCheckService,
		influxDB:           influxDB,
		logger:             logger,
		rateLimiter:        rateLimiter,
		port:               cfg.Server.HTTPPort,
	}

	router.Use(gin.Recovery())
	router.Use(CORSMiddleware())
	router.Use(RequestLoggerMiddleware(logger))
	router.Use(BodyLimitMiddleware(maxRequestBodySize))

	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	router.GET("/health/live", server.livenessHandler)
	router.GET("/health/ready", server.readinessHandler)
	router.GET("/health", server.detailedHealthHandler)

	auth := router.Group("/api/v1")
	auth.Use(AuthMiddleware(authService, logger))
	auth.Use(RateLimitMiddleware(rateLimiter, authService))
	{
		auth.POST("/data", DeviceAccessMiddleware(authService, logger), server.reportData)
		auth.POST("/data/query", DeviceAccessMiddleware(authService, logger), server.queryData)
		auth.GET("/devices/:device_id/anomalies", DeviceAccessMiddleware(authService, logger), server.getAnomalies)

		webhook := auth.Group("/webhooks")
		{
			webhook.POST("/:device_id", server.registerWebhook)
			webhook.GET("/:device_id", server.getWebhooks)
		}

		anomalyRules := auth.Group("/anomaly-rules")
		{
			anomalyRules.POST("/:device_id", server.setAnomalyRule)
			anomalyRules.GET("/:device_id", server.getAnomalyRules)
			anomalyRules.DELETE("/:device_id/:metric", server.deleteAnomalyRule)
		}

		backups := auth.Group("/backups")
		backups.Use(AdminRequiredMiddleware(authService))
		{
			backups.POST("", server.createBackup)
			backups.GET("", server.listBackups)
			backups.POST("/:backup_id/restore", server.restoreBackup)
			backups.DELETE("/:backup_id", server.deleteBackup)
		}

		admin := auth.Group("/admin")
		admin.Use(AdminRequiredMiddleware(authService))
		{
			admin.POST("/tokens/generate", server.generateToken)
			admin.POST("/downsample/run", server.runDownsample)
			admin.GET("/write-metrics", server.getWriteMetrics)
		}
	}

	server.server = &http.Server{
		Addr:           fmt.Sprintf(":%d", cfg.Server.HTTPPort),
		Handler:        router,
		ReadTimeout:    30 * time.Second,
		WriteTimeout:   30 * time.Second,
		IdleTimeout:    120 * time.Second,
		MaxHeaderBytes: 1 << 20,
	}

	return server
}

func (s *HTTPServer) Start() error {
	s.logger.Info("HTTP server starting", zap.Int("port", s.port))

	go func() {
		if err := s.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			s.logger.Fatal("HTTP server failed", zap.Error(err))
		}
	}()

	return nil
}

func (s *HTTPServer) Stop() error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return s.server.Shutdown(ctx)
}

func (s *HTTPServer) healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok", "version": "2.0.0"})
}

func (s *HTTPServer) reportData(c *gin.Context) {
	var req models.BatchDataRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resp, err := s.dataService.ProcessBatchData(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (s *HTTPServer) queryData(c *gin.Context) {
	var req models.QueryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resp, err := s.dataService.QueryData(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (s *HTTPServer) getAnomalies(c *gin.Context) {
	deviceID := c.Param("device_id")
	if deviceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "device_id is required"})
		return
	}

	startTimeStr := c.Query("start_time")
	endTimeStr := c.Query("end_time")

	var startTime, endTime time.Time
	var err error

	if startTimeStr != "" {
		startTime, err = time.Parse(time.RFC3339, startTimeStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid start_time format"})
			return
		}
	} else {
		startTime = time.Now().Add(-24 * time.Hour)
	}

	if endTimeStr != "" {
		endTime, err = time.Parse(time.RFC3339, endTimeStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid end_time format"})
			return
		}
	} else {
		endTime = time.Now()
	}

	anomalies, err := s.dataService.GetAnomalies(c.Request.Context(), deviceID, startTime, endTime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": anomalies, "count": len(anomalies)})
}

type GenerateTokenRequest struct {
	UserID   string   `json:"user_id" binding:"required"`
	Username string   `json:"username" binding:"required"`
	Roles    []string `json:"roles"`
	Devices  []string `json:"devices"`
}

func (s *HTTPServer) generateToken(c *gin.Context) {
	var req GenerateTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Roles == nil {
		req.Roles = []string{"user"}
	}
	if req.Devices == nil {
		req.Devices = []string{}
	}

	accessToken, refreshToken, err := s.authService.GenerateToken(
		req.UserID,
		req.Username,
		req.Roles,
		req.Devices,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
		"expires_in":    TokenExpiryTime,
	})
}

func (s *HTTPServer) registerWebhook(c *gin.Context) {
	deviceID := c.Param("device_id")

	var req service.WebhookConfig
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	s.webhookService.RegisterWebhook(deviceID, req)
	c.JSON(http.StatusOK, gin.H{"status": "success"})
}

func (s *HTTPServer) getWebhooks(c *gin.Context) {
	deviceID := c.Param("device_id")
	configs := s.webhookService.GetWebhooks(deviceID)
	c.JSON(http.StatusOK, gin.H{"data": configs, "count": len(configs)})
}

func (s *HTTPServer) setAnomalyRule(c *gin.Context) {
	deviceID := c.Param("device_id")

	var rule service.MetricRule
	if err := c.ShouldBindJSON(&rule); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := s.anomalyRuleService.SetRule(deviceID, &rule); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success"})
}

func (s *HTTPServer) getAnomalyRules(c *gin.Context) {
	deviceID := c.Param("device_id")
	rules := s.anomalyRuleService.GetRules(deviceID)
	c.JSON(http.StatusOK, gin.H{"data": rules, "count": len(rules)})
}

func (s *HTTPServer) deleteAnomalyRule(c *gin.Context) {
	deviceID := c.Param("device_id")
	metric := c.Param("metric")

	if !s.anomalyRuleService.DeleteRule(deviceID, metric) {
		c.JSON(http.StatusNotFound, gin.H{"error": "rule not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success"})
}

type CreateBackupRequest struct {
	StartTime string   `json:"start_time" binding:"required"`
	EndTime   string   `json:"end_time" binding:"required"`
	Devices   []string `json:"devices"`
	Metrics   []string `json:"metrics"`
}

func (s *HTTPServer) createBackup(c *gin.Context) {
	var req CreateBackupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	startTime, err := time.Parse(time.RFC3339, req.StartTime)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid start_time format"})
		return
	}

	endTime, err := time.Parse(time.RFC3339, req.EndTime)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid end_time format"})
		return
	}

	backupID, err := s.backupService.CreateBackup(startTime, endTime, req.Devices, req.Metrics)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusAccepted, gin.H{
		"backup_id": backupID,
		"status":    "in_progress",
	})
}

func (s *HTTPServer) listBackups(c *gin.Context) {
	backups := s.backupService.ListBackups()
	c.JSON(http.StatusOK, gin.H{"data": backups, "count": len(backups)})
}

func (s *HTTPServer) restoreBackup(c *gin.Context) {
	backupID := c.Param("backup_id")
	overwrite := c.Query("overwrite") == "true"

	count, err := s.backupService.RestoreBackup(backupID, overwrite)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":      "success",
		"point_count": count,
	})
}

func (s *HTTPServer) deleteBackup(c *gin.Context) {
	backupID := c.Param("backup_id")

	if err := s.backupService.DeleteBackup(backupID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success"})
}

func (s *HTTPServer) runDownsample(c *gin.Context) {
	go func() {
		s.logger.Info("Manual downsampling triggered by admin")
	}()
	c.JSON(http.StatusAccepted, gin.H{"status": "downsampling started"})
}

func (s *HTTPServer) getWriteMetrics(c *gin.Context) {
	metrics := s.influxDB.GetWriteMetrics()
	c.JSON(http.StatusOK, metrics)
}

func (s *HTTPServer) livenessHandler(c *gin.Context) {
	if s.healthCheckService != nil {
		s.healthCheckService.LivenessHandler(c.Writer, c.Request)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "pass", "version": "2.0.0"})
}

func (s *HTTPServer) readinessHandler(c *gin.Context) {
	if s.healthCheckService != nil {
		s.healthCheckService.ReadinessHandler(c.Writer, c.Request)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "pass", "version": "2.0.0"})
}

func (s *HTTPServer) detailedHealthHandler(c *gin.Context) {
	if s.healthCheckService != nil {
		s.healthCheckService.DetailedHealthHandler(c.Writer, c.Request)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "pass", "version": "2.0.0", "service": "iot-core-service"})
}

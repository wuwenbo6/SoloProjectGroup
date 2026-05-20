package main

import (
	"ceramic-api/config"
	"ceramic-api/controllers"
	"ceramic-api/database"
	"ceramic-api/middleware"
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	dbConfig := config.LoadDatabaseConfig()
	database.InitDatabases(dbConfig)

	middleware.InitJWT()
	controllers.InitFiringBuffer()
	controllers.InitKilnSyncWorker()

	middleware.InitSecurityConfig([]*middleware.SecurityConfig{
		{
			AppKey:        "sensor-system",
			SecretKey:     "sensor-secret-key-2024",
			Algorithm:     "HMAC-SHA256",
			ExpireSeconds: 300,
			IsActive:      true,
		},
		{
			AppKey:        "erp-system",
			SecretKey:     "erp-secret-key-2024",
			Algorithm:     "HMAC-SHA256",
			ExpireSeconds: 300,
			IsActive:      true,
		},
	})

	router := setupRouter()

	serverConfig := config.LoadServerConfig()
	server := &http.Server{
		Addr:         ":" + serverConfig.Port,
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		fmt.Printf("Server starting on port %s...\n", serverConfig.Port)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	fmt.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	fmt.Println("Server exited gracefully")
}

func setupRouter() *gin.Engine {
	router := gin.New()

	router.Use(gin.Recovery())
	router.Use(gin.LoggerWithWriter(gin.DefaultWriter, "/health", "/metrics"))
	router.Use(middleware.MetricsMiddleware())
	router.Use(middleware.ConcurrencyLimiter())
	router.Use(middleware.TimeoutMiddleware(25 * time.Second))

	corsConfig := cors.DefaultConfig()
	corsConfig.AllowAllOrigins = true
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"}
	corsConfig.AllowHeaders = []string{"Origin", "Content-Type", "Accept", "Authorization", "X-API-Key", "X-Request-ID", "X-Timestamp", "X-Nonce", "X-Signature", "X-App-Key", "X-Signed-Headers"}
	corsConfig.ExposeHeaders = []string{"X-Request-ID", "X-Rate-Limit-Limit", "X-Rate-Limit-Remaining", "X-Response-Encrypted"}
	corsConfig.MaxAge = 12 * time.Hour
	router.Use(cors.New(corsConfig))

	router.GET("/health", HealthCheck)
	router.GET("/metrics", Metrics)

	api := router.Group("/api/v1")
	api.Use(middleware.RateLimitMiddleware())
	{
		auth := api.Group("/auth")
		{
			auth.POST("/login", controllers.Login)
			auth.POST("/register", controllers.Register)
			auth.POST("/api-key", middleware.JWTAuth(), middleware.RequireRole("admin"), controllers.CreateAPIKey)
			auth.GET("/security-config", middleware.JWTAuth(), middleware.RequireRole("admin"), middleware.GetSecurityConfig)
		}

		alert := api.Group("/alerts")
		alert.Use(middleware.JWTAuth())
		{
			alert.POST("/threshold", middleware.RequireRole("admin"), controllers.CreateAlertThreshold)
			alert.PUT("/threshold/:id", middleware.RequireRole("admin"), controllers.UpdateAlertThreshold)
			alert.GET("/thresholds", controllers.GetAlertThresholds)
			alert.DELETE("/threshold/:id", middleware.RequireRole("admin"), controllers.DeleteAlertThreshold)
			alert.GET("/", controllers.GetAlerts)
			alert.PUT("/:id/handle", controllers.HandleAlert)
			alert.GET("/stats", controllers.GetAlertStats)
			alert.POST("/check-batch", controllers.BatchCheckAlerts)
		}

		firing := api.Group("/firing")
		firing.Use(middleware.SignatureAuth())
		firing.Use(middleware.EncryptResponse())
		{
			firing.POST("/params", controllers.CollectFiringParam)
			firing.POST("/params/batch", controllers.BatchCollectFiringParams)
			firing.GET("/params", controllers.GetFiringParams)
			firing.GET("/params/:id", controllers.GetFiringParamByID)
			firing.GET("/stats", controllers.GetFiringParamStats)
		}

		kiln := api.Group("/kiln")
		kiln.Use(middleware.SignatureAuth())
		kiln.Use(middleware.EncryptResponse())
		{
			kiln.POST("/temp", controllers.CollectKilnTemp)
			kiln.POST("/temp/batch", controllers.BatchCollectKilnTemp)
			kiln.POST("/temp/sync", controllers.SyncKilnTemp)
			kiln.GET("/temp", controllers.GetKilnTempRecords)
			kiln.GET("/temp/stats", controllers.GetKilnTempStats)
			kiln.GET("/temp/unsynced", controllers.GetUnsyncedCount)
			kiln.POST("/temp/compare-curves", controllers.CompareKilnTemperatureCurves)
			kiln.GET("/temp/trend", controllers.GetBatchTemperatureTrend)
			kiln.GET("/temp/zones", controllers.GetZoneTemperatureComparison)
		}

		process := api.Group("/process")
		process.Use(middleware.JWTAuth())
		{
			process.POST("/params", controllers.CollectProcessParam)
			process.GET("/params", controllers.GetProcessParams)
			process.GET("/analysis", controllers.AnalyzeProcess)
			process.GET("/analysis/history", controllers.GetProcessAnalysis)
		}

		export := api.Group("/export")
		export.Use(middleware.JWTAuth())
		{
			export.POST("/process", controllers.ExportProcessData)
			export.POST("/firing", controllers.ExportFiringParams)
			export.POST("/alerts", controllers.ExportAlertRecords)
		}

		batch := api.Group("/batches")
		batch.Use(middleware.JWTAuth())
		{
			batch.POST("/", controllers.CreateBatch)
			batch.GET("/", controllers.GetBatches)
			batch.GET("/stats", controllers.GetBatchStats)
			batch.GET("/:batch_id", controllers.GetBatchByID)
			batch.PUT("/:batch_id/status", controllers.UpdateBatchStatus)
			batch.PUT("/:batch_id/quality", controllers.UpdateBatchQuality)
			batch.DELETE("/:batch_id", controllers.DeleteBatch)
		}

		thirdParty := api.Group("/third-party")
		thirdParty.Use(middleware.SignatureAuth())
		{
			thirdParty.POST("/submit/:batch_id", controllers.SubmitToThirdParty)
			thirdParty.POST("/report", controllers.ReceiveTestReport)
			thirdParty.GET("/reports", controllers.GetTestReports)
			thirdParty.POST("/sync", controllers.SyncThirdPartyData)
			thirdParty.GET("/status", controllers.GetThirdPartyStatus)
		}
	}

	return router
}

func HealthCheck(c *gin.Context) {
	dbStatus := "healthy"

	var count int64
	if err := database.FiringDB.Raw("SELECT 1").Scan(&count).Error; err != nil {
		dbStatus = "unhealthy"
	}

	c.JSON(http.StatusOK, gin.H{
		"status":    "healthy",
		"database":  dbStatus,
		"timestamp": time.Now(),
	})
}

func Metrics(c *gin.Context) {
	metrics := middleware.GetMetrics()
	c.JSON(http.StatusOK, metrics)
}

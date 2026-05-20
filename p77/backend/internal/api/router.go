package api

import (
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func SetupRouter() *gin.Engine {
	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"*"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	handler := NewHandler()

	api := r.Group("/api/v1")
	{
		detection := api.Group("/detections")
		{
			detection.POST("", handler.CreateDetection)
			detection.GET("", handler.GetDetectionList)
			detection.GET("/latest", handler.GetLatestDetections)
			detection.GET("/stats", handler.GetDetectionStats)
		}

		device := api.Group("/devices")
		{
			device.GET("", handler.GetAllDevices)
			device.PUT("/:id/status", handler.UpdateDeviceStatus)
		}

		material := api.Group("/materials")
		{
			material.GET("", handler.GetAllMaterialParams)
			material.PUT("", handler.UpdateMaterialParam)
		}

		alert := api.Group("/alerts")
		{
			alert.GET("", handler.GetAlertList)
			alert.GET("/unhandled-count", handler.GetUnHandledAlertCount)
			alert.GET("/latest", handler.GetLatestAlerts)
			alert.PUT("/:id/handle", handler.HandleAlert)
		}

		prediction := api.Group("/predictions")
		{
			prediction.GET("", handler.GetAllPredictions)
			prediction.GET("/aging", handler.GetMaterialAgingPrediction)
		}

		export := api.Group("/export")
		{
			export.POST("/detections", handler.ExportDetections)
			export.POST("/alerts", handler.ExportAlerts)
			export.POST("/statistics", handler.ExportStatistics)
		}

		diagnostic := api.Group("/diagnostics")
		{
			diagnostic.GET("", handler.GetAllDiagnostics)
			diagnostic.GET("/:id", handler.GetDeviceDiagnostic)
		}
	}

	r.GET("/ws", func(c *gin.Context) {
		HandleWebSocket(c.Writer, c.Request)
	})

	return r
}

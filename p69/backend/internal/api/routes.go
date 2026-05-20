package api

import (
	"github.com/gin-gonic/gin"
)

func SetupRoutes(r *gin.Engine) {
	api := r.Group("/api")
	{
		api.GET("/sensor-data", GetSensorData)
		api.GET("/alerts", GetAlerts)
		api.PUT("/alerts/:id/acknowledge", AcknowledgeAlert)
		api.GET("/configs", GetProcessConfigs)
		api.PUT("/configs/:process_type", UpdateProcessConfig)
		api.GET("/historical-data", GetHistoricalData)
		api.GET("/report/download", DownloadReport)
		api.GET("/diagnostics", GetDiagnostics)
		api.GET("/diagnostics/history", GetDiagnosticHistory)
		api.GET("/auto-adjust", GetAutoAdjustStatus)
		api.PUT("/auto-adjust", SetAutoAdjustStatus)
		api.GET("/adjustments", GetAdjustmentHistory)
	}

	r.GET("/ws", WebSocketHandler)
}

package main

import (
	"fermentation-monitor/internal/api"
	"fermentation-monitor/internal/database"
	"log"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	if err := database.Init(); err != nil {
		log.Fatal("Failed to initialize database:", err)
	}
	log.Println("Database initialized successfully")

	go api.BroadcastData()

	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"*"},
		AllowCredentials: true,
	}))

	apiGroup := r.Group("/api")
	{
		apiGroup.GET("/fermenters", api.GetFermenters)
		apiGroup.GET("/settings", api.GetSettings)
		apiGroup.PUT("/settings", api.UpdateSettings)
		apiGroup.GET("/data/current/:id", api.GetCurrentData)
		apiGroup.GET("/data/history/:id", api.GetHistoryData)
		apiGroup.GET("/alerts", api.GetAlerts)
		apiGroup.GET("/analysis/:id", api.GetAnalysis)
		apiGroup.GET("/adjustments", api.GetAdjustmentRecords)
		apiGroup.GET("/faults", api.GetFaultDiagnosis)
		apiGroup.PUT("/faults/:id/resolve", api.ResolveFault)
		apiGroup.POST("/export", api.ExportReport)
	}

	r.GET("/ws", api.HandleWebSocket)

	log.Println("Server starting on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}

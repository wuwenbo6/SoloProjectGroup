package main

import (
	"log"
	"papermonitor/internal/api"
	"papermonitor/internal/config"
	"papermonitor/internal/sensor"
	"papermonitor/internal/ws"

	"github.com/gin-gonic/gin"
)

func main() {
	err := config.InitDatabase()
	if err != nil {
		log.Fatal("Failed to initialize database:", err)
	}

	sensor.InitAlertPusher()
	sensor.InitAutoAdjust()
	sensor.InitDiagnostic()
	go sensor.Collector.Start()
	go ws.WSHub.Run()

	r := gin.Default()

	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	api.SetupRoutes(r)

	log.Println("Server starting on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}

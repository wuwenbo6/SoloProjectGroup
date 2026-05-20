package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
	"wifi-probe-analytics/api"
	"wifi-probe-analytics/config"
	"wifi-probe-analytics/dedupe"
	"wifi-probe-analytics/influx"
	"wifi-probe-analytics/processor"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	influxClient, err := influx.NewClient(cfg.InfluxDB)
	if err != nil {
		log.Fatalf("Failed to create InfluxDB client: %v", err)
	}
	defer influxClient.Close()

	deduplicator := dedupe.NewDeduplicator(cfg.Dedupe.WindowSize, cfg.Dedupe.DuplicateInterval)

	proc := processor.NewProcessor(influxClient, deduplicator, cfg.Processor)

	go deduplicator.StartCleanupLoop()

	go func() {
		ticker := time.NewTicker(1 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			proc.CheckAndCloseSessions()
		}
	}()

	router := gin.Default()

	router.Use(CORS())

	api.SetupRoutes(router, proc, influxClient, cfg)

	srv := &http.Server{
		Addr:    ":" + cfg.Server.Port,
		Handler: router,
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	log.Printf("Server started on port %s", cfg.Server.Port)

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited")
}

func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

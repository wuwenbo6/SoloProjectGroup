package main

import (
	"log"

	"github.com/video-transcoder/internal/api"
	"github.com/video-transcoder/internal/cache"
	"github.com/video-transcoder/internal/config"
	"github.com/video-transcoder/internal/database"
	"github.com/video-transcoder/internal/mq"
	"github.com/video-transcoder/internal/processor"
	"github.com/video-transcoder/internal/storage"
)

func main() {
	cfg := config.Load()

	if err := database.Init(cfg); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	log.Println("Database initialized")

	if err := cache.Init(cfg); err != nil {
		log.Fatalf("Failed to initialize Redis: %v", err)
	}
	log.Println("Redis initialized")

	minioClient, err := storage.NewMinIOClient(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize MinIO: %v", err)
	}
	log.Println("MinIO initialized")

	mqClient, err := mq.NewRabbitMQClient(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize RabbitMQ: %v", err)
	}
	log.Println("RabbitMQ initialized")

	videoProcessor := processor.NewVideoProcessor(cfg, minioClient, mqClient)

	go videoProcessor.StartSplitWatcher()
	go videoProcessor.StartTimeoutWatcher()
	go videoProcessor.StartDLQReProcessor()

	for i := 0; i < cfg.WorkerCount; i++ {
		go videoProcessor.StartWorker(string(rune('A' + i)))
	}

	router := api.SetupRouter(minioClient)

	log.Printf("Server starting on port %s...", cfg.ServerPort)
	if err := router.Run(":" + cfg.ServerPort); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

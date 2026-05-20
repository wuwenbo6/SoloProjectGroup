package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/genomics/alignment/internal/cache"
	"github.com/genomics/alignment/internal/worker"
	"github.com/genomics/alignment/pkg/utils"
)

const (
	defaultRedisAddr = "localhost:6379"
	defaultAMQPURL   = "amqp://guest:guest@localhost:5672/"
)

func main() {
	redisAddr := utils.GetEnv("REDIS_ADDR", defaultRedisAddr)
	amqpURL := utils.GetEnv("AMQP_URL", defaultAMQPURL)

	cacheClient := cache.NewCache(redisAddr)
	if err := cacheClient.Ping(); err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	log.Println("Connected to Redis successfully")

	w, err := worker.NewWorker(amqpURL, cacheClient)
	if err != nil {
		log.Fatalf("Failed to create worker: %v", err)
	}
	defer w.Stop()

	go func() {
		if err := w.Start(); err != nil {
			log.Fatalf("Worker failed: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down worker...")
}

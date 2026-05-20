package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/genomics/alignment/internal/cache"
	"github.com/genomics/alignment/internal/scheduler"
	"github.com/genomics/alignment/internal/storage"
	"github.com/genomics/alignment/pkg/models"
	"github.com/genomics/alignment/pkg/utils"
)

const (
	defaultPort      = ":8080"
	defaultRedisAddr = "localhost:6379"
	defaultAMQPURL   = "amqp://guest:guest@localhost:5672/"
	defaultStoragePath = "./data"
)

func main() {
	port := utils.GetEnv("PORT", defaultPort)
	redisAddr := utils.GetEnv("REDIS_ADDR", defaultRedisAddr)
	amqpURL := utils.GetEnv("AMQP_URL", defaultAMQPURL)
	storagePath := utils.GetEnv("STORAGE_PATH", defaultStoragePath)

	utils.EnsureDir(storagePath)

	cacheClient := cache.NewCache(redisAddr)
	if err := cacheClient.Ping(); err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	log.Println("Connected to Redis successfully")

	storage := storage.NewStorage(storagePath)

	scheduler, err := scheduler.NewScheduler(amqpURL, cacheClient, storage)
	if err != nil {
		log.Fatalf("Failed to create scheduler: %v", err)
	}
	defer scheduler.Close()
	log.Println("Scheduler started successfully")

	mux := http.NewServeMux()

	mux.HandleFunc("/upload", handleUpload(cacheClient, storage, scheduler))
	mux.HandleFunc("/status/", handleStatus(cacheClient))
	mux.HandleFunc("/result/", handleResult(storage))
	mux.HandleFunc("/health", handleHealth(cacheClient))

	server := &http.Server{
		Addr:    port,
		Handler: mux,
	}

	go func() {
		log.Printf("Server starting on %s", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
}

func handleUpload(cacheClient *cache.Cache, storage *storage.Storage, scheduler *scheduler.Scheduler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		taskID := utils.GenerateTaskID()

		scoringConfig := parseScoringConfig(r)

		task := &models.Task{
			ID:            taskID,
			FileName:      r.Header.Get("X-File-Name"),
			Status:        models.TaskStatusUploading,
			ScoringConfig: scoringConfig,
		}
		cacheClient.SaveTask(task)

		if err := r.ParseMultipartForm(100 << 20); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		file, _, err := r.FormFile("file")
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		defer file.Close()

		data, err := io.ReadAll(file)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		if err := storage.SaveFile(taskID, data); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		task.FileSize = int64(len(data))
		cacheClient.SaveTask(task)

		if err := scheduler.SubmitTask(task); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"task_id":       taskID,
			"success":       true,
			"message":       "File uploaded successfully",
			"matrix_type":   scoringConfig.MatrixType,
			"matrix_url":    scoringConfig.MatrixURL,
		})
	}
}

func parseScoringConfig(r *http.Request) *models.ScoringConfig {
	matrixType := r.FormValue("matrix_type")
	matrixURL := r.FormValue("matrix_url")
	
	if matrixType == "" {
		matrixType = "default"
	}
	
	return &models.ScoringConfig{
		MatrixType: matrixType,
		MatrixURL:  matrixURL,
	}
}

func handleStatus(cacheClient *cache.Cache) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		taskID := r.URL.Path[len("/status/"):]
		if taskID == "" {
			http.Error(w, "Task ID required", http.StatusBadRequest)
			return
		}

		task, err := cacheClient.GetTask(taskID)
		if err != nil {
			http.Error(w, "Task not found", http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(task)
	}
}

func handleResult(storage *storage.Storage) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		taskID := r.URL.Path[len("/result/"):]
		if idx := strings.Index(taskID, "?"); idx != -1 {
			taskID = taskID[:idx]
		}
		if taskID == "" {
			http.Error(w, "Task ID required", http.StatusBadRequest)
			return
		}

		result, err := storage.GetResult(taskID)
		if err != nil {
			http.Error(w, "Result not found", http.StatusNotFound)
			return
		}

		format := r.URL.Query().Get("format")
		if format == "heatmap" {
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s_heatmap.txt\"", taskID))
			
			if result.BatchHeatmap != "" {
				w.Write([]byte(result.BatchHeatmap))
			} else {
				w.Write([]byte("Heatmap not available for this task"))
			}
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
	}
}

func handleHealth(cacheClient *cache.Cache) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := cacheClient.Ping(); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]string{"status": "unhealthy"})
			return
		}
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
	}
}

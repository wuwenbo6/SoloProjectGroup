package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"scheduler-center/src/api"
	"scheduler-center/src/core"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
)

var (
	rdb *redis.Client
	ctx = context.Background()
)

func taskDispatcher(sharding *core.Sharding) {
	for {
		result, err := rdb.BRPop(ctx, 5*time.Second, "pending-tasks").Result()
		if err != nil {
			if err != redis.Nil {
				log.Printf("Error fetching pending tasks: %v", err)
			}
			time.Sleep(1 * time.Second)
			continue
		}

		if len(result) < 2 {
			continue
		}

		taskID := result[1]
		taskData, err := rdb.HGet(ctx, "tasks", taskID).Result()
		if err != nil {
			log.Printf("Error getting task data: %v", err)
			continue
		}

		var task api.Task
		json.Unmarshal([]byte(taskData), &task)

		if task.Status != "pending" && task.Status != "retrying" {
			continue
		}

		currentBinding, _ := sharding.GetTaskExecutorBinding(taskID)
		executor, err := sharding.SelectExecutor(taskID, currentBinding)
		if executor == nil || err != nil {
			rdb.LPush(ctx, "pending-tasks", taskID)
			time.Sleep(1 * time.Second)
			continue
		}

		task.ExecutorID = executor.ID
		task.Status = "pending"
		taskData, _ = json.Marshal(task)
		rdb.HSet(ctx, "tasks", taskID, taskData)

		err = rdb.LPush(ctx, "executor:"+executor.ID+":tasks", taskID).Err()
		if err != nil {
			log.Printf("Error assigning task to executor: %v", err)
			rdb.LPush(ctx, "pending-tasks", taskID)
		}
	}
}

func main() {
	rdb = redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
		DB:   0,
	})

	_, err := rdb.Ping(ctx).Result()
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}

	log.Println("Connected to Redis successfully")

	monitor := core.NewMonitor(rdb)
	go monitor.Start()

	sharding := core.NewSharding(rdb, monitor)
	go taskDispatcher(sharding)

	r := gin.Default()

	taskAPI := api.NewTaskAPI(rdb, sharding, monitor)
	taskGroup := r.Group("/api/v1/tasks")
	{
		taskGroup.POST("", taskAPI.CreateTask)
		taskGroup.GET("/:id", taskAPI.GetTask)
		taskGroup.GET("", taskAPI.ListTasks)
		taskGroup.PUT("/:id/pause", taskAPI.PauseTask)
		taskGroup.PUT("/:id/resume", taskAPI.ResumeTask)
		taskGroup.DELETE("/:id", taskAPI.CancelTask)
		taskGroup.GET("/:id/logs", taskAPI.GetTaskLogs)
	}

	executorGroup := r.Group("/api/v1/executors")
	{
		executorGroup.GET("", taskAPI.ListExecutors)
	}

	callbackGroup := r.Group("/api/v1/callback")
	{
		callbackGroup.POST("/task/status", taskAPI.UpdateTaskStatus)
	}

	srv := &http.Server{
		Addr:    ":8080",
		Handler: r,
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	log.Println("Scheduler Center started on :8080")

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

	log.Println("Server exiting")
}

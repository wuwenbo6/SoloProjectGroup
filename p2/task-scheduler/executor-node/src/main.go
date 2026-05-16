package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"executor-node/src/client"
	"executor-node/src/runner"

	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
)

var (
	rdb           *redis.Client
	ctx           = context.Background()
	executorID    string
	runningTasks  = make(map[string]struct{})
	runningTasksMu sync.RWMutex
)

func main() {
	executorID = uuid.New().String()
	log.Printf("Executor ID: %s", executorID)

	rdb = redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
		DB:   0,
	})

	_, err := rdb.Ping(ctx).Result()
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}

	log.Println("Connected to Redis successfully")

	schedulerClient := client.NewSchedulerClient("http://localhost:8080", executorID)

	go registerExecutor()
	go heartbeat()
	go processTasks(schedulerClient)

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down executor...")
	rdb.HDel(ctx, "executors", executorID)
	log.Println("Executor exiting")
}

func registerExecutor() {
	executor := map[string]interface{}{
		"id":       executorID,
		"address":  "http://localhost:9090",
		"cpu":      getCPUUsage(),
		"memory":   getMemoryUsage(),
		"last_seen": time.Now().Unix(),
	}

	data, _ := json.Marshal(executor)
	rdb.HSet(ctx, "executors", executorID, data)
	log.Println("Executor registered successfully")
}

func heartbeat() {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		executor := map[string]interface{}{
			"id":        executorID,
			"address":   "http://localhost:9090",
			"cpu":       getCPUUsage(),
			"memory":    getMemoryUsage(),
			"last_seen": time.Now().Unix(),
		}

		data, _ := json.Marshal(executor)
		rdb.HSet(ctx, "executors", executorID, data)
	}
}

func getCPUUsage() float64 {
	return 20.0 + float64(time.Now().Unix()%30)
}

func getMemoryUsage() float64 {
	return 40.0 + float64(time.Now().Unix()%20)
}

type Task struct {
	ID            string                 `json:"id"`
	Name          string                 `json:"name"`
	Type          string                 `json:"type"`
	TaskType      string                 `json:"task_type"`
	CronExpr      string                 `json:"cron_expr,omitempty"`
	Interval      int                    `json:"interval,omitempty"`
	Command       string                 `json:"command,omitempty"`
	HTTPRequest   map[string]interface{} `json:"http_request,omitempty"`
	Status        string                 `json:"status"`
	ExecutorID    string                 `json:"executor_id,omitempty"`
	CreatedAt     time.Time              `json:"created_at"`
	UpdatedAt     time.Time              `json:"updated_at"`
	Timeout       int                    `json:"timeout,omitempty"`
	Dependencies  []string               `json:"dependencies,omitempty"`
	RetryCount    int                    `json:"retry_count,omitempty"`
	MaxRetries    int                    `json:"max_retries,omitempty"`
	RetryInterval int                    `json:"retry_interval,omitempty"`
}

func isTaskRunning(taskID string) bool {
	runningTasksMu.RLock()
	defer runningTasksMu.RUnlock()
	_, running := runningTasks[taskID]
	return running
}

func markTaskRunning(taskID string) bool {
	runningTasksMu.Lock()
	defer runningTasksMu.Unlock()
	if _, running := runningTasks[taskID]; running {
		return false
	}
	runningTasks[taskID] = struct{}{}
	return true
}

func markTaskCompleted(taskID string) {
	runningTasksMu.Lock()
	defer runningTasksMu.Unlock()
	delete(runningTasks, taskID)
}

func tryAcquireTaskLock(taskID string) (bool, error) {
	lockKey := "executor:task:lock:" + taskID
	ok, err := rdb.SetNX(ctx, lockKey, executorID, 10*time.Minute).Result()
	if err != nil {
		return false, err
	}
	return ok, nil
}

func releaseTaskLock(taskID string) {
	rdb.Del(ctx, "executor:task:lock:"+taskID)
}

func processTasks(schedulerClient *client.SchedulerClient) {
	taskQueue := "executor:" + executorID + ":tasks"

	for {
		result, err := rdb.BRPop(ctx, 5*time.Second, taskQueue).Result()
		if err != nil {
			if err != redis.Nil {
				log.Printf("Error fetching task: %v", err)
			}
			continue
		}

		if len(result) < 2 {
			continue
		}

		taskID := result[1]

		if isTaskRunning(taskID) {
			log.Printf("Task %s is already running locally, skipping", taskID)
			continue
		}

		locked, err := tryAcquireTaskLock(taskID)
		if err != nil || !locked {
			log.Printf("Task %s is locked by another executor, skipping", taskID)
			continue
		}

		taskData, err := rdb.HGet(ctx, "tasks", taskID).Result()
		if err != nil {
			releaseTaskLock(taskID)
			log.Printf("Error getting task data: %v", err)
			continue
		}

		var task Task
		json.Unmarshal([]byte(taskData), &task)

		if task.Status == "running" || task.Status == "success" || task.Status == "failed" {
			releaseTaskLock(taskID)
			log.Printf("Task %s already in state %s, skipping execution", taskID, task.Status)
			continue
		}

		if !markTaskRunning(taskID) {
			releaseTaskLock(taskID)
			log.Printf("Task %s already running, skipping", taskID)
			continue
		}

		go executeTask(&task, schedulerClient)
	}
}

func executeTask(task *Task, schedulerClient *client.SchedulerClient) {
	defer markTaskCompleted(task.ID)
	defer releaseTaskLock(task.ID)

	log.Printf("Executing task: %s (%s)", task.Name, task.ID)

	schedulerClient.UpdateTaskStatus(task.ID, "running", "")

	var logOutput string
	var err error

	switch task.TaskType {
	case "shell":
		logOutput, err = runner.ExecuteShellCommand(task.Command, task.Timeout)
	case "http":
		logOutput, err = runner.ExecuteHTTPRequest(task.HTTPRequest, task.Timeout)
	default:
		logOutput = "Unknown task type"
		err = nil
	}

	status := "success"
	if err != nil {
		status = "failed"
		logOutput += "\nError: " + err.Error()
	}

	runner.WriteTaskLog(task.ID, logOutput)

	schedulerClient.UpdateTaskStatus(task.ID, status, logOutput)
	log.Printf("Task %s completed with status: %s", task.ID, status)
}

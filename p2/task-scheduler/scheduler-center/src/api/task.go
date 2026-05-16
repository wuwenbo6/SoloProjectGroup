package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"scheduler-center/src/core"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
)

type Task struct {
	ID             string                 `json:"id"`
	Name           string                 `json:"name"`
	Type           string                 `json:"type"`
	TaskType       string                 `json:"task_type"`
	CronExpr       string                 `json:"cron_expr,omitempty"`
	Interval       int                    `json:"interval,omitempty"`
	Command        string                 `json:"command,omitempty"`
	HTTPRequest    map[string]interface{} `json:"http_request,omitempty"`
	Status         string                 `json:"status"`
	ExecutorID     string                 `json:"executor_id,omitempty"`
	CreatedAt      time.Time              `json:"created_at"`
	UpdatedAt      time.Time              `json:"updated_at"`
	Timeout        int                    `json:"timeout,omitempty"`
	Dependencies   []string               `json:"dependencies,omitempty"`
	RetryCount     int                    `json:"retry_count,omitempty"`
	MaxRetries     int                    `json:"max_retries,omitempty"`
	RetryInterval  int                    `json:"retry_interval,omitempty"`
}

type TaskLog struct {
	ID        string    `json:"id"`
	TaskID    string    `json:"task_id"`
	ExecutorID string   `json:"executor_id"`
	Log       string    `json:"log"`
	Status    string    `json:"status"`
	Timestamp time.Time `json:"timestamp"`
}

var esClient *http.Client = &http.Client{Timeout: 10 * time.Second}
const esURL = "http://localhost:9200"

type TaskAPI struct {
	rdb      *redis.Client
	sharding *core.Sharding
	monitor  *core.Monitor
	ctx      context.Context
}

func NewTaskAPI(rdb *redis.Client, sharding *core.Sharding, monitor *core.Monitor) *TaskAPI {
	return &TaskAPI{
		rdb:      rdb,
		sharding: sharding,
		monitor:  monitor,
		ctx:      context.Background(),
	}
}

func (t *TaskAPI) checkDependencies(task *Task) bool {
	for _, depID := range task.Dependencies {
		depData, err := t.rdb.HGet(t.ctx, "tasks", depID).Result()
		if err != nil {
			return false
		}
		var depTask Task
		json.Unmarshal([]byte(depData), &depTask)
		if depTask.Status != "success" {
			return false
		}
	}
	return true
}

func indexLogToES(log *TaskLog) error {
	logData, _ := json.Marshal(log)
	req, _ := http.NewRequest("POST", esURL+"/task-logs/_doc/"+log.ID, bytes.NewBuffer(logData))
	req.Header.Set("Content-Type", "application/json")
	resp, err := esClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

func queryLogsByTaskID(taskID string) ([]TaskLog, error) {
	query := map[string]interface{}{
		"query": map[string]interface{}{
			"term": map[string]string{
				"task_id": taskID,
			},
		},
		"sort": []map[string]interface{}{
			{"timestamp": map[string]string{"order": "asc"}},
		},
	}
	queryData, _ := json.Marshal(query)
	req, _ := http.NewRequest("POST", esURL+"/task-logs/_search", bytes.NewBuffer(queryData))
	req.Header.Set("Content-Type", "application/json")
	resp, err := esClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Hits struct {
			Hits []struct {
				Source TaskLog `json:"_source"`
			} `json:"hits"`
		} `json:"hits"`
	}
	json.NewDecoder(resp.Body).Decode(&result)

	logs := make([]TaskLog, len(result.Hits.Hits))
	for i, hit := range result.Hits.Hits {
		logs[i] = hit.Source
	}
	return logs, nil
}

func (t *TaskAPI) CreateTask(c *gin.Context) {
	var task Task
	if err := c.ShouldBindJSON(&task); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	for _, depID := range task.Dependencies {
		_, err := t.rdb.HGet(t.ctx, "tasks", depID).Result()
		if err == redis.Nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Dependency task %s not found", depID)})
			return
		}
	}

	task.ID = uuid.New().String()
	task.Status = "pending"
	task.CreatedAt = time.Now()
	task.UpdatedAt = time.Now()
	task.RetryCount = 0

	if task.Timeout == 0 {
		task.Timeout = 300
	}
	if task.RetryInterval == 0 {
		task.RetryInterval = 5
	}

	taskData, _ := json.Marshal(task)
	err := t.rdb.HSet(t.ctx, "tasks", task.ID, taskData).Err()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	t.rdb.LPush(t.ctx, "pending-tasks", task.ID)

	t.monitor.AddTask(task.ID)

	c.JSON(http.StatusCreated, task)
}

func (t *TaskAPI) GetTask(c *gin.Context) {
	id := c.Param("id")

	taskData, err := t.rdb.HGet(t.ctx, "tasks", id).Result()
	if err == redis.Nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var task Task
	json.Unmarshal([]byte(taskData), &task)
	c.JSON(http.StatusOK, task)
}

func (t *TaskAPI) ListTasks(c *gin.Context) {
	tasksData, err := t.rdb.HGetAll(t.ctx, "tasks").Result()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	tasks := make([]Task, 0, len(tasksData))
	for _, data := range tasksData {
		var task Task
		json.Unmarshal([]byte(data), &task)
		tasks = append(tasks, task)
	}

	c.JSON(http.StatusOK, tasks)
}

func (t *TaskAPI) PauseTask(c *gin.Context) {
	id := c.Param("id")

	taskData, err := t.rdb.HGet(t.ctx, "tasks", id).Result()
	if err == redis.Nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	var task Task
	json.Unmarshal([]byte(taskData), &task)

	if task.Status == "running" {
		task.Status = "paused"
		task.UpdatedAt = time.Now()
		taskData, _ := json.Marshal(task)
		t.rdb.HSet(t.ctx, "tasks", id, taskData)
	}

	c.JSON(http.StatusOK, task)
}

func (t *TaskAPI) ResumeTask(c *gin.Context) {
	id := c.Param("id")

	taskData, err := t.rdb.HGet(t.ctx, "tasks", id).Result()
	if err == redis.Nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	var task Task
	json.Unmarshal([]byte(taskData), &task)

	if task.Status == "paused" {
		task.Status = "pending"
		task.UpdatedAt = time.Now()
		taskData, _ := json.Marshal(task)
		t.rdb.HSet(t.ctx, "tasks", id, taskData)
	}

	c.JSON(http.StatusOK, task)
}

func (t *TaskAPI) CancelTask(c *gin.Context) {
	id := c.Param("id")

	taskData, err := t.rdb.HGet(t.ctx, "tasks", id).Result()
	if err == redis.Nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	var task Task
	json.Unmarshal([]byte(taskData), &task)

	task.Status = "cancelled"
	task.UpdatedAt = time.Now()
	taskData, _ = json.Marshal(task)
	t.rdb.HSet(t.ctx, "tasks", id, taskData)

	c.JSON(http.StatusOK, task)
}

func (t *TaskAPI) ListExecutors(c *gin.Context) {
	executors := t.monitor.GetExecutors()
	c.JSON(http.StatusOK, executors)
}

func (t *TaskAPI) UpdateTaskStatus(c *gin.Context) {
	var update struct {
		TaskID     string `json:"task_id"`
		Status     string `json:"status"`
		Log        string `json:"log"`
		ExecutorID string `json:"executor_id"`
	}

	if err := c.ShouldBindJSON(&update); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	taskData, err := t.rdb.HGet(t.ctx, "tasks", update.TaskID).Result()
	if err == redis.Nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	var task Task
	json.Unmarshal([]byte(taskData), &task)

	taskLog := &TaskLog{
		ID:         uuid.New().String(),
		TaskID:     update.TaskID,
		ExecutorID: update.ExecutorID,
		Log:        update.Log,
		Status:     update.Status,
		Timestamp:  time.Now(),
	}
	go indexLogToES(taskLog)

	if update.Status == "failed" && task.RetryCount < task.MaxRetries {
		task.RetryCount++
		task.Status = "retrying"
		task.UpdatedAt = time.Now()

		taskData, _ = json.Marshal(task)
		t.rdb.HSet(t.ctx, "tasks", update.TaskID, taskData)

		go func(taskID string, interval int) {
			time.Sleep(time.Duration(interval) * time.Second)
			t.rdb.LPush(t.ctx, "pending-tasks", taskID)
		}(update.TaskID, task.RetryInterval)

		c.JSON(http.StatusOK, gin.H{"message": "Task scheduled for retry", "retry_count": task.RetryCount})
		return
	}

	task.Status = update.Status
	task.UpdatedAt = time.Now()

	taskData, _ = json.Marshal(task)
	t.rdb.HSet(t.ctx, "tasks", update.TaskID, taskData)

	if update.Status == "success" {
		go t.triggerDependentTasks(update.TaskID)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Status updated"})
}

func (t *TaskAPI) triggerDependentTasks(taskID string) {
	tasksData, _ := t.rdb.HGetAll(t.ctx, "tasks").Result()
	for _, data := range tasksData {
		var task Task
		json.Unmarshal([]byte(data), &task)
		if task.Status == "pending" {
			for _, dep := range task.Dependencies {
				if dep == taskID && t.checkDependencies(&task) {
					t.rdb.LPush(t.ctx, "pending-tasks", task.ID)
					break
				}
			}
		}
	}
}

func (t *TaskAPI) GetTaskLogs(c *gin.Context) {
	taskID := c.Param("id")
	logs, err := queryLogsByTaskID(taskID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, logs)
}

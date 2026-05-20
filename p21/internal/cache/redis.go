package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/genomics/alignment/pkg/models"
	"github.com/genomics/alignment/pkg/utils"
)

const (
	TaskPrefix        = "task:"
	TaskResultPrefix = "task_result:"
	SequencePrefix   = "sequence:"
	WorkerPrefix    = "worker:"
	ResultTTL        = 24 * time.Hour
	SequenceTTL    = 7 * 24 * time.Hour
)

type Cache struct {
	client *redis.Client
	ctx    context.Context
}

func NewCache(addr string) *Cache {
	client := redis.NewClient(&redis.Options{
		Addr: addr,
	})
	
	return &Cache{
		client: client,
		ctx:    context.Background(),
	}
}

func (c *Cache) SaveTask(task *models.Task) error {
	key := TaskPrefix + task.ID
	data, err := json.Marshal(task)
	if err != nil {
		return err
	}
	return c.client.Set(c.ctx, key, data, ResultTTL).Err()
}

func (c *Cache) GetTask(taskID string) (*models.Task, error) {
	key := TaskPrefix + taskID
	data, err := c.client.Get(c.ctx, key).Bytes()
	if err != nil {
		return nil, err
	}
	
	var task models.Task
	if err := json.Unmarshal(data, &task); err != nil {
		return nil, err
	}
	return &task, nil
}

func (c *Cache) UpdateTaskProgress(taskID string, completedChunks int) error {
	task, err := c.GetTask(taskID)
	if err != nil {
		return err
	}
	
	task.CompletedChunks = completedChunks
	if task.TotalChunks > 0 {
		task.Progress = int(float64(completedChunks) / float64(task.TotalChunks) * 100)
	}
	task.UpdatedAt = time.Now()
	
	if completedChunks == task.TotalChunks {
		task.Status = models.TaskStatusMerging
	}
	
	return c.SaveTask(task)
}

func (c *Cache) UpdateTaskStatus(taskID string, status models.TaskStatus, message string) error {
	task, err := c.GetTask(taskID)
	if err != nil {
		return err
	}
	
	task.Status = status
	task.Message = message
	task.UpdatedAt = time.Now()
	
	return c.SaveTask(task)
}

func (c *Cache) CacheAlignmentResult(hash string, result *models.AlignmentResult) error {
	key := SequencePrefix + hash
	data, err := json.Marshal(result)
	if err != nil {
		return err
	}
	return c.client.Set(c.ctx, key, data, SequenceTTL).Err()
}

func (c *Cache) GetCachedAlignment(hash string) (*models.AlignmentResult, error) {
	key := SequencePrefix + hash
	data, err := c.client.Get(c.ctx, key).Bytes()
	if err != nil {
		return nil, err
	}
	
	var result models.AlignmentResult
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

func (c *Cache) SaveChunkResult(chunkResult *models.ChunkResult) error {
	key := fmt.Sprintf("%s%s:chunk:%d", TaskResultPrefix, chunkResult.TaskID, chunkResult.ChunkID)
	data, err := json.Marshal(chunkResult)
	if err != nil {
		return err
	}
	return c.client.Set(c.ctx, key, data, ResultTTL).Err()
}

func (c *Cache) GetChunkResults(taskID string, totalChunks int) ([]*models.ChunkResult, error) {
	var results []*models.ChunkResult
	
	for i := 0; i < totalChunks; i++ {
		key := fmt.Sprintf("%s%s:chunk:%d", TaskResultPrefix, taskID, i)
		data, err := c.client.Get(c.ctx, key).Bytes()
		if err != nil {
			continue
		}
		
		var result models.ChunkResult
		if err := json.Unmarshal(data, &result); err != nil {
			continue
		}
		results = append(results, &result)
	}
	
	return results, nil
}

func (c *Cache) RegisterWorker(worker *models.WorkerInfo) error {
	key := WorkerPrefix + worker.ID
	data, err := json.Marshal(worker)
	if err != nil {
		return err
	}
	return c.client.Set(c.ctx, key, data, 5*time.Minute).Err()
}

func (c *Cache) GetWorker(workerID string) (*models.WorkerInfo, error) {
	key := WorkerPrefix + workerID
	data, err := c.client.Get(c.ctx, key).Bytes()
	if err != nil {
		return nil, err
	}
	
	var worker models.WorkerInfo
	if err := json.Unmarshal(data, &worker); err != nil {
		return nil, err
	}
	return &worker, nil
}

func (c *Cache) GetAllWorkers() ([]*models.WorkerInfo, error) {
	keys, err := c.client.Keys(c.ctx, WorkerPrefix+"*").Result()
	if err != nil {
		return nil, err
	}
	
	var workers []*models.WorkerInfo
	for _, key := range keys {
		data, err := c.client.Get(c.ctx, key).Bytes()
		if err != nil {
			continue
		}
		
		var worker models.WorkerInfo
		if err := json.Unmarshal(data, &worker); err != nil {
			continue
		}
		workers = append(workers, &worker)
	}
	
	return workers, nil
}

func (c *Cache) Close() error {
	return c.client.Close()
}

func (c *Cache) Ping() error {
	return c.client.Ping(c.ctx).Err()
}

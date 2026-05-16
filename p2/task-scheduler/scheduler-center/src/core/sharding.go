package core

import (
	"context"
	"crypto/sha256"
	"encoding/binary"
	"encoding/json"
	"sort"
	"time"

	"github.com/go-redis/redis/v8"
)

type Executor struct {
	ID        string  `json:"id"`
	Address   string  `json:"address"`
	CPU       float64 `json:"cpu"`
	Memory    float64 `json:"memory"`
	LastSeen  int64   `json:"last_seen"`
	TaskCount int     `json:"task_count"`
}

type Sharding struct {
	rdb     *redis.Client
	monitor *Monitor
	ctx     context.Context
}

func NewSharding(rdb *redis.Client, monitor *Monitor) *Sharding {
	return &Sharding{
		rdb:     rdb,
		monitor: monitor,
		ctx:     context.Background(),
	}
}

func (s *Sharding) hashTaskID(taskID string) uint64 {
	h := sha256.New()
	h.Write([]byte(taskID))
	hash := h.Sum(nil)
	return binary.BigEndian.Uint64(hash[:8])
}

func (s *Sharding) tryLockTask(taskID string, executorID string) (bool, error) {
	lockKey := "task:lock:" + taskID
	ok, err := s.rdb.SetNX(s.ctx, lockKey, executorID, 5*time.Minute).Result()
	if err != nil {
		return false, err
	}
	return ok, nil
}

func (s *Sharding) isExecutorOnline(executorID string) bool {
	executorData, err := s.rdb.HGet(s.ctx, "executors", executorID).Result()
	if err == redis.Nil {
		return false
	}
	if err != nil {
		return false
	}

	var executor Executor
	json.Unmarshal([]byte(executorData), &executor)

	now := time.Now().Unix()
	return now-executor.LastSeen <= 30
}

func (s *Sharding) SelectExecutor(taskID string, currentExecutorID string) (*Executor, error) {
	executors := s.monitor.GetExecutors()
	if len(executors) == 0 {
		return nil, nil
	}

	if currentExecutorID != "" {
		if s.isExecutorOnline(currentExecutorID) {
			for _, exec := range executors {
				if exec.ID == currentExecutorID {
					return &exec, nil
				}
			}
		}
	}

	locked, err := s.tryLockTask(taskID, "scheduler")
	if err != nil || !locked {
		if currentExecutorID != "" {
			for _, exec := range executors {
				if exec.ID == currentExecutorID {
					return &exec, nil
				}
			}
		}
		return nil, nil
	}

	sort.Slice(executors, func(i, j int) bool {
		loadI := executors[i].CPU + executors[i].Memory
		loadJ := executors[j].CPU + executors[j].Memory
		return loadI < loadJ
	})

	hash := s.hashTaskID(taskID)
	idx := int(hash % uint64(len(executors)))

	selectedExecutor := &executors[idx]

	s.rdb.HSet(s.ctx, "task:executor:binding", taskID, selectedExecutor.ID)

	s.rdb.Del(s.ctx, "task:lock:"+taskID)

	return selectedExecutor, nil
}

func (s *Sharding) GetTaskExecutorBinding(taskID string) (string, error) {
	return s.rdb.HGet(s.ctx, "task:executor:binding", taskID).Result()
}

func (s *Sharding) GetExecutors() ([]Executor, error) {
	executorsData, err := s.rdb.HGetAll(s.ctx, "executors").Result()
	if err != nil {
		return nil, err
	}

	executors := make([]Executor, 0, len(executorsData))
	for _, data := range executorsData {
		var executor Executor
		json.Unmarshal([]byte(data), &executor)
		executors = append(executors, executor)
	}

	return executors, nil
}

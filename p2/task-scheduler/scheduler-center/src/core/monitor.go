package core

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
)

type Monitor struct {
	rdb       *redis.Client
	ctx       context.Context
	executors map[string]Executor
	tasks     map[string]interface{}
	mu        sync.RWMutex
}

func NewMonitor(rdb *redis.Client) *Monitor {
	return &Monitor{
		rdb:       rdb,
		ctx:       context.Background(),
		executors: make(map[string]Executor),
		tasks:     make(map[string]interface{}),
	}
}

func (m *Monitor) Start() {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		m.syncExecutors()
		m.checkOfflineExecutors()
	}
}

func (m *Monitor) syncExecutors() {
	executorsData, err := m.rdb.HGetAll(m.ctx, "executors").Result()
	if err != nil {
		log.Printf("Failed to get executors: %v", err)
		return
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	for id, data := range executorsData {
		var executor Executor
		json.Unmarshal([]byte(data), &executor)
		m.executors[id] = executor
	}
}

func (m *Monitor) checkOfflineExecutors() {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now().Unix()
	offlineThreshold := int64(30)

	for id, executor := range m.executors {
		if now-executor.LastSeen > offlineThreshold {
			log.Printf("Executor %s is offline, removing", id)
			delete(m.executors, id)
			m.rdb.HDel(m.ctx, "executors", id)
		}
	}
}

func (m *Monitor) GetExecutors() []Executor {
	m.mu.RLock()
	defer m.mu.RUnlock()

	executors := make([]Executor, 0, len(m.executors))
	for _, executor := range m.executors {
		executors = append(executors, executor)
	}
	return executors
}

func (m *Monitor) AddTask(taskID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.tasks[taskID] = struct{}{}
}

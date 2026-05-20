package sensor

import (
	"log"
	"math/rand"
	"papermonitor/internal/config"
	"papermonitor/internal/models"
	"sync"
	"time"
)

type DataCollector struct {
	mu         sync.RWMutex
	listeners  []chan models.SensorData
	isRunning  bool
	dataQueue  chan models.SensorData
}

var Collector = &DataCollector{
	listeners: make([]chan models.SensorData, 0),
	dataQueue: make(chan models.SensorData, 1000),
}

func (dc *DataCollector) Start() {
	dc.mu.Lock()
	if dc.isRunning {
		dc.mu.Unlock()
		return
	}
	dc.isRunning = true
	dc.mu.Unlock()

	go dc.processDataQueue()
	go dc.collectSoakingData()
	go dc.collectBeatingData()
	go dc.collectPaperMakingData()

	log.Println("Sensor data collector started")
}

func (dc *DataCollector) processDataQueue() {
	for data := range dc.dataQueue {
		if err := config.DB.Create(&data).Error; err != nil {
			log.Printf("Failed to save sensor data: %v", err)
		}
		AnalyzeAndAlert(data)
		dc.broadcast(data)
	}
}

func (dc *DataCollector) Stop() {
	dc.mu.Lock()
	defer dc.mu.Unlock()
	if dc.isRunning {
		dc.isRunning = false
		close(dc.dataQueue)
	}
}

func (dc *DataCollector) Subscribe() chan models.SensorData {
	dc.mu.Lock()
	defer dc.mu.Unlock()
	ch := make(chan models.SensorData, 500)
	dc.listeners = append(dc.listeners, ch)
	return ch
}

func (dc *DataCollector) broadcast(data models.SensorData) {
	dc.mu.RLock()
	defer dc.mu.RUnlock()
	for i, listener := range dc.listeners {
		select {
		case listener <- data:
		case <-time.After(10 * time.Millisecond):
			log.Printf("Listener %d is full, skipping data broadcast", i)
		}
	}
}

func (dc *DataCollector) collectSoakingData() {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		dc.mu.RLock()
		if !dc.isRunning {
			dc.mu.RUnlock()
			return
		}
		dc.mu.RUnlock()

		data := models.SensorData{
			ProcessType:   models.ProcessSoaking,
			Timestamp:   time.Now(),
			Temperature: 30 + rand.Float64()*20,
			Humidity:    60 + rand.Float64()*30,
			Pressure:    1.0 + rand.Float64()*0.5,
			PHValue:     7.0 + rand.Float64()*2 - 1,
			Concentration: 2.0 + rand.Float64()*2,
			Speed:       0,
			DeviceID:    "SOAK-001",
			CreatedAt:   time.Now(),
		}

		dc.saveAndBroadcast(data)
	}
}

func (dc *DataCollector) collectBeatingData() {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		dc.mu.RLock()
		if !dc.isRunning {
			dc.mu.RUnlock()
			return
		}
		dc.mu.RUnlock()

		data := models.SensorData{
			ProcessType:   models.ProcessBeating,
			Timestamp:   time.Now(),
			Temperature: 25 + rand.Float64()*15,
			Humidity:    50 + rand.Float64()*30,
			Pressure:    1.2 + rand.Float64()*0.3,
			PHValue:     6.5 + rand.Float64()*2,
			Concentration: 2.5 + rand.Float64()*2,
			Speed:       200 + rand.Float64()*300,
			DeviceID:    "BEAT-001",
			CreatedAt:   time.Now(),
		}

		dc.saveAndBroadcast(data)
	}
}

func (dc *DataCollector) collectPaperMakingData() {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		dc.mu.RLock()
		if !dc.isRunning {
			dc.mu.RUnlock()
			return
		}
		dc.mu.RUnlock()

		data := models.SensorData{
			ProcessType:   models.ProcessPaperMaking,
			Timestamp:   time.Now(),
			Temperature: 28 + rand.Float64()*18,
			Humidity:    45 + rand.Float64()*35,
			Pressure:    1.1 + rand.Float64()*0.4,
			PHValue:     6.8 + rand.Float64()*1.8,
			Concentration: 2.2 + rand.Float64()*1.8,
			Speed:       80 + rand.Float64()*120,
			DeviceID:    "PAPER-001",
			CreatedAt:   time.Now(),
		}

		dc.saveAndBroadcast(data)
	}
}

func (dc *DataCollector) saveAndBroadcast(data models.SensorData) {
	select {
	case dc.dataQueue <- data:
	default:
		log.Printf("Data queue is full, dropping data for process: %s", data.ProcessType)
	}
}

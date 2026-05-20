package main

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/robfig/cron/v3"

	"edge-gateway/api"
	"edge-gateway/detector"
	"edge-gateway/ingester"
	"edge-gateway/models"
	"edge-gateway/mqtt_broker"
)

type SummaryManager struct {
	dataCleaner  *ingester.DataCleaner
	alertStore   *detector.AlertStore
	cloudURL     string
	hourlyData   map[string][]*models.CleanedData
	alertCounts  map[string]int
}

func NewSummaryManager(dataCleaner *ingester.DataCleaner, alertStore *detector.AlertStore, cloudURL string) *SummaryManager {
	return &SummaryManager{
		dataCleaner: dataCleaner,
		alertStore:  alertStore,
		cloudURL:    cloudURL,
		hourlyData:  make(map[string][]*models.CleanedData),
		alertCounts: make(map[string]int),
	}
}

func (sm *SummaryManager) RecordData(data *models.CleanedData) {
	sm.hourlyData[data.SensorID] = append(sm.hourlyData[data.SensorID], data)
}

func (sm *SummaryManager) RecordAlert(sensorID string) {
	sm.alertCounts[sensorID]++
}

func (sm *SummaryManager) GenerateAndSendSummary() {
	log.Println("Generating hourly summary...")
	
	now := time.Now().Truncate(time.Hour)
	sensors := sm.dataCleaner.GetAllSensors()

	for _, sensorID := range sensors {
		data := sm.hourlyData[sensorID]
		if len(data) == 0 {
			continue
		}

		summary := sm.generateSummary(sensorID, data, now)
		sm.sendSummaryToCloud(summary)
	}

	sm.hourlyData = make(map[string][]*models.CleanedData)
	sm.alertCounts = make(map[string]int)
	log.Println("Hourly summary sent to cloud")
}

func (sm *SummaryManager) generateSummary(sensorID string, data []*models.CleanedData, hour time.Time) *models.HourlySummary {
	tempSum, tempMin, tempMax := 0.0, data[0].Temp, data[0].Temp
	humSum, humMin, humMax := 0.0, data[0].Humidity, data[0].Humidity

	for _, d := range data {
		tempSum += d.Temp
		if d.Temp < tempMin {
			tempMin = d.Temp
		}
		if d.Temp > tempMax {
			tempMax = d.Temp
		}

		humSum += d.Humidity
		if d.Humidity < humMin {
			humMin = d.Humidity
		}
		if d.Humidity > humMax {
			humMax = d.Humidity
		}
	}

	count := len(data)
	return &models.HourlySummary{
		Hour:        hour,
		SensorID:    sensorID,
		TempAvg:     tempSum / float64(count),
		TempMin:     tempMin,
		TempMax:     tempMax,
		HumidityAvg: humSum / float64(count),
		HumidityMin: humMin,
		HumidityMax: humMax,
		DataPoints:  count,
		AlertCount:  sm.alertCounts[sensorID],
	}
}

func (sm *SummaryManager) sendSummaryToCloud(summary *models.HourlySummary) {
	jsonData, err := json.Marshal(summary)
	if err != nil {
		log.Printf("Failed to marshal summary: %v", err)
		return
	}

	resp, err := http.Post(sm.cloudURL+"/api/summary", "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		log.Printf("Failed to send summary to cloud: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("Cloud returned status: %d", resp.StatusCode)
	}
}

func main() {
	broker := mqtt_broker.NewBroker()
	defer broker.Disconnect()

	dataCleaner := ingester.NewDataCleaner()

	alertStore, err := detector.NewAlertStore("edge-gateway.db")
	if err != nil {
		log.Fatalf("Failed to create alert store: %v", err)
	}
	defer alertStore.Close()

	anomalyDetector := detector.NewAnomalyDetector(50)

	server := api.NewServer(dataCleaner, alertStore)

	summaryManager := NewSummaryManager(dataCleaner, alertStore, "http://localhost:3001")

	anomalyDetector.SetAlertCallback(func(alert *models.Alert) {
		log.Printf("ALERT: %s", alert.Message)
		if err := alertStore.Save(alert); err != nil {
			log.Printf("Failed to save alert: %v", err)
		}
		server.BroadcastAlert(alert)
		summaryManager.RecordAlert(alert.SensorID)
	})

	messageHandler := func(client mqtt.Client, msg mqtt.Message) {
		var data models.SensorData
		if err := json.Unmarshal(msg.Payload(), &data); err != nil {
			log.Printf("Failed to unmarshal sensor data: %v", err)
			return
		}

		cleaned, ok := dataCleaner.Clean(&data)
		if !ok {
			return
		}

		anomalyDetector.Detect(cleaned)

		server.BroadcastData(cleaned)

		summaryManager.RecordData(cleaned)
	}

	broker.Subscribe(messageHandler)

	c := cron.New()
	c.AddFunc("@hourly", func() {
		summaryManager.GenerateAndSendSummary()
	})
	c.Start()
	defer c.Stop()

	simulator := mqtt_broker.NewSensorSimulator(broker)
	go simulator.Start(50, 100)
	log.Println("Sensor simulator started with 50 sensors, reporting every 100ms")

	go func() {
		if err := server.Start(":8080"); err != nil {
			log.Fatalf("HTTP server error: %v", err)
		}
	}()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	simulator.Stop()
	log.Println("Shutting down gracefully...")
}

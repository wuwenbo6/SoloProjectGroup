package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/spf13/cobra"
	"modbus-mqtt-gateway/pkg/config"
	"modbus-mqtt-gateway/pkg/edge"
	"modbus-mqtt-gateway/pkg/metrics"
	mqttclient "modbus-mqtt-gateway/pkg/mqtt"
	"modbus-mqtt-gateway/pkg/pool"
	"modbus-mqtt-gateway/pkg/storage"
)

var (
	configPath string
	rootCmd    *cobra.Command
	gateway    *Gateway
)

type GatewayStatus struct {
	ModbusConnected map[string]bool `json:"modbusConnected"`
	MQTTConnected   bool            `json:"mqttConnected"`
	Uptime          string          `json:"uptime"`
	PollCount       int64           `json:"pollCount"`
	StorageStats    interface{}     `json:"storageStats"`
}

type Gateway struct {
	config        *config.Config
	mqttClient    *mqttclient.Client
	workerPool    *pool.WorkerPool
	storage       *storage.SQLiteStorage
	metrics       *metrics.Metrics
	status        GatewayStatus
	startTime     time.Time
	pollCount     int64
	running       bool
	stopChan      chan struct{}
	retryChan     chan struct{}
	mu            sync.RWMutex
	deviceStates  map[string]*deviceState
}

type deviceState struct {
	lastPoll  time.Time
	connected bool
}

func NewGateway(cfg *config.Config) *Gateway {
	return &Gateway{
		config:       cfg,
		startTime:    time.Now(),
		stopChan:     make(chan struct{}),
		retryChan:    make(chan struct{}, 1),
		deviceStates: make(map[string]*deviceState),
	}
}

func (g *Gateway) Start() error {
	g.mu.Lock()
	defer g.mu.Unlock()

	if g.running {
		return fmt.Errorf("gateway is already running")
	}

	mqttClient, err := mqttclient.NewClient(g.config.MQTT)
	if err != nil {
		return fmt.Errorf("failed to create mqtt client: %w", err)
	}
	g.mqttClient = mqttClient
	if err := g.mqttClient.Connect(); err != nil {
		log.Printf("Warning: Failed to connect to MQTT broker: %v", err)
	}

	if g.config.Storage.Enabled && g.storage != nil {
		g.mqttClient.SetStorage(g.storage)
	}

	g.workerPool = pool.NewWorkerPool(g.config.Pool.WorkerCount, g.config.Pool.QueueSize, &g.config.Edge)

	for _, device := range g.config.Devices {
		g.deviceStates[device.DeviceID] = &deviceState{}
		registers := device.Registers
		g.workerPool.GetOrCreateProcessor(device.DeviceID, registers)
	}

	if g.config.Storage.Enabled {
		storage, err := storage.NewSQLiteStorage(g.config.Storage.DBPath)
		if err != nil {
			return fmt.Errorf("failed to create storage: %w", err)
		}
		g.storage = storage
	}

	if g.config.Metrics.Enabled {
		g.metrics = metrics.GetInstance()
	}

	g.workerPool.Start()

	go g.processResults()
	go g.schedulePolls()
	if g.config.Storage.Enabled {
		go g.retryUnpublished()
	}

	g.running = true
	return nil
}

func (g *Gateway) Stop() {
	g.mu.Lock()
	defer g.mu.Unlock()

	if !g.running {
		return
	}

	close(g.stopChan)
	g.workerPool.Stop()

	if g.mqttClient != nil {
		g.mqttClient.Disconnect()
	}

	if g.storage != nil {
		g.storage.Close()
	}

	g.running = false
}

func (g *Gateway) schedulePolls() {
	tickers := make(map[string]*time.Ticker)
	for _, device := range g.config.Devices {
		interval := time.Duration(device.Modbus.PollInterval) * time.Millisecond
		tickers[device.DeviceID] = time.NewTicker(interval)
		defer tickers[device.DeviceID].Stop()
	}

	for {
		select {
		case <-g.stopChan:
			return
		default:
			for _, device := range g.config.Devices {
				select {
				case <-tickers[device.DeviceID].C:
					task := pool.Task{
						DeviceID:  device.DeviceID,
						ModbusCfg: device.Modbus,
						Registers: device.Registers,
					}
					if err := g.workerPool.Submit(task); err != nil {
						log.Printf("Failed to submit task for %s: %v", device.DeviceID, err)
					}
				default:
				}
			}
			time.Sleep(100 * time.Millisecond)
		}
	}
}

func (g *Gateway) processResults() {
	g.workerPool.ProcessResults(func(result pool.Result, processed []edge.ProcessedData) {
		g.mu.Lock()
		g.pollCount++
		g.mu.Unlock()

		state, exists := g.deviceStates[result.DeviceID]
		if exists {
			state.lastPoll = time.Now()
			state.connected = result.Err == nil
		}

		if g.metrics != nil {
			g.metrics.IncPollCount(result.DeviceID)
			g.metrics.ObservePollDuration(result.DeviceID, time.Since(result.Time))
			g.metrics.SetDeviceStatus(result.DeviceID, result.Err == nil)
		}

		if result.Err != nil {
			log.Printf("Poll error for %s: %v", result.DeviceID, result.Err)
			if g.metrics != nil {
				g.metrics.IncPollErrors(result.DeviceID)
			}
		}

		if g.storage != nil {
			if err := g.storage.SaveProcessedData(result.DeviceID, processed); err != nil {
				log.Printf("Failed to save data for %s: %v", result.DeviceID, err)
			}
		}

		var toReport []edge.ProcessedData
		for _, p := range processed {
			if g.metrics != nil {
				g.metrics.IncDataPoints(result.DeviceID, p.Name)
			}
			if p.ShouldReport {
				toReport = append(toReport, p)
				if g.metrics != nil {
					g.metrics.IncDataPointsReported(result.DeviceID, p.Name)
				}
			}
		}

		if len(toReport) > 0 {
			topic := fmt.Sprintf("%s/%s", g.config.MQTT.Topic, result.DeviceID)
			start := time.Now()
			if err := g.mqttClient.PublishData(toReport, result.DeviceID); err != nil {
				log.Printf("Failed to publish data for %s: %v", result.DeviceID, err)
				if g.metrics != nil {
					g.metrics.IncMQTTPublishErrors(topic)
				}
				g.triggerRetry()
			} else {
				if g.metrics != nil {
					g.metrics.IncMQTTPublish(topic)
					g.metrics.ObserveMQTTPublishLatency(topic, time.Since(start))
				}
			}
		}
	})
}

func (g *Gateway) retryUnpublished() {
	retryTicker := time.NewTicker(30 * time.Second)
	defer retryTicker.Stop()

	cleanupTicker := time.NewTicker(1 * time.Hour)
	defer cleanupTicker.Stop()

	for {
		select {
		case <-g.stopChan:
			return
		case <-g.retryChan:
			g.doRetry()
		case <-retryTicker.C:
			g.doRetry()
		case <-cleanupTicker.C:
			g.doCleanup()
		}
	}
}

func (g *Gateway) triggerRetry() {
	select {
	case g.retryChan <- struct{}{}:
	default:
	}
}

func (g *Gateway) doRetry() {
	if g.storage == nil {
		return
	}

	records, err := g.storage.GetUnpublishedPayloads(g.config.Storage.RetryBatchSize, g.config.Storage.MaxRetries)
	if err != nil {
		log.Printf("Failed to get unpublished payloads: %v", err)
		return
	}

	if len(records) == 0 {
		return
	}

	log.Printf("Retrying %d unpublished payloads", len(records))

	for _, record := range records {
		start := time.Now()
		topic := record.Topic
		if topic == "" {
			topic = g.config.MQTT.Topic
		}

		if err := g.mqttClient.Publish(topic, record.Payload); err != nil {
			log.Printf("Failed to retry publish for %s: %v", record.DeviceID, err)
			if g.metrics != nil {
				g.metrics.IncMQTTPublishErrors(topic)
			}
			g.storage.IncrementRetryCount(record.ID)
		} else {
			g.storage.MarkPayloadPublished(record.ID)
			if g.metrics != nil {
				g.metrics.IncMQTTPublish(topic)
				g.metrics.ObserveMQTTPublishLatency(topic, time.Since(start))
			}
		}
	}

	g.updateStorageMetrics()
}

func (g *Gateway) doCleanup() {
	if g.storage == nil {
		return
	}

	cutoff := time.Duration(g.config.Storage.CleanupDays) * 24 * time.Hour
	deletedData, _ := g.storage.CleanupPublishedData(cutoff)
	deletedPayloads, _ := g.storage.CleanupPublishedPayloads(cutoff)

	if deletedData > 0 || deletedPayloads > 0 {
		log.Printf("Cleanup: removed %d data records, %d payloads", deletedData, deletedPayloads)
	}

	g.updateStorageMetrics()
}

func (g *Gateway) updateStorageMetrics() {
	if g.storage == nil || g.metrics == nil {
		return
	}

	stats, err := g.storage.GetStats()
	if err != nil {
		return
	}

	if statsMap, ok := stats.(map[string]interface{}); ok {
		if total, ok := statsMap["total_data_records"].(int64); ok {
			g.metrics.SetCacheSize("data", float64(total))
		}
		if unpublished, ok := statsMap["unpublished_data_records"].(int64); ok {
			g.metrics.SetCacheUnpublished("data", float64(unpublished))
		}
		if total, ok := statsMap["total_payloads"].(int64); ok {
			g.metrics.SetCacheSize("payload", float64(total))
		}
		if unpublished, ok := statsMap["unpublished_payloads"].(int64); ok {
			g.metrics.SetCacheUnpublished("payload", float64(unpublished))
		}
	}
}

func (g *Gateway) ReloadConfig() error {
	newConfig, err := config.Reload()
	if err != nil {
		return fmt.Errorf("failed to reload config: %w", err)
	}

	g.mu.Lock()
	defer g.mu.Unlock()

	g.config = newConfig

	deviceRegisters := make(map[string][]config.RegisterConfig)
	for _, device := range newConfig.Devices {
		deviceRegisters[device.DeviceID] = device.Registers
	}
	g.workerPool.UpdateProcessorConfig(&newConfig.Edge, deviceRegisters)

	if g.mqttClient != nil {
		g.mqttClient.Disconnect()
	}
	mqttClient, err := mqttclient.NewClient(newConfig.MQTT)
	if err != nil {
		return fmt.Errorf("failed to recreate mqtt client: %w", err)
	}
	g.mqttClient = mqttClient
	if err := g.mqttClient.Connect(); err != nil {
		log.Printf("Warning: Failed to connect to MQTT broker: %v", err)
	}

	return nil
}

func (g *Gateway) GetStatus() GatewayStatus {
	g.mu.RLock()
	defer g.mu.RUnlock()

	modbusConnected := make(map[string]bool)
	for id, state := range g.deviceStates {
		modbusConnected[id] = state.connected
	}

	var storageStats interface{}
	if g.storage != nil {
		stats, _ := g.storage.GetStats()
		storageStats = stats
	}

	return GatewayStatus{
		ModbusConnected: modbusConnected,
		MQTTConnected:   g.mqttClient != nil && g.mqttClient.IsConnected(),
		Uptime:          time.Since(g.startTime).String(),
		PollCount:       g.pollCount,
		StorageStats:    storageStats,
	}
}

func init() {
	rootCmd = &cobra.Command{
		Use:   "modbus-mqtt-gateway",
		Short: "Modbus to MQTT Gateway",
		Long:  `A gateway application that reads Modbus TCP devices and publishes data to MQTT broker.`,
	}

	rootCmd.PersistentFlags().StringVarP(&configPath, "config", "c", "configs/config.yaml", "Path to config file")

	startCmd := &cobra.Command{
		Use:   "start",
		Short: "Start the gateway",
		Run:   runStart,
	}

	statusCmd := &cobra.Command{
		Use:   "status",
		Short: "Check gateway status",
		Run:   runStatus,
	}

	reloadCmd := &cobra.Command{
		Use:   "reload",
		Short: "Reload gateway configuration",
		Run:   runReload,
	}

	rootCmd.AddCommand(startCmd, statusCmd, reloadCmd)
}

func runStart(cmd *cobra.Command, args []string) {
	cfg, err := config.Load(configPath)
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	gateway = NewGateway(cfg)

	setupHTTPServer()

	if err := gateway.Start(); err != nil {
		log.Fatalf("Failed to start gateway: %v", err)
	}

	log.Println("Gateway started successfully")

	select {}
}

func setupHTTPServer() {
	http.HandleFunc("/status", func(w http.ResponseWriter, r *http.Request) {
		status := gateway.GetStatus()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(status)
	})

	http.HandleFunc("/reload", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if err := gateway.ReloadConfig(); err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	if gateway.config.Metrics.Enabled {
		http.Handle(gateway.config.Metrics.Path, gateway.metrics.Handler())
	}

	go func() {
		if err := http.ListenAndServe(":8080", nil); err != nil {
			log.Printf("HTTP server error: %v", err)
		}
	}()
}

func runStatus(cmd *cobra.Command, args []string) {
	resp, err := http.Get("http://localhost:8080/status")
	if err != nil {
		log.Fatalf("Failed to get status: %v", err)
	}
	defer resp.Body.Close()

	var status map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&status)
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	enc.Encode(status)
}

func runReload(cmd *cobra.Command, args []string) {
	req, err := http.NewRequest(http.MethodPost, "http://localhost:8080/reload", nil)
	if err != nil {
		log.Fatalf("Failed to create request: %v", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Fatalf("Failed to reload config: %v", err)
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	enc.Encode(result)
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}

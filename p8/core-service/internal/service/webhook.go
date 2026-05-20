package service

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"go.uber.org/zap"

	"iot-core-service/internal/models"
)

const (
	maxWebhookRetries   = 3
	webhookTimeout      = 10 * time.Second
	webhookRetryDelay   = 2 * time.Second
	maxConcurrentWebhooks = 20
)

type WebhookConfig struct {
	URL         string            `json:"url"`
	Secret      string            `json:"secret,omitempty"`
	Headers     map[string]string `json:"headers,omitempty"`
	Enabled     bool              `json:"enabled"`
	AlertTypes  []string          `json:"alert_types,omitempty"`
}

type WebhookService struct {
	logger      *zap.Logger
	configs     map[string][]WebhookConfig
	configMutex sync.RWMutex
	semaphore   chan struct{}
	httpClient  *http.Client
}

type WebhookPayload struct {
	EventID     string          `json:"event_id"`
	EventType   string          `json:"event_type"`
	DeviceID    string          `json:"device_id"`
	Timestamp   time.Time       `json:"timestamp"`
	Anomalies   []models.AnomalyResult `json:"anomalies"`
	Severity    string          `json:"severity"`
	Message     string          `json:"message"`
}

func NewWebhookService(logger *zap.Logger) *WebhookService {
	return &WebhookService{
		logger:    logger,
		configs:   make(map[string][]WebhookConfig),
		semaphore: make(chan struct{}, maxConcurrentWebhooks),
		httpClient: &http.Client{
			Timeout: webhookTimeout,
			Transport: &http.Transport{
				MaxIdleConns:        100,
				MaxIdleConnsPerHost: 10,
				IdleConnTimeout:     90 * time.Second,
			},
		},
	}
}

func (w *WebhookService) RegisterWebhook(deviceID string, config WebhookConfig) {
	w.configMutex.Lock()
	defer w.configMutex.Unlock()

	if _, exists := w.configs[deviceID]; !exists {
		w.configs[deviceID] = make([]WebhookConfig, 0)
	}

	w.configs[deviceID] = append(w.configs[deviceID], config)
	w.logger.Info("Webhook registered",
		zap.String("device_id", deviceID),
		zap.String("url", config.URL))
}

func (w *WebhookService) GetWebhooks(deviceID string) []WebhookConfig {
	w.configMutex.RLock()
	defer w.configMutex.RUnlock()

	if configs, exists := w.configs[deviceID]; exists {
		result := make([]WebhookConfig, len(configs))
		copy(result, configs)
		return result
	}

	global := make([]WebhookConfig, 0)
	if configs, exists := w.configs["*"]; exists {
		global = append(global, configs...)
	}

	return global
}

func (w *WebhookService) SendAlert(ctx context.Context, deviceID string, anomalies []models.AnomalyResult) {
	configs := w.GetWebhooks(deviceID)
	if len(configs) == 0 {
		return
	}

	severity := w.calculateSeverity(anomalies)
	message := w.generateMessage(deviceID, anomalies)

	payload := WebhookPayload{
		EventID:   fmt.Sprintf("%d", time.Now().UnixNano()),
		EventType: "anomaly_alert",
		DeviceID:  deviceID,
		Timestamp: time.Now(),
		Anomalies: anomalies,
		Severity:  severity,
		Message:   message,
	}

	for _, config := range configs {
		if !config.Enabled {
			continue
		}

		if len(config.AlertTypes) > 0 {
			hasMatchingType := false
			for _, anomaly := range anomalies {
				for _, alertType := range config.AlertTypes {
					if anomaly.AnomalyType == alertType {
						hasMatchingType = true
						break
					}
				}
				if hasMatchingType {
					break
				}
			}
			if !hasMatchingType {
				continue
			}
		}

		select {
		case w.semaphore <- struct{}{}:
			go w.sendWithRetry(config, payload)
		default:
			w.logger.Warn("Webhook concurrency limit reached, skipping alert",
				zap.String("device_id", deviceID),
				zap.String("url", config.URL))
		}
	}
}

func (w *WebhookService) sendWithRetry(config WebhookConfig, payload WebhookPayload) {
	defer func() { <-w.semaphore }()

	var lastErr error
	for i := 0; i < maxWebhookRetries; i++ {
		if err := w.send(config, payload); err != nil {
			lastErr = err
			w.logger.Warn("Webhook send failed, retrying",
				zap.String("url", config.URL),
				zap.Int("attempt", i+1),
				zap.Error(err))
			time.Sleep(webhookRetryDelay * time.Duration(i+1))
			continue
		}

		w.logger.Info("Webhook alert sent successfully",
			zap.String("url", config.URL),
			zap.String("device_id", payload.DeviceID))
		return
	}

	w.logger.Error("Webhook alert failed after max retries",
		zap.String("url", config.URL),
		zap.Error(lastErr))
}

func (w *WebhookService) send(config WebhookConfig, payload WebhookPayload) error {
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	req, err := http.NewRequest("POST", config.URL, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	for key, value := range config.Headers {
		req.Header.Set(key, value)
	}

	if config.Secret != "" {
		signature := w.generateSignature(jsonData, config.Secret)
		req.Header.Set("X-Webhook-Signature", signature)
	}

	resp, err := w.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	return nil
}

func (w *WebhookService) generateSignature(data []byte, secret string) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write(data)
	return "sha256=" + hex.EncodeToString(h.Sum(nil))
}

func (w *WebhookService) calculateSeverity(anomalies []models.AnomalyResult) string {
	maxConfidence := 0.0
	for _, a := range anomalies {
		if a.Confidence > maxConfidence {
			maxConfidence = a.Confidence
		}
	}

	switch {
	case maxConfidence >= 0.9:
		return "critical"
	case maxConfidence >= 0.7:
		return "warning"
	default:
		return "info"
	}
}

func (w *WebhookService) generateMessage(deviceID string, anomalies []models.AnomalyResult) string {
	if len(anomalies) == 0 {
		return ""
	}

	if len(anomalies) == 1 {
		a := anomalies[0]
		return fmt.Sprintf("Device %s detected %s on metric %s (confidence: %.2f)",
			deviceID, a.AnomalyType, a.Metric, a.Confidence)
	}

	types := make(map[string]int)
	for _, a := range anomalies {
		types[a.AnomalyType]++
	}

	typeList := ""
	for t, count := range types {
		if typeList != "" {
			typeList += ", "
		}
		typeList += fmt.Sprintf("%s (%d)", t, count)
	}

	return fmt.Sprintf("Device %s detected %d anomalies: %s",
		deviceID, len(anomalies), typeList)
}

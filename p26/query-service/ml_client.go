package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"
)

type MLClient struct {
	baseURL    string
	httpClient *http.Client
}

type AnomalyPrediction struct {
	TraceID            string                 `json:"trace_id"`
	AnomalyScore       float64              `json:"anomaly_score"`
	AnomalyLevel       string               `json:"anomaly_level"`
	IsAnomaly           bool                 `json:"is_anomaly"`
	Features            map[string]float64    `json:"features"`
	ContributingFactors []string             `json:"contributing_factors"`
	Timestamp           string               `json:"timestamp"`
}

type BatchPredictionResponse struct {
	Total          int                `json:"total"`
	AnomaliesCount int                `json:"anomalies_count"`
	AnomalyRate    float64            `json:"anomaly_rate"`
	Results        []AnomalyPrediction `json:"results"`
}

type ModelInfo struct {
	ModelType         string  `json:"model_type"`
	NEstimators      int     `json:"n_estimators"`
	MaxSamples        string  `json:"max_samples"`
	Contamination     float64 `json:"contamination"`
	Scaler            string  `json:"scaler"`
	FeatureDimensions int     `json:"feature_dimensions"`
}

var (
	mlClient *MLClient
	mlOnce  sync.Once
)

func GetMLClient() *MLClient {
	mlOnce.Do(func() {
		baseURL := os.Getenv("ML_SERVICE_URL")
		if baseURL == "" {
			baseURL = "http://ml-service:5000"
		}
		mlClient = &MLClient{
			baseURL: baseURL,
			httpClient: &http.Client{
				Timeout: 30 * time.Second,
			},
		}
	})
	return mlClient
}

func (c *MLClient) HealthCheck() (bool, error) {
	resp, err := c.httpClient.Get(fmt.Sprintf("%s/health", c.baseURL))
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()
	return resp.StatusCode == http.StatusOK, nil
}

func (c *MLClient) PredictAnomaly(ctx context.Context, trace *Trace) (*AnomalyPrediction, error) {
	url := fmt.Sprintf("%s/api/v1/predict", c.baseURL)
	
	requestBody := map[string]interface{}{
		"trace": trace,
	}
	
	jsonBody, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}
	
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("ML service request failed: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ML service returned status: %d", resp.StatusCode)
	}
	
	var prediction AnomalyPrediction
	if err := json.NewDecoder(resp.Body).Decode(&prediction); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}
	
	return &prediction, nil
}

func (c *MLClient) PredictBatch(ctx context.Context, traces []*Trace) (*BatchPredictionResponse, error) {
	url := fmt.Sprintf("%s/api/v1/predict/batch", c.baseURL)
	
	requestBody := map[string]interface{}{
		"traces": traces,
	}
	
	jsonBody, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}
	
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("ML service request failed: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ML service returned status: %d", resp.StatusCode)
	}
	
	var result BatchPredictionResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}
	
	return &result, nil
}

func (c *MLClient) TrainModel(ctx context.Context, traces []*Trace, contamination float64) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/api/v1/train", c.baseURL)
	
	requestBody := map[string]interface{}{
		"traces":        traces,
		"contamination": contamination,
		"n_estimators":  100,
	}
	
	jsonBody, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}
	
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("ML service request failed: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ML service returned status: %d", resp.StatusCode)
	}
	
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}
	
	return result, nil
}

func (c *MLClient) GetModelInfo(ctx context.Context) (*ModelInfo, error) {
	url := fmt.Sprintf("%s/api/v1/model/info", c.baseURL)
	
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("ML service request failed: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ML service returned status: %d", resp.StatusCode)
	}
	
	var info ModelInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}
	
	return &info, nil
}

func DetectAnomalies(traces []Trace) ([]AnomalyPrediction, error) {
	client := GetMLClient()
	
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	
	tracePtrs := make([]*Trace, len(traces))
	for i := range traces {
		tracePtrs[i] = &traces[i]
	}
	
	result, err := client.PredictBatch(ctx, tracePtrs)
	if err != nil {
		log.Printf("ML prediction failed: %v", err)
		return nil, err
	}
	
	log.Printf("Anomaly detection complete: %d anomalies in %d traces (%.2f%% rate)",
		result.AnomaliesCount, result.Total, result.AnomalyRate*100)
	
	return result.Results, nil
}

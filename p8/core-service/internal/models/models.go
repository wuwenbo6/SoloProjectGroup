package models

import (
	"time"
)

type DeviceDataPoint struct {
	DeviceID  string             `json:"device_id" binding:"required"`
	Timestamp int64              `json:"timestamp" binding:"required"`
	Metrics   map[string]float64 `json:"metrics" binding:"required"`
}

type BatchDataRequest struct {
	DataPoints []DeviceDataPoint `json:"data_points" binding:"required,min=1"`
}

type BatchDataResponse struct {
	SuccessCount int      `json:"success_count"`
	FailedCount  int      `json:"failed_count"`
	Errors       []string `json:"errors,omitempty"`
}

type QueryRequest struct {
	DeviceID    string    `json:"device_id" binding:"required"`
	StartTime   time.Time `json:"start_time" binding:"required"`
	EndTime     time.Time `json:"end_time" binding:"required"`
	MetricType  string    `json:"metric_type,omitempty"`
	Aggregation string    `json:"aggregation" binding:"required,oneof=mean max min count"`
}

type QueryResult struct {
	Timestamp time.Time `json:"timestamp"`
	DeviceID  string    `json:"device_id"`
	Metric    string    `json:"metric"`
	Value     float64   `json:"value"`
}

type QueryResponse struct {
	Data  []QueryResult `json:"data"`
	Count int           `json:"count"`
}

type AnomalyResult struct {
	AnomalyType string    `json:"anomaly_type"`
	Confidence  float64   `json:"confidence"`
	Timestamp   int64     `json:"timestamp"`
	Metric      string    `json:"metric"`
	Description string    `json:"description,omitempty"`
}

type AnomalyDetectionResponse struct {
	DeviceID   string          `json:"device_id"`
	Anomalies  []AnomalyResult `json:"anomalies"`
	HasAnomaly bool            `json:"has_anomaly"`
}

type Device struct {
	ID         int       `json:"id"`
	DeviceID   string    `json:"device_id"`
	DeviceName string    `json:"device_name"`
	DeviceType string    `json:"device_type"`
	Status     string    `json:"status"`
	LastSeen   time.Time `json:"last_seen"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type AnomalyRecord struct {
	ID           int       `json:"id"`
	DeviceID     string    `json:"device_id"`
	AnomalyType  string    `json:"anomaly_type"`
	Confidence   float64   `json:"confidence"`
	Metric       string    `json:"metric"`
	Timestamp    time.Time `json:"timestamp"`
	Description  string    `json:"description,omitempty"`
	DataJSON     string    `json:"data_json,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}

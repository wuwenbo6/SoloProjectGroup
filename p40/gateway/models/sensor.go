package models

import (
	"encoding/json"
	"time"
)

type SensorData struct {
	SensorID  string    `json:"sensor_id"`
	Timestamp time.Time `json:"timestamp"`
	Temp      float64   `json:"temp"`
	Humidity  float64   `json:"humidity"`
}

type CleanedData struct {
	SensorData
	IsInterpolated bool `json:"is_interpolated,omitempty"`
	MissingDurationMs int64 `json:"missing_duration_ms,omitempty"`
	MissingCount int `json:"missing_count,omitempty"`
	InterpolationMethod string `json:"interpolation_method,omitempty"`
	CurrentSampleRateMs int `json:"current_sample_rate_ms,omitempty"`
	SampleRateChanged bool `json:"sample_rate_changed,omitempty"`
	WasSkipped bool `json:"was_skipped,omitempty"`
}

type Alert struct {
	ID        string    `json:"id"`
	SensorID  string    `json:"sensor_id"`
	Timestamp time.Time `json:"timestamp"`
	Type      string    `json:"type"`
	Metric    string    `json:"metric"`
	Value     float64   `json:"value"`
	Message   string    `json:"message"`
}

type HourlySummary struct {
	Hour         time.Time `json:"hour"`
	SensorID     string    `json:"sensor_id"`
	TempAvg      float64   `json:"temp_avg"`
	TempMin      float64   `json:"temp_min"`
	TempMax      float64   `json:"temp_max"`
	HumidityAvg  float64   `json:"humidity_avg"`
	HumidityMin  float64   `json:"humidity_min"`
	HumidityMax  float64   `json:"humidity_max"`
	DataPoints   int       `json:"data_points"`
	AlertCount   int       `json:"alert_count"`
}

func (d *SensorData) MarshalJSON() ([]byte, error) {
	type Alias SensorData
	return json.Marshal(&struct {
		Timestamp int64 `json:"timestamp"`
		*Alias
	}{
		Timestamp: d.Timestamp.UnixMilli(),
		Alias:     (*Alias)(d),
	})
}

func (d *SensorData) UnmarshalJSON(data []byte) error {
	type Alias SensorData
	aux := &struct {
		Timestamp int64 `json:"timestamp"`
		*Alias
	}{
		Alias: (*Alias)(d),
	}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	d.Timestamp = time.UnixMilli(aux.Timestamp)
	return nil
}

func (a *Alert) MarshalJSON() ([]byte, error) {
	type Alias Alert
	return json.Marshal(&struct {
		Timestamp int64 `json:"timestamp"`
		*Alias
	}{
		Timestamp: a.Timestamp.UnixMilli(),
		Alias:     (*Alias)(a),
	})
}

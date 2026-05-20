package models

import "time"

type EdgeDevice struct {
	ID          string    `json:"id" gorm:"primaryKey"`
	Name        string    `json:"name"`
	Location    string    `json:"location"`
	Status      string    `json:"status"`
	LastHeartbeat time.Time `json:"last_heartbeat"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type CollectedData struct {
	ID         string    `json:"id" gorm:"primaryKey"`
	EdgeID     string    `json:"edge_id" gorm:"index"`
	DeviceID   string    `json:"device_id" gorm:"index"`
	DataType   string    `json:"data_type"`
	Timestamp  time.Time `json:"timestamp" gorm:"index"`
	DataShape  []int     `json:"data_shape" gorm:"type:integer[]"`
	DataPath   string    `json:"data_path"`
	Metadata   string    `json:"metadata,omitempty" gorm:"type:text"`
	CreatedAt  time.Time `json:"created_at"`
}

type InferenceResult struct {
	ID         string    `json:"id" gorm:"primaryKey"`
	EdgeID     string    `json:"edge_id" gorm:"index"`
	DataID     string    `json:"data_id"`
	DeviceID   string    `json:"device_id" gorm:"index"`
	PestType   string    `json:"pest_type" gorm:"index"`
	Confidence float64   `json:"confidence"`
	ModelType  string    `json:"model_type"`
	Timestamp  time.Time `json:"timestamp" gorm:"index"`
	Metadata   string    `json:"metadata,omitempty" gorm:"type:text"`
	CreatedAt  time.Time `json:"created_at"`
}

type PestKnowledge struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	PestType    string    `json:"pest_type" gorm:"uniqueIndex"`
	NameZh      string    `json:"name_zh"`
	Description string    `json:"description" gorm:"type:text"`
	Damage      string    `json:"damage" gorm:"type:text"`
	Control     string    `json:"control" gorm:"type:text"`
	ImageURL    string    `json:"image_url,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type ModelVersion struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	ModelType   string    `json:"model_type" gorm:"index"`
	Version     string    `json:"version"`
	DownloadURL string    `json:"download_url"`
	Checksum    string    `json:"checksum"`
	ReleaseNotes string   `json:"release_notes,omitempty" gorm:"type:text"`
	CreatedAt   time.Time `json:"created_at"`
}

type Alert struct {
	ID         uint      `json:"id" gorm:"primaryKey"`
	EdgeID     string    `json:"edge_id" gorm:"index"`
	AlertType  string    `json:"alert_type"`
	Severity   string    `json:"severity"`
	Message    string    `json:"message" gorm:"type:text"`
	Timestamp  time.Time `json:"timestamp" gorm:"index"`
	Resolved   bool      `json:"resolved" gorm:"default:false"`
	Metadata   string    `json:"metadata,omitempty" gorm:"type:text"`
}

type BatchDataRequest struct {
	EdgeID string           `json:"edge_id"`
	Data   []CollectedData `json:"data"`
}

type BatchResultsRequest struct {
	EdgeID  string             `json:"edge_id"`
	Results []InferenceResult `json:"results"`
}

type StatisticsResponse struct {
	TotalDevices      int            `json:"total_devices"`
	OnlineDevices     int            `json:"online_devices"`
	TotalInferences   int64          `json:"total_inferences"`
	PestDistribution  map[string]int64 `json:"pest_distribution"`
	DailyInferences   []DailyStat    `json:"daily_inferences"`
}

type DailyStat struct {
	Date  string `json:"date"`
	Count int64  `json:"count"`
}

package models

import (
	"time"
	"gorm.io/gorm"
)

type MaterialType string

const (
	MaterialLeather  MaterialType = "皮革"
	MaterialPaper    MaterialType = "纸张"
	MaterialWood     MaterialType = "木材"
	MaterialFabric   MaterialType = "织物"
	MaterialPlastic  MaterialType = "塑料"
)

type AlertLevel string

const (
	AlertLevelNormal AlertLevel = "normal"
	AlertLevelWarn   AlertLevel = "warning"
	AlertLevelError  AlertLevel = "error"
)

type DeviceStatus string

const (
	DeviceOnline  DeviceStatus = "online"
	DeviceOffline DeviceStatus = "offline"
	DeviceBusy    DeviceStatus = "busy"
	DeviceError   DeviceStatus = "error"
)

type DetectionRecord struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
	DeviceID    string         `gorm:"index;size:50" json:"device_id"`
	BatchNo     string         `gorm:"size:50" json:"batch_no"`
	MaterialType MaterialType  `gorm:"size:20" json:"material_type"`
	Thickness   float64        `json:"thickness"`
	Hardness    float64        `json:"hardness"`
	TensileStrength float64   `json:"tensile_strength"`
	Moisture    float64        `json:"moisture"`
	ColorValue  string         `gorm:"size:20" json:"color_value"`
	QualityScore float64       `json:"quality_score"`
	AlertLevel  AlertLevel     `gorm:"size:20" json:"alert_level"`
	IsQualified bool           `json:"is_qualified"`
	Remark      string         `gorm:"size:500" json:"remark"`
}

type MaterialParam struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	MaterialType MaterialType  `gorm:"uniqueIndex;size:20" json:"material_type"`
	MinThickness float64       `json:"min_thickness"`
	MaxThickness float64       `json:"max_thickness"`
	MinHardness float64        `json:"min_hardness"`
	MaxHardness float64        `json:"max_hardness"`
	MinTensileStrength float64 `json:"min_tensile_strength"`
	MaxTensileStrength float64 `json:"max_tensile_strength"`
	MinMoisture float64        `json:"min_moisture"`
	MaxMoisture float64        `json:"max_moisture"`
	PassScore   float64        `json:"pass_score"`
	WarnThreshold float64      `json:"warn_threshold"`
	Description string         `gorm:"size:500" json:"description"`
}

type DeviceInfo struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeviceID    string         `gorm:"uniqueIndex;size:50" json:"device_id"`
	DeviceName  string         `gorm:"size:100" json:"device_name"`
	DeviceType  string         `gorm:"size:50" json:"device_type"`
	Status      DeviceStatus   `gorm:"size:20" json:"status"`
	Location    string         `gorm:"size:100" json:"location"`
	IPAddress   string         `gorm:"size:50" json:"ip_address"`
	LastOnline  time.Time      `json:"last_online"`
	Temperature float64        `json:"temperature"`
	DetectionCount int64       `json:"detection_count"`
	Remark      string         `gorm:"size:500" json:"remark"`
}

type AlertRecord struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	CreatedAt   time.Time      `json:"created_at"`
	DeviceID    string         `gorm:"index;size:50" json:"device_id"`
	AlertLevel  AlertLevel     `gorm:"size:20" json:"alert_level"`
	AlertType   string         `gorm:"size:50" json:"alert_type"`
	Message     string         `gorm:"size:500" json:"message"`
	RecordID    *uint          `json:"record_id"`
	IsHandled   bool           `json:"is_handled"`
	HandledAt   *time.Time     `json:"handled_at"`
	HandledBy   string         `gorm:"size:50" json:"handled_by"`
}

type DetectionStats struct {
	Date          string  `json:"date"`
	TotalCount    int64   `json:"total_count"`
	PassCount     int64   `json:"pass_count"`
	FailCount     int64   `json:"fail_count"`
	PassRate      float64 `json:"pass_rate"`
	AvgScore      float64 `json:"avg_score"`
}

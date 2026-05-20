package models

import (
	"time"
	"gorm.io/gorm"
)

type ProcessType string

const (
	ProcessSoaking  ProcessType = "soaking"
	ProcessBeating  ProcessType = "beating"
	ProcessPaperMaking ProcessType = "papermaking"
)

type AlertLevel string

const (
	AlertLevelInfo    AlertLevel = "info"
	AlertLevelWarning AlertLevel = "warning"
	AlertLevelError   AlertLevel = "error"
	AlertLevelCritical AlertLevel = "critical"
)

type SensorData struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	ProcessType ProcessType    `gorm:"index;not null" json:"process_type"`
	Timestamp   time.Time      `gorm:"index" json:"timestamp"`
	Temperature float64        `json:"temperature"`
	Humidity    float64        `json:"humidity"`
	Pressure    float64        `json:"pressure"`
	PHValue     float64        `json:"ph_value"`
	Concentration float64      `json:"concentration"`
	Speed       float64        `json:"speed"`
	DeviceID    string         `gorm:"index" json:"device_id"`
	CreatedAt   time.Time      `json:"created_at"`
}

type Device struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	DeviceID    string         `gorm:"uniqueIndex;not null" json:"device_id"`
	DeviceName  string         `json:"device_name"`
	ProcessType ProcessType    `json:"process_type"`
	Status      string         `json:"status"`
	LastOnline  time.Time      `json:"last_online"`
	IPAddress   string         `json:"ip_address"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
}

type Alert struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	AlertLevel  AlertLevel     `gorm:"index;not null" json:"alert_level"`
	ProcessType ProcessType    `gorm:"index;not null" json:"process_type"`
	DeviceID    string         `gorm:"index" json:"device_id"`
	Message     string         `json:"message"`
	Parameter   string         `json:"parameter"`
	Value       float64        `json:"value"`
	Threshold   float64        `json:"threshold"`
	Timestamp   time.Time      `gorm:"index" json:"timestamp"`
	Acknowledged bool          `gorm:"default:false" json:"acknowledged"`
	AcknowledgedAt *time.Time  `json:"acknowledged_at"`
}

type ProcessConfig struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	ProcessType ProcessType    `gorm:"uniqueIndex;not null" json:"process_type"`
	ConfigName  string         `json:"config_name"`
	TempMin     float64        `json:"temp_min"`
	TempMax     float64        `json:"temp_max"`
	PHMin       float64        `json:"ph_min"`
	PHMax       float64        `json:"ph_max"`
	ConcentrationMin float64    `json:"concentration_min"`
	ConcentrationMax float64    `json:"concentration_max"`
	SpeedMin    float64        `json:"speed_min"`
	SpeedMax    float64        `json:"speed_max"`
	UpdatedAt   time.Time      `json:"updated_at"`
}

type AdjustmentRecord struct {
	ID          uint           `gorm:"primaryKey"`
	ProcessType ProcessType    `gorm:"index"`
	Parameter   string         `gorm:"index"`
	OldValue    float64        `json:"old_value"`
	NewValue    float64        `json:"new_value"`
	Reason      string         `json:"reason"`
	AdjustmentType string       `json:"adjustment_type"`
	CreatedAt   time.Time      `json:"created_at"`
}

type DeviceDiagnostic struct {
	ID          uint           `gorm:"primaryKey"`
	DeviceID    string         `gorm:"index"`
	ProcessType ProcessType    `gorm:"index"`
	Status      string         `json:"status"`
	HealthScore float64        `json:"health_score"`
	Diagnostics string         `json:"diagnostics"`
	LastCheck   time.Time      `json:"last_check"`
	CreatedAt   time.Time      `json:"created_at"`
}

func AutoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&SensorData{},
		&Device{},
		&Alert{},
		&ProcessConfig{},
		&AdjustmentRecord{},
		&DeviceDiagnostic{},
	)
}

func InitDefaultConfigs(db *gorm.DB) error {
	configs := []ProcessConfig{
		{
			ProcessType:      ProcessSoaking,
			ConfigName:       "浸泡工序默认配置",
			TempMin:          25.0,
			TempMax:          45.0,
			PHMin:            6.5,
			PHMax:            8.5,
			ConcentrationMin: 1.5,
			ConcentrationMax: 3.5,
			SpeedMin:         0,
			SpeedMax:         0,
		},
		{
			ProcessType:      ProcessBeating,
			ConfigName:       "捶打工序默认配置",
			TempMin:          20.0,
			TempMax:          35.0,
			PHMin:            6.0,
			PHMax:            8.0,
			ConcentrationMin: 2.0,
			ConcentrationMax: 4.0,
			SpeedMin:         100,
			SpeedMax:         500,
		},
		{
			ProcessType:      ProcessPaperMaking,
			ConfigName:       "抄纸工序默认配置",
			TempMin:          22.0,
			TempMax:          40.0,
			PHMin:            6.2,
			PHMax:            8.2,
			ConcentrationMin: 1.8,
			ConcentrationMax: 3.8,
			SpeedMin:         50,
			SpeedMax:         200,
		},
	}

	for _, cfg := range configs {
		var existing ProcessConfig
		if err := db.Where("process_type = ?", cfg.ProcessType).First(&existing).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				if err := db.Create(&cfg).Error; err != nil {
					return err
				}
			} else {
				return err
			}
		}
	}
	return nil
}

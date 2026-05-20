package models

import (
	"time"
)

type Fermenter struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"size:100;not null" json:"name"`
	Location  string    `gorm:"size:100" json:"location"`
	Status    string    `gorm:"size:20;default:'idle'" json:"status"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type SensorData struct {
	ID                 uint      `gorm:"primaryKey" json:"id"`
	FermenterID        uint      `gorm:"not null;index" json:"fermenterId"`
	Temperature        float64   `gorm:"not null" json:"temperature"`
	Humidity           float64   `gorm:"not null" json:"humidity"`
	MicrobeConcentration float64 `gorm:"not null" json:"microbeConcentration"`
	Status             string    `gorm:"size:20" json:"status"`
	Timestamp          time.Time `gorm:"index" json:"timestamp"`
}

type Settings struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	TempMin         float64   `gorm:"default:20" json:"tempMin"`
	TempMax         float64   `gorm:"default:35" json:"tempMax"`
	HumidityMin     float64   `gorm:"default:40" json:"humidityMin"`
	HumidityMax     float64   `gorm:"default:70" json:"humidityMax"`
	MicrobeMin      float64   `gorm:"default:1000" json:"microbeMin"`
	MicrobeMax      float64   `gorm:"default:1000000" json:"microbeMax"`
	SampleInterval  int       `gorm:"default:5000" json:"sampleInterval"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

type Alert struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	FermenterID uint      `gorm:"not null;index" json:"fermenterId"`
	Type        string    `gorm:"size:20;not null" json:"type"`
	Message     string    `gorm:"size:255;not null" json:"message"`
	Timestamp   time.Time `gorm:"index" json:"timestamp"`
}

type AdjustmentRecord struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	FermenterID     uint      `gorm:"not null;index" json:"fermenterId"`
	Parameter       string    `gorm:"size:50;not null" json:"parameter"`
	OldValue        float64   `json:"oldValue"`
	NewValue        float64   `json:"newValue"`
	Reason          string    `gorm:"size:255" json:"reason"`
	AutoAdjusted    bool      `gorm:"default:true" json:"autoAdjusted"`
	Timestamp       time.Time `gorm:"index" json:"timestamp"`
}

type FaultDiagnosis struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	FermenterID     uint      `gorm:"not null;index" json:"fermenterId"`
	FaultType       string    `gorm:"size:50;not null" json:"faultType"`
	Severity        string    `gorm:"size:20;not null" json:"severity"`
	Description     string    `gorm:"size:255" json:"description"`
	Suggestion      string    `gorm:"size:500" json:"suggestion"`
	Status          string    `gorm:"size:20;default:'detected'" json:"status"`
	Timestamp       time.Time `gorm:"index" json:"timestamp"`
	ResolvedAt      *time.Time `json:"resolvedAt,omitempty"`
}

type AnalysisResult struct {
	TemperatureTrend    string   `json:"temperatureTrend"`
	HumidityTrend       string   `json:"humidityTrend"`
	MicrobeTrend        string   `json:"microbeTrend"`
	EstimatedCompletion float64  `json:"estimatedCompletion"`
	HealthScore         float64  `json:"healthScore"`
	Recommendations     []string `json:"recommendations"`
	AutoAdjustments     []AdjustmentInfo `json:"autoAdjustments,omitempty"`
	FaultDiagnosis      []FaultInfo      `json:"faultDiagnosis,omitempty"`
}

type AdjustmentInfo struct {
	Parameter string  `json:"parameter"`
	OldValue  float64 `json:"oldValue"`
	NewValue  float64 `json:"newValue"`
	Reason    string  `json:"reason"`
}

type FaultInfo struct {
	Type        string `json:"type"`
	Severity    string `json:"severity"`
	Description string `json:"description"`
}

type ExportReportRequest struct {
	FermenterID uint   `json:"fermenterId"`
	StartTime   string `json:"startTime"`
	EndTime     string `json:"endTime"`
	Format      string `json:"format"`
}

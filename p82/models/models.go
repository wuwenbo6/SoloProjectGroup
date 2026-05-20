package models

import (
	"time"
)

type FiringParam struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	BatchID     string    `gorm:"index;size:50" json:"batch_id"`
	KilnID      string    `gorm:"size:50" json:"kiln_id"`
	ParamType   string    `gorm:"size:50" json:"param_type"`
	ParamValue  float64   `json:"param_value"`
	ParamUnit   string    `gorm:"size:20" json:"param_unit"`
	CollectedAt time.Time `json:"collected_at"`
	CreatedAt   time.Time `json:"created_at"`
}

type KilnTempRecord struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	BatchID     string    `gorm:"index;size:50" json:"batch_id"`
	KilnID      string    `gorm:"size:50" json:"kiln_id"`
	Temperature float64   `json:"temperature"`
	Zone        string    `gorm:"size:50" json:"zone"`
	MeasuredAt  time.Time `json:"measured_at"`
	SyncStatus  int       `gorm:"default:0" json:"sync_status"`
	SyncedAt    *time.Time `json:"synced_at,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

type ProcessParam struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	BatchID      string    `gorm:"index;size:50" json:"batch_id"`
	ProcessStage string    `gorm:"size:50" json:"process_stage"`
	ParamName    string    `gorm:"size:100" json:"param_name"`
	ParamValue   float64   `json:"param_value"`
	StandardMin  float64   `json:"standard_min"`
	StandardMax  float64   `json:"standard_max"`
	IsQualified  bool      `json:"is_qualified"`
	RecordedAt   time.Time `json:"recorded_at"`
	CreatedAt    time.Time `json:"created_at"`
}

type ProcessAnalysis struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	BatchID       string    `gorm:"index;size:50" json:"batch_id"`
	AnalysisType  string    `gorm:"size:50" json:"analysis_type"`
	AnalysisResult string   `gorm:"type:text" json:"analysis_result"`
	QualityScore  float64   `json:"quality_score"`
	Suggestions   string    `gorm:"type:text" json:"suggestions"`
	AnalyzedAt    time.Time `json:"analyzed_at"`
	CreatedAt     time.Time `json:"created_at"`
}

type Batch struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	BatchID        string    `gorm:"uniqueIndex;size:50" json:"batch_id"`
	ProductName    string    `gorm:"size:200" json:"product_name"`
	ProductType    string    `gorm:"size:100" json:"product_type"`
	Quantity       int       `json:"quantity"`
	Status         string    `gorm:"size:50" json:"status"`
	StartTime      *time.Time `json:"start_time,omitempty"`
	EndTime        *time.Time `json:"end_time,omitempty"`
	QualityResult  string    `gorm:"size:50" json:"quality_result"`
	ThirdPartyData *string   `gorm:"type:text" json:"third_party_data,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type User struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Username  string    `gorm:"uniqueIndex;size:50" json:"username"`
	Password  string    `gorm:"size:255" json:"-"`
	Role      string    `gorm:"size:50" json:"role"`
	Email     string    `gorm:"size:100" json:"email"`
	IsActive  bool      `gorm:"default:true" json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type APIKey struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Key         string    `gorm:"uniqueIndex;size:100" json:"key"`
	SystemName  string    `gorm:"size:100" json:"system_name"`
	Permissions string    `gorm:"type:text" json:"permissions"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
	IsActive    bool      `gorm:"default:true" json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
}

type Permission struct {
	ID          uint   `gorm:"primaryKey" json:"id"`
	Role        string `gorm:"index;size:50" json:"role"`
	Resource    string `gorm:"size:100" json:"resource"`
	Action      string `gorm:"size:50" json:"action"`
	Description string `gorm:"size:255" json:"description"`
}

type ThirdPartyTestReport struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	BatchID         string    `gorm:"index;size:50" json:"batch_id"`
	ReportID        string    `gorm:"size:100" json:"report_id"`
	TestingOrg      string    `gorm:"size:200" json:"testing_org"`
	TestItems       string    `gorm:"type:text" json:"test_items"`
	TestResults     string    `gorm:"type:text" json:"test_results"`
	IsQualified     bool      `json:"is_qualified"`
	ReportReceivedAt time.Time `json:"report_received_at"`
	CreatedAt       time.Time `json:"created_at"`
}

type AlertThreshold struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	ParamType   string    `gorm:"index;size:50" json:"param_type"`
	KilnID      string    `gorm:"index;size:50" json:"kiln_id"`
	MinValue    float64   `json:"min_value"`
	MaxValue    float64   `json:"max_value"`
	AlertLevel  int       `gorm:"default:1" json:"alert_level"`
	Enabled     bool      `gorm:"default:true" json:"enabled"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type AlertRecord struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	BatchID     string    `gorm:"index;size:50" json:"batch_id"`
	KilnID      string    `gorm:"size:50" json:"kiln_id"`
	ParamType   string    `gorm:"size:50" json:"param_type"`
	ParamValue  float64   `json:"param_value"`
	ThresholdMin float64  `json:"threshold_min"`
	ThresholdMax float64  `json:"threshold_max"`
	AlertLevel  int       `json:"alert_level"`
	AlertType   string    `gorm:"size:50" json:"alert_type"`
	Message     string    `gorm:"size:500" json:"message"`
	Handled     bool      `gorm:"default:false" json:"handled"`
	HandledBy   string    `gorm:"size:50" json:"handled_by,omitempty"`
	HandledAt   *time.Time `json:"handled_at,omitempty"`
	CollectedAt time.Time `json:"collected_at"`
	CreatedAt   time.Time `json:"created_at"`
}

type ApiSecurityConfig struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	SystemName  string    `gorm:"uniqueIndex;size:100" json:"system_name"`
	SecretKey   string    `gorm:"size:255" json:"secret_key"`
	Algorithm   string    `gorm:"size:50;default:HMAC-SHA256" json:"algorithm"`
	ExpireSeconds int     `gorm:"default:300" json:"expire_seconds"`
	IsActive    bool      `gorm:"default:true" json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

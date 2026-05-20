package sensor

import (
	"log"
	"math"
	"papermonitor/internal/config"
	"papermonitor/internal/models"
	"sync"
	"time"
)

type AdjustmentRecord struct {
	ID          uint           `gorm:"primaryKey"`
	ProcessType models.ProcessType `gorm:"index"`
	Parameter   string         `gorm:"index"`
	OldValue    float64        `json:"old_value"`
	NewValue    float64        `json:"new_value"`
	Reason      string         `json:"reason"`
	AdjustmentType string      `json:"adjustment_type"`
	CreatedAt   time.Time      `json:"created_at"`
}

type ParameterState struct {
	ProcessType    models.ProcessType
	Parameter      string
	CurrentValue   float64
	TargetValue    float64
	ErrorSum       float64
	LastError      float64
	AdjustCount    int
	LastAdjustTime time.Time
}

var (
	autoAdjustEnabled = true
	paramStates       = make(map[string]*ParameterState)
	paramStateMu      sync.RWMutex
	maxAdjustPerHour  = 5
	kp                = 0.1
	ki                = 0.05
	kd                = 0.01
)

func InitAutoAdjust() {
	go func() {
		ticker := time.NewTicker(10 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			if autoAdjustEnabled {
				processAutoAdjust()
			}
		}
	}()
	log.Println("Auto-adjust system initialized")
}

func getStateKey(processType models.ProcessType, parameter string) string {
	return string(processType) + "_" + parameter
}

func processAutoAdjust() {
	processTypes := []models.ProcessType{
		models.ProcessSoaking,
		models.ProcessBeating,
		models.ProcessPaperMaking,
	}

	for _, pt := range processTypes {
		cfg, ok := GetCachedConfig(pt)
		if !ok {
			continue
		}

		var latestData models.SensorData
		err := config.DB.Where("process_type = ?", pt).
			Order("timestamp desc").
			First(&latestData).Error
		if err != nil {
			continue
		}

		checkAndAdjust(pt, "temperature", latestData.Temperature, cfg.TempMin, cfg.TempMax)
		checkAndAdjust(pt, "ph_value", latestData.PHValue, cfg.PHMin, cfg.PHMax)
		checkAndAdjust(pt, "concentration", latestData.Concentration, cfg.ConcentrationMin, cfg.ConcentrationMax)
		if pt != models.ProcessSoaking {
			checkAndAdjust(pt, "speed", latestData.Speed, cfg.SpeedMin, cfg.SpeedMax)
		}
	}
}

func checkAndAdjust(processType models.ProcessType, parameter string, current, min, max float64) {
	if min == 0 && max == 0 {
		return
	}

	target := (min + max) / 2
	tolerance := (max - min) * 0.1

	if math.Abs(current-target) <= tolerance {
		return
	}

	key := getStateKey(processType, parameter)
	paramStateMu.Lock()
	state, exists := paramStates[key]
	if !exists {
		state = &ParameterState{
			ProcessType: processType,
			Parameter:   parameter,
			TargetValue: target,
		}
		paramStates[key] = state
	}
	paramStateMu.Unlock()

	state.CurrentValue = current

	oneHourAgo := time.Now().Add(-1 * time.Hour)
	if state.LastAdjustTime.After(oneHourAgo) && state.AdjustCount >= maxAdjustPerHour {
		log.Printf("Max adjustments reached for %s/%s, skipping", processType, parameter)
		return
	}

	errorVal := target - current
	adjustment := calculatePID(state, errorVal)

	if math.Abs(adjustment) < 0.01 {
		return
	}

	newValue := current + adjustment

	if newValue < min*0.9 {
		newValue = min * 0.9
	}
	if newValue > max*1.1 {
		newValue = max * 1.1
	}

	recordAdjustment(processType, parameter, current, newValue, "PID自动调整")

	state.LastError = errorVal
	state.ErrorSum += errorVal
	state.AdjustCount++
	state.LastAdjustTime = time.Now()

	if !state.LastAdjustTime.After(oneHourAgo) {
		state.AdjustCount = 1
	}
}

func calculatePID(state *ParameterState, errorVal float64) float64 {
	proportional := kp * errorVal
	integral := ki * state.ErrorSum
	derivative := kd * (errorVal - state.LastError)
	return proportional + integral + derivative
}

func recordAdjustment(processType models.ProcessType, parameter string, oldVal, newVal float64, reason string) {
	record := AdjustmentRecord{
		ProcessType:    processType,
		Parameter:      parameter,
		OldValue:       oldVal,
		NewValue:       newVal,
		Reason:         reason,
		AdjustmentType: "auto",
		CreatedAt:      time.Now(),
	}

	if err := config.DB.Create(&record).Error; err != nil {
		log.Printf("Failed to record adjustment: %v", err)
	}

	log.Printf("[Auto-Adjust] %s/%s: %.2f -> %.2f (reason: %s)",
		processType, parameter, oldVal, newVal, reason)

	alert := models.Alert{
		AlertLevel:  models.AlertLevelInfo,
		ProcessType: processType,
		DeviceID:    "AUTO-ADJUST",
		Message:     "参数自动调整: " + parameter,
		Parameter:   parameter,
		Value:       newVal,
		Threshold:   oldVal,
		Timestamp:   time.Now(),
	}

	select {
	case alertQueue <- alert:
	default:
	}
}

func GetAdjustmentHistory(processType models.ProcessType, limit int) ([]AdjustmentRecord, error) {
	var records []AdjustmentRecord
	query := config.DB.Order("created_at desc")
	if processType != "" {
		query = query.Where("process_type = ?", processType)
	}
	err := query.Limit(limit).Find(&records).Error
	return records, err
}

func SetAutoAdjustEnabled(enabled bool) {
	autoAdjustEnabled = enabled
	log.Printf("Auto-adjust system %s", map[bool]string{true: "enabled", false: "disabled"}[enabled])
}

func IsAutoAdjustEnabled() bool {
	return autoAdjustEnabled
}

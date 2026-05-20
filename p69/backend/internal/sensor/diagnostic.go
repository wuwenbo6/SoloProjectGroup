package sensor

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"papermonitor/internal/config"
	"papermonitor/internal/models"
	"time"
)

type DiagnosticResult struct {
	DeviceID    string                 `json:"device_id"`
	ProcessType models.ProcessType     `json:"process_type"`
	Status      string                 `json:"status"`
	HealthScore float64                `json:"health_score"`
	Issues      []DiagnosticIssue      `json:"issues"`
	Suggestions []string               `json:"suggestions"`
	LastCheck   time.Time              `json:"last_check"`
}

type DiagnosticIssue struct {
	Severity  string  `json:"severity"`
	Parameter string  `json:"parameter"`
	Message   string  `json:"message"`
	Value     float64 `json:"value"`
	Threshold float64 `json:"threshold"`
}

func InitDiagnostic() {
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			RunDiagnostics()
		}
	}()
	log.Println("Device diagnostic system initialized")
}

func RunDiagnostics() {
	devices := []struct {
		DeviceID    string
		ProcessType models.ProcessType
	}{
		{"SOAK-001", models.ProcessSoaking},
		{"BEAT-001", models.ProcessBeating},
		{"PAPER-001", models.ProcessPaperMaking},
	}

	for _, device := range devices {
		result := diagnoseDevice(device.DeviceID, device.ProcessType)
		saveDiagnosticResult(result)
	}
}

func diagnoseDevice(deviceID string, processType models.ProcessType) DiagnosticResult {
	result := DiagnosticResult{
		DeviceID:    deviceID,
		ProcessType: processType,
		Status:      "normal",
		HealthScore: 100.0,
		LastCheck:   time.Now(),
	}

	var recentData []models.SensorData
	config.DB.Where("device_id = ? AND process_type = ?", deviceID, processType).
		Order("timestamp desc").
		Limit(30).
		Find(&recentData)

	if len(recentData) == 0 {
		result.Status = "offline"
		result.HealthScore = 0
		result.Issues = append(result.Issues, DiagnosticIssue{
			Severity:  "critical",
			Parameter: "connection",
			Message:   "设备离线，无数据接收",
			Value:     0,
			Threshold: 1,
		})
		result.Suggestions = append(result.Suggestions, "检查设备电源和网络连接")
		return result
	}

	cfg, ok := GetCachedConfig(processType)
	if !ok {
		return result
	}

	checkParameterHealth(&result, "温度", recentData, cfg.TempMin, cfg.TempMax)
	checkParameterHealth(&result, "pH值", recentData, cfg.PHMin, cfg.PHMax)
	checkParameterHealth(&result, "浓度", recentData, cfg.ConcentrationMin, cfg.ConcentrationMax)

	if processType != models.ProcessSoaking {
		checkParameterHealth(&result, "转速", recentData, cfg.SpeedMin, cfg.SpeedMax)
	}

	checkDataStability(&result, recentData)
	checkDataContinuity(&result, recentData)

	if result.HealthScore < 60 {
		result.Status = "critical"
	} else if result.HealthScore < 80 {
		result.Status = "warning"
	}

	if result.Status != "normal" {
		alert := models.Alert{
			AlertLevel:  models.AlertLevelWarning,
			ProcessType: processType,
			DeviceID:    deviceID,
			Message:     "设备诊断异常，健康分数: " + formatFloat(result.HealthScore),
			Parameter:   "diagnostic",
			Value:       result.HealthScore,
			Threshold:   80,
			Timestamp:   time.Now(),
		}
		select {
		case alertQueue <- alert:
		default:
		}
	}

	return result
}

func checkParameterHealth(result *DiagnosticResult, parameter string, data []models.SensorData, min, max float64) {
	if min == 0 && max == 0 {
		return
	}

	var values []float64
	for _, d := range data {
		var val float64
		switch parameter {
		case "温度":
			val = d.Temperature
		case "pH值":
			val = d.PHValue
		case "浓度":
			val = d.Concentration
		case "转速":
			val = d.Speed
		}
		values = append(values, val)
	}

	if len(values) == 0 {
		return
	}

	avg := average(values)
	outOfRangeCount := 0
	for _, v := range values {
		if v < min || v > max {
			outOfRangeCount++
		}
	}

	ratio := float64(outOfRangeCount) / float64(len(values))
	if ratio > 0.5 {
		result.HealthScore -= 20
		result.Issues = append(result.Issues, DiagnosticIssue{
			Severity:  "critical",
			Parameter: parameter,
			Message:   parameter + "持续超出正常范围",
			Value:     avg,
			Threshold: (min + max) / 2,
		})
		result.Suggestions = append(result.Suggestions, "检查"+parameter+"传感器校准")
	} else if ratio > 0.2 {
		result.HealthScore -= 10
		result.Issues = append(result.Issues, DiagnosticIssue{
			Severity:  "warning",
			Parameter: parameter,
			Message:   parameter + "频繁波动",
			Value:     avg,
			Threshold: (min + max) / 2,
		})
	}
}

func checkDataStability(result *DiagnosticResult, data []models.SensorData) {
	if len(data) < 10 {
		return
	}

	tempChanges := make([]float64, 0, len(data)-1)
	for i := 1; i < len(data); i++ {
		change := math.Abs(data[i].Temperature - data[i-1].Temperature)
		tempChanges = append(tempChanges, change)
	}

	avgChange := average(tempChanges)
	if avgChange > 5 {
		result.HealthScore -= 15
		result.Issues = append(result.Issues, DiagnosticIssue{
			Severity:  "warning",
			Parameter: "稳定性",
			Message:   "温度波动过大，可能设备不稳定",
			Value:     avgChange,
			Threshold: 5,
		})
		result.Suggestions = append(result.Suggestions, "检查温度控制系统稳定性")
	}
}

func checkDataContinuity(result *DiagnosticResult, data []models.SensorData) {
	if len(data) < 2 {
		return
	}

	gapCount := 0
	for i := 1; i < len(data); i++ {
		gap := data[i-1].Timestamp.Sub(data[i].Timestamp)
		if gap > 5*time.Second {
			gapCount++
		}
	}

	if gapCount > 5 {
		result.HealthScore -= 10
		result.Issues = append(result.Issues, DiagnosticIssue{
			Severity:  "warning",
			Parameter: "连续性",
			Message:   "数据传输存在明显间断",
			Value:     float64(gapCount),
			Threshold: 5,
		})
		result.Suggestions = append(result.Suggestions, "检查网络连接和数据采集服务")
	}
}

func average(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	sum := 0.0
	for _, v := range values {
		sum += v
	}
	return sum / float64(len(values))
}

func formatFloat(f float64) string {
	return fmt.Sprintf("%.1f", f)
}

func saveDiagnosticResult(result DiagnosticResult) {
	diagnosticsJSON, _ := json.Marshal(result)

	diag := models.DeviceDiagnostic{
		DeviceID:    result.DeviceID,
		ProcessType: result.ProcessType,
		Status:      result.Status,
		HealthScore: result.HealthScore,
		Diagnostics: string(diagnosticsJSON),
		LastCheck:   result.LastCheck,
		CreatedAt:   time.Now(),
	}

	config.DB.Create(&diag)
}

func GetLatestDiagnostics() ([]DiagnosticResult, error) {
	var results []DiagnosticResult
	deviceIDs := []string{"SOAK-001", "BEAT-001", "PAPER-001"}

	for _, deviceID := range deviceIDs {
		var diag models.DeviceDiagnostic
		err := config.DB.Where("device_id = ?", deviceID).
			Order("created_at desc").
			First(&diag).Error
		if err == nil {
			var result DiagnosticResult
			json.Unmarshal([]byte(diag.Diagnostics), &result)
			result.HealthScore = diag.HealthScore
			result.Status = diag.Status
			result.LastCheck = diag.LastCheck
			results = append(results, result)
		}
	}

	return results, nil
}

func GetDiagnosticHistory(deviceID string, limit int) ([]DiagnosticResult, error) {
	var diags []models.DeviceDiagnostic
	err := config.DB.Where("device_id = ?", deviceID).
		Order("created_at desc").
		Limit(limit).
		Find(&diags).Error
	if err != nil {
		return nil, err
	}

	results := make([]DiagnosticResult, 0, len(diags))
	for _, diag := range diags {
		var result DiagnosticResult
		json.Unmarshal([]byte(diag.Diagnostics), &result)
		result.HealthScore = diag.HealthScore
		result.Status = diag.Status
		result.LastCheck = diag.LastCheck
		results = append(results, result)
	}

	return results, nil
}

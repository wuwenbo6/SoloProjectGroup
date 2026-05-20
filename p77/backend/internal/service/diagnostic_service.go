package service

import (
	"math"
	"time"

	"shadow-puppet-detection/internal/models"
	"shadow-puppet-detection/internal/repository"
)

type DiagnosticService struct {
	deviceRepo    *repository.DeviceRepository
	detectionRepo *repository.DetectionRepository
}

func NewDiagnosticService() *DiagnosticService {
	return &DiagnosticService{
		deviceRepo:    repository.NewDeviceRepository(),
		detectionRepo: repository.NewDetectionRepository(),
	}
}

type DeviceDiagnostic struct {
	DeviceID      string        `json:"device_id"`
	DeviceName    string        `json:"device_name"`
	Status        string        `json:"status"`
	HealthScore   float64       `json:"health_score"`
	Uptime        int64         `json:"uptime_seconds"`
	LastCheck     time.Time     `json:"last_check"`
	Diagnostics   []DiagnosticItem `json:"diagnostics"`
	Recommendations []string    `json:"recommendations"`
	MaintenanceDue bool         `json:"maintenance_due"`
}

type DiagnosticItem struct {
	Type     string  `json:"type"`
	Status   string  `json:"status"`
	Value    float64 `json:"value"`
	Threshold float64 `json:"threshold"`
	Message  string  `json:"message"`
	Severity string  `json:"severity"`
}

func (s *DiagnosticService) DiagnoseDevice(deviceID string) (*DeviceDiagnostic, error) {
	device, err := s.deviceRepo.GetByID(deviceID)
	if err != nil {
		return nil, err
	}

	detections, _, err := s.detectionRepo.List(1, 100, deviceID, "", nil, nil)
	if err != nil {
		return nil, err
	}

	diagnostics := []DiagnosticItem{}

	diagnostics = append(diagnostics, s.checkConnectionStability(device)...)
	diagnostics = append(diagnostics, s.checkDetectionConsistency(detections)...)
	diagnostics = append(diagnostics, s.checkTemperature(device)...)
	diagnostics = append(diagnostics, s.checkDetectionRate(detections)...)
	diagnostics = append(diagnostics, s.checkErrorRate(detections)...)

	healthScore := s.calculateHealthScore(diagnostics)
	diagnostic := &DeviceDiagnostic{
		DeviceID:     device.DeviceID,
		DeviceName:   device.DeviceName,
		Status:       string(device.Status),
		HealthScore:  healthScore,
		LastCheck:    time.Now(),
		Diagnostics:  diagnostics,
	}

	diagnostic.Recommendations = s.generateRecommendations(diagnostics)
	diagnostic.MaintenanceDue = healthScore < 70

	return diagnostic, nil
}

func (s *DiagnosticService) checkConnectionStability(device *models.DeviceInfo) []DiagnosticItem {
	items := []DiagnosticItem{}

	offlineDuration := time.Since(device.LastOnline)
	threshold := 30 * time.Minute

	severity := "normal"
	status := "ok"
	message := "设备连接正常"

	if offlineDuration > threshold {
		severity = "critical"
		status = "error"
		message = "设备离线时间过长"
	} else if offlineDuration > 10*time.Minute {
		severity = "warning"
		status = "warning"
		message = "设备连接不稳定"
	}

	items = append(items, DiagnosticItem{
		Type:      "connection",
		Status:    status,
		Value:     offlineDuration.Minutes(),
		Threshold: threshold.Minutes(),
		Message:   message,
		Severity:  severity,
	})

	return items
}

func (s *DiagnosticService) checkDetectionConsistency(detections []models.DetectionRecord) []DiagnosticItem {
	items := []DiagnosticItem{}

	if len(detections) < 10 {
		return items
	}

	var scores []float64
	for _, d := range detections {
		scores = append(scores, d.QualityScore)
	}

	mean, stdDev := s.calculateStats(scores)
	cv := stdDev / mean
	threshold := 0.15

	severity := "normal"
	status := "ok"
	message := "检测数据一致性良好"

	if cv > threshold*1.5 {
		severity = "critical"
		status = "error"
		message = "检测数据波动异常，可能存在传感器故障"
	} else if cv > threshold {
		severity = "warning"
		status = "warning"
		message = "检测数据波动较大，建议检查传感器"
	}

	items = append(items, DiagnosticItem{
		Type:      "consistency",
		Status:    status,
		Value:     cv * 100,
		Threshold: threshold * 100,
		Message:   message,
		Severity:  severity,
	})

	return items
}

func (s *DiagnosticService) checkTemperature(device *models.DeviceInfo) []DiagnosticItem {
	items := []DiagnosticItem{}

	if device.Temperature == 0 {
		return items
	}

	warnThreshold := 50.0
	criticalThreshold := 65.0

	severity := "normal"
	status := "ok"
	message := "设备温度正常"

	if device.Temperature > criticalThreshold {
		severity = "critical"
		status = "error"
		message = "设备温度过高，存在过热风险"
	} else if device.Temperature > warnThreshold {
		severity = "warning"
		status = "warning"
		message = "设备温度偏高，建议检查散热"
	}

	items = append(items, DiagnosticItem{
		Type:      "temperature",
		Status:    status,
		Value:     device.Temperature,
		Threshold: warnThreshold,
		Message:   message,
		Severity:  severity,
	})

	return items
}

func (s *DiagnosticService) checkDetectionRate(detections []models.DetectionRecord) []DiagnosticItem {
	items := []DiagnosticItem{}

	if len(detections) == 0 {
		return items
	}

	first := detections[len(detections)-1].CreatedAt
	last := detections[0].CreatedAt
	duration := last.Sub(first).Hours()

	if duration < 1 {
		return items
	}

	rate := float64(len(detections)) / duration
	expectedRate := 30.0

	severity := "normal"
	status := "ok"
	message := "检测速率正常"

	if rate < expectedRate*0.5 {
		severity = "critical"
		status = "error"
		message = "检测速率过低，可能存在处理瓶颈"
	} else if rate < expectedRate*0.8 {
		severity = "warning"
		status = "warning"
		message = "检测速率偏低，建议检查处理流程"
	}

	items = append(items, DiagnosticItem{
		Type:      "detection_rate",
		Status:    status,
		Value:     rate,
		Threshold: expectedRate * 0.8,
		Message:   message,
		Severity:  severity,
	})

	return items
}

func (s *DiagnosticService) checkErrorRate(detections []models.DetectionRecord) []DiagnosticItem {
	items := []DiagnosticItem{}

	if len(detections) == 0 {
		return items
	}

	errorCount := 0
	for _, d := range detections {
		if d.AlertLevel == models.AlertLevelError {
			errorCount++
		}
	}

	errorRate := float64(errorCount) / float64(len(detections)) * 100
	warnThreshold := 10.0
	criticalThreshold := 25.0

	severity := "normal"
	status := "ok"
	message := "错误率在正常范围内"

	if errorRate > criticalThreshold {
		severity = "critical"
		status = "error"
		message = "检测错误率过高，需立即检查设备"
	} else if errorRate > warnThreshold {
		severity = "warning"
		status = "warning"
		message = "检测错误率偏高，建议排查原因"
	}

	items = append(items, DiagnosticItem{
		Type:      "error_rate",
		Status:    status,
		Value:     errorRate,
		Threshold: warnThreshold,
		Message:   message,
		Severity:  severity,
	})

	return items
}

func (s *DiagnosticService) calculateHealthScore(diagnostics []DiagnosticItem) float64 {
	score := 100.0

	for _, d := range diagnostics {
		switch d.Severity {
		case "critical":
			score -= 25
		case "warning":
			score -= 10
		}
	}

	if score < 0 {
		score = 0
	}

	return math.Round(score*10) / 10
}

func (s *DiagnosticService) generateRecommendations(diagnostics []DiagnosticItem) []string {
	var recommendations []string

	for _, d := range diagnostics {
		switch d.Type {
		case "connection":
			if d.Severity == "critical" {
				recommendations = append(recommendations, "紧急：检查设备网络连接，重启设备")
			} else if d.Severity == "warning" {
				recommendations = append(recommendations, "建议：检查网络稳定性，优化网络配置")
			}
		case "consistency":
			if d.Severity == "critical" {
				recommendations = append(recommendations, "紧急：检查传感器校准，考虑更换传感器")
			} else if d.Severity == "warning" {
				recommendations = append(recommendations, "建议：进行传感器校准检查")
			}
		case "temperature":
			if d.Severity == "critical" {
				recommendations = append(recommendations, "紧急：立即停止设备使用，检查散热系统")
			} else if d.Severity == "warning" {
				recommendations = append(recommendations, "建议：检查设备散热环境，清理灰尘")
			}
		case "detection_rate":
			if d.Severity == "critical" {
				recommendations = append(recommendations, "紧急：检查设备处理能力，清理队列")
			} else if d.Severity == "warning" {
				recommendations = append(recommendations, "建议：优化检测流程，减少处理时间")
			}
		case "error_rate":
			if d.Severity == "critical" {
				recommendations = append(recommendations, "紧急：全面检查设备硬件，考虑暂停使用")
			} else if d.Severity == "warning" {
				recommendations = append(recommendations, "建议：安排预防性维护，检查传感器状态")
			}
		}
	}

	if len(recommendations) == 0 {
		recommendations = append(recommendations, "设备运行正常，建议定期维护")
	}

	return recommendations
}

func (s *DiagnosticService) calculateStats(values []float64) (mean, stdDev float64) {
	if len(values) == 0 {
		return 0, 0
	}

	sum := 0.0
	for _, v := range values {
		sum += v
	}
	mean = sum / float64(len(values))

	variance := 0.0
	for _, v := range values {
		variance += math.Pow(v-mean, 2)
	}
	variance /= float64(len(values))
	stdDev = math.Sqrt(variance)

	return mean, stdDev
}

func (s *DiagnosticService) GetAllDiagnostics() ([]*DeviceDiagnostic, error) {
	devices, err := s.deviceRepo.List()
	if err != nil {
		return nil, err
	}

	var diagnostics []*DeviceDiagnostic
	for _, d := range devices {
		diag, err := s.DiagnoseDevice(d.DeviceID)
		if err != nil {
			continue
		}
		diagnostics = append(diagnostics, diag)
	}

	return diagnostics, nil
}

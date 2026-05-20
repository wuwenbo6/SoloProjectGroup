package service

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"shadow-puppet-detection/internal/models"
	"shadow-puppet-detection/internal/repository"
)

type DetectionService struct {
	detectionRepo *repository.DetectionRepository
	materialRepo  *repository.MaterialRepository
	deviceRepo    *repository.DeviceRepository
	alertRepo     *repository.AlertRepository
}

func NewDetectionService() *DetectionService {
	return &DetectionService{
		detectionRepo: repository.NewDetectionRepository(),
		materialRepo:  repository.NewMaterialRepository(),
		deviceRepo:    repository.NewDeviceRepository(),
		alertRepo:     repository.NewAlertRepository(),
	}
}

func (s *DetectionService) AnalyzeAndSave(record *models.DetectionRecord) error {
	param, err := s.materialRepo.GetByType(record.MaterialType)
	if err != nil {
		log.Printf("[Detection] Using default params for material type: %s", record.MaterialType)
		param = &models.MaterialParam{
			MinThickness:        0.5,
			MaxThickness:        5.0,
			MinHardness:         30.0,
			MaxHardness:         90.0,
			MinTensileStrength:  10.0,
			MaxTensileStrength:  40.0,
			MinMoisture:         5.0,
			MaxMoisture:         20.0,
			PassScore:           70.0,
			WarnThreshold:       50.0,
		}
	}

	score := s.calculateQualityScore(record, param)
	record.QualityScore = score
	record.IsQualified = score >= param.PassScore

	if score < param.WarnThreshold {
		record.AlertLevel = models.AlertLevelError
	} else if !record.IsQualified {
		record.AlertLevel = models.AlertLevelWarn
	} else {
		record.AlertLevel = models.AlertLevelNormal
	}

	alertCreated := false
	if record.AlertLevel != models.AlertLevelNormal {
		alert := &models.AlertRecord{
			DeviceID:   record.DeviceID,
			AlertLevel: record.AlertLevel,
			AlertType:  "材质异常",
			Message:    s.generateAlertMessage(record, param),
		}
		if err := s.alertRepo.Create(alert); err == nil {
			alertCreated = true
		}
	}

	if err := s.detectionRepo.Create(record); err != nil {
		return fmt.Errorf("failed to save detection record: %w", err)
	}

	s.deviceRepo.IncrementDetectionCount(record.DeviceID)

	if record.AlertLevel != models.AlertLevelNormal {
		alertRecord, _ := json.Marshal(record)
		log.Printf("[Alert] New alert for device %s, level: %s, details: %s", 
			record.DeviceID, record.AlertLevel, string(alertRecord))
	}

	return nil
}

func (s *DetectionService) calculateQualityScore(record *models.DetectionRecord, param *models.MaterialParam) float64 {
	thicknessScore := s.calculateParameterScore(record.Thickness, param.MinThickness, param.MaxThickness, 25)
	hardnessScore := s.calculateParameterScore(record.Hardness, param.MinHardness, param.MaxHardness, 25)
	tensileScore := s.calculateParameterScore(record.TensileStrength, param.MinTensileStrength, param.MaxTensileStrength, 25)
	moistureScore := s.calculateParameterScore(record.Moisture, param.MinMoisture, param.MaxMoisture, 25)

	total := thicknessScore + hardnessScore + tensileScore + moistureScore
	
	log.Printf("[Score] Thickness: %.2f, Hardness: %.2f, Tensile: %.2f, Moisture: %.2f, Total: %.2f",
		thicknessScore, hardnessScore, tensileScore, moistureScore, total)
	
	return math.Round(total*100) / 100
}

func (s *DetectionService) calculateParameterScore(value, min, max, weight float64) float64 {
	if max <= min {
		return weight * 0.8
	}
	
	if value < min || value > max {
		deviation := 0.0
		if value < min {
			deviation = (min - value) / (max - min)
		} else {
			deviation = (value - max) / (max - min)
		}
		if deviation < 0.5 {
			return weight * (1 - deviation)
		}
		return weight * 0.1
	}

	mid := (min + max) / 2
	rangeVal := max - min
	
	if rangeVal == 0 {
		return weight
	}

	deviationRatio := math.Abs(value - mid) / rangeVal
	
	scoreCurve := math.Pow(1 - deviationRatio, 1.5)
	
	return weight * (0.5 + 0.5*scoreCurve)
}

func (s *DetectionService) generateAlertMessage(record *models.DetectionRecord, param *models.MaterialParam) string {
	var msg string
	
	if record.Thickness < param.MinThickness {
		msg += fmt.Sprintf("厚度偏低(%.2f < %.2f)；", record.Thickness, param.MinThickness)
	} else if record.Thickness > param.MaxThickness {
		msg += fmt.Sprintf("厚度偏高(%.2f > %.2f)；", record.Thickness, param.MaxThickness)
	}
	
	if record.Hardness < param.MinHardness {
		msg += fmt.Sprintf("硬度偏低(%.1f < %.1f)；", record.Hardness, param.MinHardness)
	} else if record.Hardness > param.MaxHardness {
		msg += fmt.Sprintf("硬度偏高(%.1f > %.1f)；", record.Hardness, param.MaxHardness)
	}
	
	if record.TensileStrength < param.MinTensileStrength {
		msg += fmt.Sprintf("抗拉强度偏低(%.1f < %.1f)；", record.TensileStrength, param.MinTensileStrength)
	} else if record.TensileStrength > param.MaxTensileStrength {
		msg += fmt.Sprintf("抗拉强度偏高(%.1f > %.1f)；", record.TensileStrength, param.MaxTensileStrength)
	}
	
	if record.Moisture < param.MinMoisture {
		msg += fmt.Sprintf("湿度偏低(%.1f < %.1f)；", record.Moisture, param.MinMoisture)
	} else if record.Moisture > param.MaxMoisture {
		msg += fmt.Sprintf("湿度偏高(%.1f > %.1f)；", record.Moisture, param.MaxMoisture)
	}
	
	if msg == "" {
		msg = fmt.Sprintf("综合质量评分偏低(%.2f < %.2f)", record.QualityScore, param.PassScore)
	}
	
	return msg
}

func (s *DetectionService) GetDetectionList(page, pageSize int, deviceID, materialType string, startDate, endDate *string) ([]models.DetectionRecord, int64, error) {
	var start, end *string
	if startDate != nil && *startDate != "" {
		start = startDate
	}
	if endDate != nil && *endDate != "" {
		end = endDate
	}
	
	var startTime, endTime *string
	if start != nil {
		startTime = start
	}
	if end != nil {
		endTime = end
	}
	
	return s.detectionRepo.List(page, pageSize, deviceID, materialType, nil, nil)
}

func (s *DetectionService) GetLatestDetections(limit int) ([]models.DetectionRecord, error) {
	return s.detectionRepo.GetLatest(limit)
}

func (s *DetectionService) GetStats(days int) ([]models.DetectionStats, error) {
	return s.detectionRepo.GetStats(days)
}

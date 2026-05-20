package service

import (
	"math"
	"sort"
	"time"

	"shadow-puppet-detection/internal/models"
	"shadow-puppet-detection/internal/repository"
)

type PredictionService struct {
	detectionRepo *repository.DetectionRepository
}

func NewPredictionService() *PredictionService {
	return &PredictionService{
		detectionRepo: repository.NewDetectionRepository(),
	}
}

type AgingPrediction struct {
	MaterialType   string         `json:"material_type"`
	CurrentQuality float64        `json:"current_quality"`
	PredictedDays  int            `json:"predicted_days"`
	Trend          string         `json:"trend"`
	Confidence     float64        `json:"confidence"`
	HistoryData    []QualityPoint `json:"history_data"`
	PredictedData  []QualityPoint `json:"predicted_data"`
	WarningLevel   string         `json:"warning_level"`
}

type QualityPoint struct {
	Date    string  `json:"date"`
	Quality float64 `json:"quality"`
}

func (s *PredictionService) PredictMaterialAging(materialType string, days int) (*AgingPrediction, error) {
	detections, _, err := s.detectionRepo.List(1000, 1000, "", materialType, nil, nil)
	if err != nil {
		return nil, err
	}

	if len(detections) == 0 {
		return &AgingPrediction{
			MaterialType:  materialType,
			PredictedDays: 0,
			Trend:         "unknown",
			Confidence:    0,
		}, nil
	}

	qualityPoints := s.calculateDailyQuality(detections)

	if len(qualityPoints) < 3 {
		return &AgingPrediction{
			MaterialType:  materialType,
			PredictedDays: 30,
			Trend:         "stable",
			Confidence:    0.5,
			HistoryData:   qualityPoints,
		}, nil
	}

	slope, intercept := s.linearRegression(qualityPoints)
	predictedPoints := s.predictFuture(qualityPoints, slope, intercept, days)

	predictedDays := s.calculateRemainingDays(qualityPoints, slope, intercept)

	trend := "stable"
	if slope < -0.1 {
		trend = "degrading"
	} else if slope > 0.1 {
		trend = "improving"
	}

	warningLevel := "normal"
	if predictedDays < 7 {
		warningLevel = "critical"
	} else if predictedDays < 30 {
		warningLevel = "warning"
	}

	currentQuality := 60.0
	if len(qualityPoints) > 0 {
		currentQuality = qualityPoints[len(qualityPoints)-1].Quality
	}

	return &AgingPrediction{
		MaterialType:   materialType,
		CurrentQuality: currentQuality,
		PredictedDays:  predictedDays,
		Trend:          trend,
		Confidence:     s.calculateConfidence(qualityPoints, slope, intercept),
		HistoryData:    qualityPoints,
		PredictedData:  predictedPoints,
		WarningLevel:   warningLevel,
	}, nil
}

func (s *PredictionService) calculateDailyQuality(detections []models.DetectionRecord) []QualityPoint {
	dailyQuality := make(map[string][]float64)

	for _, d := range detections {
		date := d.CreatedAt.Format("2006-01-02")
		dailyQuality[date] = append(dailyQuality[date], d.QualityScore)
	}

	var points []QualityPoint
	for date, scores := range dailyQuality {
		avg := 0.0
		for _, s := range scores {
			avg += s
		}
		avg /= float64(len(scores))
		points = append(points, QualityPoint{
			Date:    date,
			Quality: math.Round(avg*100) / 100,
		})
	}

	sort.Slice(points, func(i, j int) bool {
		return points[i].Date < points[j].Date
	})

	return points
}

func (s *PredictionService) linearRegression(points []QualityPoint) (slope, intercept float64) {
	n := float64(len(points))
	var sumX, sumY, sumXY, sumX2 float64

	for i, p := range points {
		x := float64(i)
		y := p.Quality
		sumX += x
		sumY += y
		sumXY += x * y
		sumX2 += x * x
	}

	slope = (n*sumXY - sumX*sumY) / (n*sumX2 - sumX*sumX)
	intercept = (sumY - slope*sumX) / n

	return slope, intercept
}

func (s *PredictionService) predictFuture(points []QualityPoint, slope, intercept float64, days int) []QualityPoint {
	var predicted []QualityPoint
	lastDate, _ := time.Parse("2006-01-02", points[len(points)-1].Date)

	for i := 1; i <= days; i++ {
		futureDate := lastDate.AddDate(0, 0, i)
		x := float64(len(points) + i - 1)
		predictedQuality := slope*x + intercept

		if predictedQuality < 0 {
			predictedQuality = 0
		}
		if predictedQuality > 100 {
			predictedQuality = 100
		}

		predicted = append(predicted, QualityPoint{
			Date:    futureDate.Format("2006-01-02"),
			Quality: math.Round(predictedQuality*100) / 100,
		})
	}

	return predicted
}

func (s *PredictionService) calculateRemainingDays(points []QualityPoint, slope, intercept float64) int {
	if slope >= 0 {
		return 90
	}

	threshold := 50.0
	x := (threshold - intercept) / slope
	remainingDays := int(x) - len(points) + 1

	if remainingDays < 0 {
		remainingDays = 0
	}
	if remainingDays > 90 {
		remainingDays = 90
	}

	return remainingDays
}

func (s *PredictionService) calculateConfidence(points []QualityPoint, slope, intercept float64) float64 {
	var mse float64
	for i, p := range points {
		x := float64(i)
		predicted := slope*x + intercept
		mse += math.Pow(p.Quality - predicted, 2)
	}
	mse /= float64(len(points))

	rmse := math.Sqrt(mse)
	confidence := math.Max(0, 1-rmse/50)

	return math.Round(confidence * 100) / 100
}

func (s *PredictionService) GetAllPredictions(days int) ([]*AgingPrediction, error) {
	materialTypes := []string{"皮革", "纸张", "木材", "织物", "塑料"}
	var predictions []*AgingPrediction

	for _, mt := range materialTypes {
		pred, err := s.PredictMaterialAging(mt, days)
		if err != nil {
			continue
		}
		predictions = append(predictions, pred)
	}

	return predictions, nil
}

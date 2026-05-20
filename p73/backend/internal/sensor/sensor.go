package sensor

import (
	"fermentation-monitor/internal/database"
	"fermentation-monitor/internal/models"
	"math"
	"math/rand"
	"sync"
	"time"
)

type SensorSimulator struct {
	baseTemp     float64
	baseHumidity float64
	baseMicrobe  float64
	counter      int
	mu           sync.Mutex
}

var (
	globalSimulators = make(map[uint]*SensorSimulator)
	simulatorMu     sync.Mutex
)

func GetOrCreateSimulator(fermenterID uint) *SensorSimulator {
	simulatorMu.Lock()
	defer simulatorMu.Unlock()

	if sim, exists := globalSimulators[fermenterID]; exists {
		return sim
	}

	sim := &SensorSimulator{
		baseTemp:     25.0,
		baseHumidity: 55.0,
		baseMicrobe:  100000.0,
		counter:      0,
	}
	globalSimulators[fermenterID] = sim
	return sim
}

func (s *SensorSimulator) ReadData(fermenterID uint) *models.SensorData {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.counter++

	temperature := s.baseTemp + math.Sin(float64(s.counter)/10.0)*3.0 + rand.Float64()*1.5
	humidity := s.baseHumidity + math.Cos(float64(s.counter)/15.0)*5.0 + rand.Float64()*2.0
	microbeGrowth := 800.0 * float64(s.counter) + rand.Float64()*30000.0
	microbeConcentration := s.baseMicrobe + microbeGrowth

	status := "normal"

	return &models.SensorData{
		FermenterID:         fermenterID,
		Temperature:        temperature,
		Humidity:           humidity,
		MicrobeConcentration: microbeConcentration,
		Status:             status,
		Timestamp:          time.Now(),
	}
}

func (s *SensorSimulator) GetCounter() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.counter
}

func (s *SensorSimulator) CheckThresholds(data *models.SensorData, settings *models.Settings) []*models.Alert {
	var alerts []*models.Alert

	if data.Temperature > settings.TempMax {
		alerts = append(alerts, &models.Alert{
			FermenterID: data.FermenterID,
			Type:        "danger",
			Message:     "温度超过上限",
			Timestamp:   time.Now(),
		})
		data.Status = "warning"
	} else if data.Temperature < settings.TempMin {
		alerts = append(alerts, &models.Alert{
			FermenterID: data.FermenterID,
			Type:        "warning",
			Message:     "温度低于下限",
			Timestamp:   time.Now(),
		})
		data.Status = "warning"
	}

	if data.Humidity > settings.HumidityMax {
		alerts = append(alerts, &models.Alert{
			FermenterID: data.FermenterID,
			Type:        "warning",
			Message:     "湿度超过上限",
			Timestamp:   time.Now(),
		})
		data.Status = "warning"
	} else if data.Humidity < settings.HumidityMin {
		alerts = append(alerts, &models.Alert{
			FermenterID: data.FermenterID,
			Type:        "warning",
			Message:     "湿度低于下限",
			Timestamp:   time.Now(),
		})
		data.Status = "warning"
	}

	if data.MicrobeConcentration > settings.MicrobeMax {
		alerts = append(alerts, &models.Alert{
			FermenterID: data.FermenterID,
			Type:        "danger",
			Message:     "微生物浓度超过上限",
			Timestamp:   time.Now(),
		})
		data.Status = "danger"
	} else if data.MicrobeConcentration < settings.MicrobeMin {
		alerts = append(alerts, &models.Alert{
			FermenterID: data.FermenterID,
			Type:        "info",
			Message:     "微生物浓度低于下限",
			Timestamp:   time.Now(),
		})
	}

	return alerts
}

func movingAverage(data []float64, window int) float64 {
	if len(data) == 0 {
		return 0
	}
	if len(data) <= window {
		window = len(data)
	}
	sum := 0.0
	for i := len(data) - window; i < len(data); i++ {
		sum += data[i]
	}
	return sum / float64(window)
}

func calculateTrend(values []float64, threshold float64) string {
	if len(values) < 10 {
		return "stable"
	}

	windowSize := 5
	var earlyAvg, lateAvg float64

	if len(values) >= 20 {
		early := values[:10]
		late := values[len(values)-10:]
		earlyAvg = movingAverage(early, windowSize)
		lateAvg = movingAverage(late, windowSize)
	} else {
		mid := len(values) / 2
		early := values[:mid]
		late := values[mid:]
		earlyAvg = movingAverage(early, windowSize)
		lateAvg = movingAverage(late, windowSize)
	}

	diff := lateAvg - earlyAvg

	if diff > threshold {
		return "rising"
	} else if diff < -threshold {
		return "falling"
	}
	return "stable"
}

func AnalyzeData(history []models.SensorData, settings *models.Settings, fermenterID uint) *models.AnalysisResult {
	if len(history) < 10 {
		return &models.AnalysisResult{
			TemperatureTrend:    "stable",
			HumidityTrend:       "stable",
			MicrobeTrend:        "growing",
			EstimatedCompletion: 72.0,
			HealthScore:         85.0,
			Recommendations:     []string{"数据采集中，继续监控"},
		}
	}

	healthScore := 85.0
	recommendations := []string{}

	tempValues := make([]float64, len(history))
	humidityValues := make([]float64, len(history))
	microbeValues := make([]float64, len(history))

	for i, d := range history {
		tempValues[i] = d.Temperature
		humidityValues[i] = d.Humidity
		microbeValues[i] = d.MicrobeConcentration
	}

	tempTrend := calculateTrend(tempValues, 0.5)
	if tempTrend == "rising" {
		healthScore -= 3.0
		recommendations = append(recommendations, "温度呈上升趋势，关注冷却系统")
	} else if tempTrend == "falling" {
		healthScore -= 2.0
		recommendations = append(recommendations, "温度呈下降趋势，检查保温系统")
	}

	humidityTrend := calculateTrend(humidityValues, 2.0)
	if humidityTrend == "rising" {
		healthScore -= 2.0
		recommendations = append(recommendations, "湿度呈上升趋势，注意通风")
	} else if humidityTrend == "falling" {
		healthScore -= 1.5
		recommendations = append(recommendations, "湿度呈下降趋势，检查加湿系统")
	}

	microbeTrend := calculateTrend(microbeValues, 10000.0)
	if microbeTrend == "stable" {
		microbeTrend = "growing"
	} else if microbeTrend == "falling" {
		healthScore -= 8.0
		recommendations = append(recommendations, "微生物增长异常，建议检查营养供给")
	}

	latestTemp := tempValues[len(tempValues)-1]
	tempRange := settings.TempMax - settings.TempMin
	tempOptimal := (settings.TempMax + settings.TempMin) / 2
	tempDeviation := math.Abs(latestTemp - tempOptimal) / tempRange
	if tempDeviation > 0.3 {
		healthScore -= 5.0
		recommendations = append(recommendations, "温度偏离最优值较大")
	}

	latestMicrobe := microbeValues[len(microbeValues)-1]
	microbeProgress := (latestMicrobe - settings.MicrobeMin) / (settings.MicrobeMax - settings.MicrobeMin)
	if microbeProgress < 0 {
		microbeProgress = 0
	}
	if microbeProgress > 1 {
		microbeProgress = 1
	}

	totalHours := 72.0
	elapsedRatio := float64(len(history)) / 288.0
	if elapsedRatio > 1 {
		elapsedRatio = 1
	}

	var estimatedCompletion float64
	if microbeProgress > 0.01 {
		remainingRatio := 1.0 - microbeProgress
		estimatedCompletion = remainingRatio * totalHours
	} else {
		estimatedCompletion = 72.0 - (elapsedRatio * 72.0)
	}

	if estimatedCompletion < 0 {
		estimatedCompletion = 0
	}

	if healthScore > 100 {
		healthScore = 100
	}
	if healthScore < 0 {
		healthScore = 0
	}

	if len(recommendations) == 0 {
		recommendations = append(recommendations, "各项指标正常，发酵进展顺利")
	}

	autoAdjustments := PerformAutoAdjustment(fermenterID, history, settings)
	faultDiagnosis := DiagnoseFaults(fermenterID, history, settings)

	return &models.AnalysisResult{
		TemperatureTrend:    tempTrend,
		HumidityTrend:       humidityTrend,
		MicrobeTrend:        microbeTrend,
		EstimatedCompletion: math.Round(estimatedCompletion*10) / 10,
		HealthScore:         math.Round(healthScore*10) / 10,
		Recommendations:     recommendations,
		AutoAdjustments:     autoAdjustments,
		FaultDiagnosis:      faultDiagnosis,
	}
}

func PerformAutoAdjustment(fermenterID uint, history []models.SensorData, settings *models.Settings) []models.AdjustmentInfo {
	var adjustments []models.AdjustmentInfo

	if len(history) < 5 {
		return adjustments
	}

	recentData := history[len(history)-5:]

	var avgTemp float64
	var avgHumidity float64
	for _, d := range recentData {
		avgTemp += d.Temperature
		avgHumidity += d.Humidity
	}
	avgTemp /= float64(len(recentData))
	avgHumidity /= float64(len(recentData))

	tempTarget := (settings.TempMax + settings.TempMin) / 2
	humidityTarget := (settings.HumidityMax + settings.HumidityMin) / 2

	if avgTemp > settings.TempMax*0.95 {
		adjustment := models.AdjustmentInfo{
			Parameter: "温度",
			OldValue:  avgTemp,
			NewValue:  tempTarget,
			Reason:    "温度接近上限，自动下调目标温度",
		}
		adjustments = append(adjustments, adjustment)

		record := &models.AdjustmentRecord{
			FermenterID:  fermenterID,
			Parameter:    "温度",
			OldValue:     avgTemp,
			NewValue:     tempTarget,
			Reason:       "温度接近上限，自动下调目标温度",
			AutoAdjusted: true,
		}
		database.CreateAdjustmentRecord(record)
	} else if avgTemp < settings.TempMin*1.05 {
		adjustment := models.AdjustmentInfo{
			Parameter: "温度",
			OldValue:  avgTemp,
			NewValue:  tempTarget,
			Reason:    "温度接近下限，自动上调目标温度",
		}
		adjustments = append(adjustments, adjustment)

		record := &models.AdjustmentRecord{
			FermenterID:  fermenterID,
			Parameter:    "温度",
			OldValue:     avgTemp,
			NewValue:     tempTarget,
			Reason:       "温度接近下限，自动上调目标温度",
			AutoAdjusted: true,
		}
		database.CreateAdjustmentRecord(record)
	}

	if avgHumidity > settings.HumidityMax*0.95 {
		adjustment := models.AdjustmentInfo{
			Parameter: "湿度",
			OldValue:  avgHumidity,
			NewValue:  humidityTarget,
			Reason:    "湿度接近上限，自动下调目标湿度",
		}
		adjustments = append(adjustments, adjustment)

		record := &models.AdjustmentRecord{
			FermenterID:  fermenterID,
			Parameter:    "湿度",
			OldValue:     avgHumidity,
			NewValue:     humidityTarget,
			Reason:       "湿度接近上限，自动下调目标湿度",
			AutoAdjusted: true,
		}
		database.CreateAdjustmentRecord(record)
	} else if avgHumidity < settings.HumidityMin*1.05 {
		adjustment := models.AdjustmentInfo{
			Parameter: "湿度",
			OldValue:  avgHumidity,
			NewValue:  humidityTarget,
			Reason:    "湿度接近下限，自动上调目标湿度",
		}
		adjustments = append(adjustments, adjustment)

		record := &models.AdjustmentRecord{
			FermenterID:  fermenterID,
			Parameter:    "湿度",
			OldValue:     avgHumidity,
			NewValue:     humidityTarget,
			Reason:       "湿度接近下限，自动上调目标湿度",
			AutoAdjusted: true,
		}
		database.CreateAdjustmentRecord(record)
	}

	return adjustments
}

func DiagnoseFaults(fermenterID uint, history []models.SensorData, settings *models.Settings) []models.FaultInfo {
	var faults []models.FaultInfo

	if len(history) < 10 {
		return faults
	}

	tempValues := make([]float64, len(history))
	humidityValues := make([]float64, len(history))
	for i, d := range history {
		tempValues[i] = d.Temperature
		humidityValues[i] = d.Humidity
	}

	tempVariance := calculateVariance(tempValues)
	humidityVariance := calculateVariance(humidityValues)

	if tempVariance > 5.0 {
		fault := models.FaultInfo{
			Type:        "温度传感器异常",
			Severity:    "warning",
			Description: "温度波动过大，可能存在传感器故障",
		}
		faults = append(faults, fault)

		faultRecord := &models.FaultDiagnosis{
			FermenterID: fermenterID,
			FaultType:   "温度传感器异常",
			Severity:    "warning",
			Description: "温度波动过大，可能存在传感器故障",
			Suggestion:  "请检查温度传感器连接状态，必要时进行校准或更换",
		}
		database.CreateFaultDiagnosis(faultRecord)
		database.UpdateFermenterStatus(fermenterID, "warning")
	}

	if humidityVariance > 20.0 {
		fault := models.FaultInfo{
			Type:        "湿度传感器异常",
			Severity:    "warning",
			Description: "湿度波动过大，可能存在传感器故障",
		}
		faults = append(faults, fault)

		faultRecord := &models.FaultDiagnosis{
			FermenterID: fermenterID,
			FaultType:   "湿度传感器异常",
			Severity:    "warning",
			Description: "湿度波动过大，可能存在传感器故障",
			Suggestion:  "请检查湿度传感器，确保通风系统正常运行",
		}
		database.CreateFaultDiagnosis(faultRecord)
		database.UpdateFermenterStatus(fermenterID, "warning")
	}

	if len(faults) == 0 {
		fermenter, _ := database.GetFermenterByID(fermenterID)
		if fermenter != nil && fermenter.Status == "warning" {
			database.UpdateFermenterStatus(fermenterID, "running")
		}
	}

	return faults
}

func calculateVariance(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}

	var sum float64
	for _, v := range values {
		sum += v
	}
	mean := sum / float64(len(values))

	var variance float64
	for _, v := range values {
		variance += (v - mean) * (v - mean)
	}
	return variance / float64(len(values))
}

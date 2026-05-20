package ingester

import (
	"math"
	"sync"
	"time"

	"edge-gateway/models"
)

const (
	HighRateMs = 100   // 高频采样：100ms
	LowRateMs  = 500   // 低频采样：500ms

	VarianceWindowSize = 30    // 方差计算窗口大小
	LowVarianceThresholdTemp = 0.1    // 温度低方差阈值
	LowVarianceThresholdHumidity = 0.5 // 湿度低方差阈值
	HighVarianceThresholdTemp = 0.5    // 温度高方差阈值
	HighVarianceThresholdHumidity = 2.0 // 湿度高方差阈值

	StablePeriodRequired = 3000  // 需要稳定观察的时间 (ms)
)

type SensorStats struct {
	TempVariance     float64
	HumidityVariance float64
	TempMean         float64
	HumidityMean     float64
}

type AdaptiveRateController struct {
	sensorRates     map[string]int           // 当前采样率 (ms)
	sensorStats     map[string]*SensorStats  // 统计数据
	lastRateChange  map[string]time.Time     // 上次改变采样率的时间
	lastSwitchLow  map[string]time.Time     // 上次切换到低频的时间
	mu             sync.RWMutex
}

func NewAdaptiveRateController() *AdaptiveRateController {
	return &AdaptiveRateController{
		sensorRates:    make(map[string]int),
		sensorStats:    make(map[string]*SensorStats),
		lastRateChange: make(map[string]time.Time),
		lastSwitchLow:  make(map[string]time.Time),
	}
}

func (arc *AdaptiveRateController) calculateVariance(data []*models.CleanedData) *SensorStats {
	if len(data) < 10 {
		return &SensorStats{
			TempVariance:     math.MaxFloat64,
			HumidityVariance: math.MaxFloat64,
		}
	}

	windowSize := VarianceWindowSize
	if len(data) < windowSize {
		windowSize = len(data)
	}

	startIdx := len(data) - windowSize
	var tempSum, humiditySum float64
	validCount := 0

	for i := startIdx; i < len(data); i++ {
		if !data[i].IsInterpolated {
			tempSum += data[i].Temp
			humiditySum += data[i].Humidity
			validCount++
		}
	}

	if validCount < 10 {
		return &SensorStats{
			TempVariance:     math.MaxFloat64,
			HumidityVariance: math.MaxFloat64,
		}
	}

	tempMean := tempSum / float64(validCount)
	humidityMean := humiditySum / float64(validCount)

	var tempVarianceSum, humidityVarianceSum float64
	for i := startIdx; i < len(data); i++ {
		if !data[i].IsInterpolated {
			tempDiff := data[i].Temp - tempMean
			tempVarianceSum += tempDiff * tempDiff

			humidityDiff := data[i].Humidity - humidityMean
			humidityVarianceSum += humidityDiff * humidityDiff
		}
	}

	return &SensorStats{
		TempVariance:     tempVarianceSum / float64(validCount),
		HumidityVariance: humidityVarianceSum / float64(validCount),
		TempMean:         tempMean,
		HumidityMean:     humidityMean,
	}
}

func (arc *AdaptiveRateController) ShouldSkipData(sensorID string, sensorData []*models.CleanedData, currentTime time.Time) (bool, int) {
	arc.mu.Lock()
	defer arc.mu.Unlock()

	currentRate, exists := arc.sensorRates[sensorID]
	if !exists {
		currentRate = HighRateMs
		arc.sensorRates[sensorID] = currentRate
	}

	stats := arc.calculateVariance(sensorData)
	arc.sensorStats[sensorID] = stats

	isLowVariance := stats.TempVariance <= LowVarianceThresholdTemp &&
		stats.HumidityVariance <= LowVarianceThresholdHumidity

	isHighVariance := stats.TempVariance >= HighVarianceThresholdTemp ||
		stats.HumidityVariance >= HighVarianceThresholdHumidity

	lastChange, hasChanged := arc.lastRateChange[sensorID]
	canChange := !hasChanged || currentTime.Sub(lastChange).Milliseconds() > StablePeriodRequired

	if isLowVariance && currentRate == HighRateMs && canChange {
		arc.sensorRates[sensorID] = LowRateMs
		arc.lastRateChange[sensorID] = currentTime
		arc.lastSwitchLow[sensorID] = currentTime
		return false, LowRateMs
	}

	if isHighVariance && currentRate == LowRateMs && canChange {
		arc.sensorRates[sensorID] = HighRateMs
		arc.lastRateChange[sensorID] = currentTime
		return false, HighRateMs
	}

	if currentRate == LowRateMs {
		_, hasLastSwitch := arc.lastSwitchLow[sensorID]
		if hasLastSwitch {
			elapsed := currentTime.Sub(arc.lastSwitchLow[sensorID]).Milliseconds()
			if elapsed < int64(LowRateMs) {
				return true, LowRateMs
			}
			arc.lastSwitchLow[sensorID] = currentTime
		}
	}

	return false, currentRate
}

func (arc *AdaptiveRateController) GetCurrentRate(sensorID string) int {
	arc.mu.RLock()
	defer arc.mu.RUnlock()

	if rate, exists := arc.sensorRates[sensorID]; exists {
		return rate
	}
	return HighRateMs
}

func (arc *AdaptiveRateController) GetSensorStats(sensorID string) *SensorStats {
	arc.mu.RLock()
	defer arc.mu.RUnlock()

	if stats, exists := arc.sensorStats[sensorID]; exists {
		return stats
	}
	return nil
}

func (arc *AdaptiveRateController) GetAllSensorRates() map[string]int {
	arc.mu.RLock()
	defer arc.mu.RUnlock()

	result := make(map[string]int, len(arc.sensorRates))
	for k, v := range arc.sensorRates {
		result[k] = v
	}
	return result
}

func (arc *AdaptiveRateController) GetStatistics() (int, int, float64, float64) {
	arc.mu.RLock()
	defer arc.mu.RUnlock()

	highCount, lowCount := 0, 0
	avgTempVariance, avgHumidityVariance := 0.0, 0.0

	for _, rate := range arc.sensorRates {
		if rate == HighRateMs {
			highCount++
		} else {
			lowCount++
		}
	}

	count := 0
	for _, stats := range arc.sensorStats {
		if stats.TempVariance < math.MaxFloat64 && stats.HumidityVariance < math.MaxFloat64 {
			avgTempVariance += stats.TempVariance
			avgHumidityVariance += stats.HumidityVariance
			count++
		}
	}

	if count > 0 {
		avgTempVariance /= float64(count)
		avgHumidityVariance /= float64(count)
	}

	return highCount, lowCount, avgTempVariance, avgHumidityVariance
}

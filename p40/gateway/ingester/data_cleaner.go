package ingester

import (
	"sync"
	"time"

	"edge-gateway/models"
)

const (
	MissingThreshold = 10 * time.Second
	MovingAvgWindowSize = 20
)

type DataCleaner struct {
	recentData     map[string][]*models.CleanedData
	lastSeen       map[string]time.Time
	missingCount   map[string]int
	maxHistorySize int
	mu             sync.RWMutex
	rateController *AdaptiveRateController
}

func NewDataCleaner() *DataCleaner {
	return &DataCleaner{
		recentData:     make(map[string][]*models.CleanedData),
		lastSeen:       make(map[string]time.Time),
		missingCount:   make(map[string]int),
		maxHistorySize: 100,
		rateController: NewAdaptiveRateController(),
	}
}

func (dc *DataCleaner) Clean(data *models.SensorData) (*models.CleanedData, bool) {
	dc.mu.Lock()
	defer dc.mu.Unlock()

	if dc.isDuplicate(data) {
		return nil, false
	}

	now := time.Now()
	sensorID := data.SensorID
	history := dc.recentData[sensorID]

	shouldSkip, newRate := dc.rateController.ShouldSkipData(sensorID, history, now)
	oldRate := dc.rateController.GetCurrentRate(sensorID)
	rateChanged := oldRate != newRate

	if shouldSkip {
		skippedData := &models.CleanedData{
			SensorData:         *data,
			IsInterpolated:     false,
			CurrentSampleRateMs: newRate,
			WasSkipped:         true,
		}
		return skippedData, false
	}

	var missingDuration time.Duration
	var wasMissing bool

	if lastTime, exists := dc.lastSeen[sensorID]; exists {
		missingDuration = now.Sub(lastTime)
		if missingDuration >= MissingThreshold {
			wasMissing = true
			dc.missingCount[sensorID]++
		} else {
			dc.missingCount[sensorID] = 0
		}
	}

	dc.lastSeen[sensorID] = now

	cleaned := &models.CleanedData{
		SensorData:         *data,
		IsInterpolated:     false,
		CurrentSampleRateMs: newRate,
		SampleRateChanged:  rateChanged,
	}

	if wasMissing {
		cleaned.MissingDurationMs = missingDuration.Milliseconds()
		cleaned.MissingCount = dc.missingCount[sensorID]
	}

	dc.addToHistory(cleaned)
	return cleaned, true
}

func (dc *DataCleaner) isDuplicate(data *models.SensorData) bool {
	history, exists := dc.recentData[data.SensorID]
	if !exists {
		return false
	}

	for _, d := range history {
		if d.Timestamp.Equal(data.Timestamp) {
			return true
		}
	}
	return false
}

func (dc *DataCleaner) addToHistory(data *models.CleanedData) {
	history := dc.recentData[data.SensorID]
	history = append(history, data)
	
	if len(history) > dc.maxHistorySize {
		history = history[len(history)-dc.maxHistorySize:]
	}
	dc.recentData[data.SensorID] = history
}

func (dc *DataCleaner) calculateMovingAverage(history []*models.CleanedData) (float64, float64) {
	windowSize := MovingAvgWindowSize
	if len(history) < windowSize {
		windowSize = len(history)
	}

	if windowSize == 0 {
		return 0, 0
	}

	startIdx := len(history) - windowSize
	var tempSum, humiditySum float64
	validCount := 0

	for i := startIdx; i < len(history); i++ {
		if !history[i].IsInterpolated {
			tempSum += history[i].Temp
			humiditySum += history[i].Humidity
			validCount++
		}
	}

	if validCount == 0 {
		return 0, 0
	}

	return tempSum / float64(validCount), humiditySum / float64(validCount)
}

func (dc *DataCleaner) InterpolateMissing(sensorID string, from, to time.Time, interval time.Duration) []*models.CleanedData {
	dc.mu.RLock()
	defer dc.mu.RUnlock()

	history, exists := dc.recentData[sensorID]
	if !exists || len(history) < 5 {
		return nil
	}

	var interpolated []*models.CleanedData
	
	for t := from; t.Before(to); t = t.Add(interval) {
		if !dc.hasDataAtTime(history, t) {
			interp := dc.interpolateAtTimeMovingAvg(history, t, sensorID)
			if interp != nil {
				interpolated = append(interpolated, interp)
			}
		}
	}

	return interpolated
}

func (dc *DataCleaner) hasDataAtTime(history []*models.CleanedData, t time.Time) bool {
	window := 50 * time.Millisecond
	for _, d := range history {
		diff := d.Timestamp.Sub(t).Abs()
		if diff < window {
			return true
		}
	}
	return false
}

func (dc *DataCleaner) interpolateAtTimeMovingAvg(history []*models.CleanedData, t time.Time, sensorID string) *models.CleanedData {
	tempAvg, humidityAvg := dc.calculateMovingAverage(history)

	if tempAvg == 0 && humidityAvg == 0 {
		return nil
	}

	var lastValidTime time.Time
	missingCount := 0
	for i := len(history) - 1; i >= 0; i-- {
		if !history[i].IsInterpolated {
			lastValidTime = history[i].Timestamp
			break
		}
		missingCount++
	}

	missingDuration := t.Sub(lastValidTime)

	return &models.CleanedData{
		SensorData: models.SensorData{
			SensorID:  sensorID,
			Timestamp: t,
			Temp:      tempAvg,
			Humidity:  humidityAvg,
		},
		IsInterpolated:      true,
		MissingDurationMs:   missingDuration.Milliseconds(),
		MissingCount:        missingCount,
		InterpolationMethod: "moving_average",
	}
}

func (dc *DataCleaner) GetRecentData(sensorID string, limit int) []*models.CleanedData {
	dc.mu.RLock()
	defer dc.mu.RUnlock()

	history, exists := dc.recentData[sensorID]
	if !exists {
		return nil
	}

	if len(history) <= limit {
		result := make([]*models.CleanedData, len(history))
		copy(result, history)
		return result
	}

	result := make([]*models.CleanedData, limit)
	copy(result, history[len(history)-limit:])
	return result
}

func (dc *DataCleaner) GetAllSensors() []string {
	dc.mu.RLock()
	defer dc.mu.RUnlock()

	sensors := make([]string, 0, len(dc.recentData))
	for id := range dc.recentData {
		sensors = append(sensors, id)
	}
	return sensors
}

func (dc *DataCleaner) CheckAndFillGap(sensorID string, currentTime time.Time) (*models.CleanedData, bool) {
	dc.mu.Lock()
	defer dc.mu.Unlock()

	lastTime, exists := dc.lastSeen[sensorID]
	if !exists {
		return nil, false
	}

	gapDuration := currentTime.Sub(lastTime)
	if gapDuration < MissingThreshold {
		return nil, false
	}

	history := dc.recentData[sensorID]
	if len(history) < 5 {
		return nil, false
	}

	tempAvg, humidityAvg := dc.calculateMovingAverage(history)
	if tempAvg == 0 && humidityAvg == 0 {
		return nil, false
	}

	dc.missingCount[sensorID]++

	filledData := &models.CleanedData{
		SensorData: models.SensorData{
			SensorID:  sensorID,
			Timestamp: currentTime,
			Temp:      tempAvg,
			Humidity:  humidityAvg,
		},
		IsInterpolated:      true,
		MissingDurationMs:   gapDuration.Milliseconds(),
		MissingCount:        dc.missingCount[sensorID],
		InterpolationMethod: "moving_average",
	}

	dc.addToHistory(filledData)
	dc.lastSeen[sensorID] = currentTime

	return filledData, true
}

func (dc *DataCleaner) GetMissingStatus(sensorID string) (int64, int) {
	dc.mu.RLock()
	defer dc.mu.RUnlock()

	lastTime, exists := dc.lastSeen[sensorID]
	if !exists {
		return 0, 0
	}

	return time.Since(lastTime).Milliseconds(), dc.missingCount[sensorID]
}

func (dc *DataCleaner) GetCurrentSampleRate(sensorID string) int {
	return dc.rateController.GetCurrentRate(sensorID)
}

func (dc *DataCleaner) GetAllSampleRates() map[string]int {
	return dc.rateController.GetAllSensorRates()
}

func (dc *DataCleaner) GetRateStatistics() (int, int, float64, float64) {
	return dc.rateController.GetStatistics()
}

func (dc *DataCleaner) GetSensorVarianceStats(sensorID string) *SensorStats {
	return dc.rateController.GetSensorStats(sensorID)
}

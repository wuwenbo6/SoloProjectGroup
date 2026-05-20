package prediction

import (
	"math"
	"sync"
	"time"
)

type SARIMAModel struct {
	p, d, q int
	P, D, Q int
	s       int
	data    []float64
	mutex   sync.RWMutex
}

func NewSARIMAModel(p, d, q, P, D, Q, s int) *SARIMAModel {
	return &SARIMAModel{
		p: p, d: d, q: q,
		P: P, D: D, Q: Q,
		s:    s,
		data: make([]float64, 0, 1000),
	}
}

func (m *SARIMAModel) AddDataPoint(value float64) {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	m.data = append(m.data, value)
	if len(m.data) > 1000 {
		m.data = m.data[len(m.data)-1000:]
	}
}

func (m *SARIMAModel) AddHistoryData(values []float64) {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	m.data = append(m.data, values...)
	if len(m.data) > 1000 {
		m.data = m.data[len(m.data)-1000:]
	}
}

func (m *SARIMAModel) Predict(steps int) []float64 {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	if len(m.data) < m.s*2 {
		return m.simplePredict(steps)
	}

	return m.sarimaPredict(steps)
}

func (m *SARIMAModel) simplePredict(steps int) []float64 {
	if len(m.data) == 0 {
		return make([]float64, steps)
	}

	predictions := make([]float64, steps)
	avg := m.average(m.data)

	for i := range predictions {
		trend := 0.0
		if len(m.data) > 10 {
			recentAvg := m.average(m.data[len(m.data)-10:])
			trend = (recentAvg - avg) / 10
		}
		predictions[i] = avg + trend*float64(i)
		predictions[i] = math.Max(0, predictions[i])
	}

	return predictions
}

func (m *SARIMAModel) sarimaPredict(steps int) []float64 {
	predictions := make([]float64, steps)

	n := len(m.data)
	seasonalValues := make([]float64, m.s)
	for i := 0; i < m.s; i++ {
		count := 0
		for j := i; j < n; j += m.s {
			seasonalValues[i] += m.data[j]
			count++
		}
		if count > 0 {
			seasonalValues[i] /= float64(count)
		}
	}

	var recentTrend float64
	if n > 20 {
		recentAvg1 := m.average(m.data[n-10:])
		recentAvg2 := m.average(m.data[n-20 : n-10])
		recentTrend = (recentAvg1 - recentAvg2) / 10
	}

	currentBase := m.average(m.data[max(0, n-24):])

	for i := 0; i < steps; i++ {
		seasonalIdx := (n + i) % m.s
		predictions[i] = currentBase + seasonalValues[seasonalIdx] + recentTrend*float64(i)
		predictions[i] = math.Max(0, predictions[i])
	}

	return predictions
}

func (m *SARIMAModel) average(data []float64) float64 {
	if len(data) == 0 {
		return 0
	}
	sum := 0.0
	for _, v := range data {
		sum += v
	}
	return sum / float64(len(data))
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

type TrafficPredictor struct {
	hourlyModel  *SARIMAModel
	dailyModel   *SARIMAModel
	historyData  map[string][]float64
	mutex        sync.RWMutex
}

func NewTrafficPredictor() *TrafficPredictor {
	return &TrafficPredictor{
		hourlyModel: NewSARIMAModel(2, 1, 1, 1, 1, 1, 24),
		dailyModel:  NewSARIMAModel(1, 1, 1, 1, 0, 1, 7),
		historyData: make(map[string][]float64),
	}
}

func (tp *TrafficPredictor) RecordTraffic(timestamp time.Time, count int) {
	tp.mutex.Lock()
	defer tp.mutex.Unlock()

	hourKey := timestamp.Format("2006-01-02 15:00")
	if _, exists := tp.historyData[hourKey]; !exists {
		tp.hourlyModel.AddDataPoint(float64(count))
		tp.historyData[hourKey] = append(tp.historyData[hourKey], float64(count))
	}

	dayKey := timestamp.Format("2006-01-02")
	if len(tp.historyData[dayKey]) == 0 {
		tp.dailyModel.AddDataPoint(float64(count))
	}
	tp.historyData[dayKey] = append(tp.historyData[dayKey], float64(count))
}

type PredictionResult struct {
	HourlyPrediction  []PredictionPoint `json:"hourly_prediction"`
	DailyPrediction   []PredictionPoint `json:"daily_prediction"`
	ConfidenceLower   []float64         `json:"confidence_lower"`
	ConfidenceUpper   []float64         `json:"confidence_upper"`
}

type PredictionPoint struct {
	Time      string  `json:"time"`
	Value     float64 `json:"value"`
	Timestamp int64   `json:"timestamp"`
}

func (tp *TrafficPredictor) PredictNextHours(hours int) *PredictionResult {
	tp.mutex.RLock()
	defer tp.mutex.RUnlock()

	values := tp.hourlyModel.Predict(hours)
	now := time.Now()

	result := &PredictionResult{
		HourlyPrediction: make([]PredictionPoint, hours),
		ConfidenceLower:  make([]float64, hours),
		ConfidenceUpper:  make([]float64, hours),
	}

	for i := 0; i < hours; i++ {
		predTime := now.Add(time.Hour * time.Duration(i+1))
		result.HourlyPrediction[i] = PredictionPoint{
			Time:      predTime.Format("15:00"),
			Value:     math.Round(values[i]),
			Timestamp: predTime.Unix(),
		}
		result.ConfidenceLower[i] = math.Max(0, values[i]*0.7)
		result.ConfidenceUpper[i] = values[i] * 1.3
	}

	return result
}

func (tp *TrafficPredictor) PredictNextDays(days int) *PredictionResult {
	tp.mutex.RLock()
	defer tp.mutex.RUnlock()

	values := tp.dailyModel.Predict(days)
	now := time.Now()

	result := &PredictionResult{
		DailyPrediction: make([]PredictionPoint, days),
		ConfidenceLower: make([]float64, days),
		ConfidenceUpper: make([]float64, days),
	}

	for i := 0; i < days; i++ {
		predTime := now.AddDate(0, 0, i+1)
		result.DailyPrediction[i] = PredictionPoint{
			Time:      predTime.Format("01-02"),
			Value:     math.Round(values[i]),
			Timestamp: predTime.Unix(),
		}
		result.ConfidenceLower[i] = math.Max(0, values[i]*0.7)
		result.ConfidenceUpper[i] = values[i] * 1.3
	}

	return result
}

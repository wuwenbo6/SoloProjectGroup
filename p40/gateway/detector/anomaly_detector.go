package detector

import (
	"database/sql"
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/google/uuid"
	_ "github.com/mattn/go-sqlite3"

	"edge-gateway/models"
)

type SlidingWindow struct {
	values []float64
	size   int
	mu     sync.RWMutex
}

func NewSlidingWindow(size int) *SlidingWindow {
	return &SlidingWindow{
		values: make([]float64, 0, size),
		size:   size,
	}
}

func (w *SlidingWindow) Add(value float64) {
	w.mu.Lock()
	defer w.mu.Unlock()

	w.values = append(w.values, value)
	if len(w.values) > w.size {
		w.values = w.values[1:]
	}
}

func (w *SlidingWindow) Mean() float64 {
	w.mu.RLock()
	defer w.mu.RUnlock()

	if len(w.values) == 0 {
		return 0
	}

	sum := 0.0
	for _, v := range w.values {
		sum += v
	}
	return sum / float64(len(w.values))
}

func (w *SlidingWindow) StdDev(mean float64) float64 {
	w.mu.RLock()
	defer w.mu.RUnlock()

	if len(w.values) < 2 {
		return 0
	}

	variance := 0.0
	for _, v := range w.values {
		diff := v - mean
		variance += diff * diff
	}
	variance /= float64(len(w.values) - 1)
	return math.Sqrt(variance)
}

func (w *SlidingWindow) IsFull() bool {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return len(w.values) >= w.size
}

type AnomalyDetector struct {
	tempWindows     map[string]*SlidingWindow
	humidityWindows map[string]*SlidingWindow
	recoveryTime    map[string]time.Time
	windowSize      int
	recoveryPause   time.Duration
	alertCallback   func(*models.Alert)
	mu              sync.RWMutex
}

func NewAnomalyDetector(windowSize int) *AnomalyDetector {
	return &AnomalyDetector{
		tempWindows:     make(map[string]*SlidingWindow),
		humidityWindows: make(map[string]*SlidingWindow),
		recoveryTime:    make(map[string]time.Time),
		windowSize:      windowSize,
		recoveryPause:   5 * time.Second,
	}
}

func (ad *AnomalyDetector) SetAlertCallback(callback func(*models.Alert)) {
	ad.alertCallback = callback
}

func (ad *AnomalyDetector) getTempWindow(sensorID string) *SlidingWindow {
	ad.mu.Lock()
	defer ad.mu.Unlock()

	if _, exists := ad.tempWindows[sensorID]; !exists {
		ad.tempWindows[sensorID] = NewSlidingWindow(ad.windowSize)
	}
	return ad.tempWindows[sensorID]
}

func (ad *AnomalyDetector) getHumidityWindow(sensorID string) *SlidingWindow {
	ad.mu.Lock()
	defer ad.mu.Unlock()

	if _, exists := ad.humidityWindows[sensorID]; !exists {
		ad.humidityWindows[sensorID] = NewSlidingWindow(ad.windowSize)
	}
	return ad.humidityWindows[sensorID]
}

func (ad *AnomalyDetector) getTempWindowNoLock(sensorID string) *SlidingWindow {
	if _, exists := ad.tempWindows[sensorID]; !exists {
		ad.tempWindows[sensorID] = NewSlidingWindow(ad.windowSize)
	}
	return ad.tempWindows[sensorID]
}

func (ad *AnomalyDetector) getHumidityWindowNoLock(sensorID string) *SlidingWindow {
	if _, exists := ad.humidityWindows[sensorID]; !exists {
		ad.humidityWindows[sensorID] = NewSlidingWindow(ad.windowSize)
	}
	return ad.humidityWindows[sensorID]
}

func (ad *AnomalyDetector) Detect(data *models.CleanedData) []*models.Alert {
	var alerts []*models.Alert

	if data.IsInterpolated {
		return alerts
	}

	ad.mu.Lock()
	defer ad.mu.Unlock()

	sensorID := data.SensorID

	if data.MissingCount > 0 {
		ad.recoveryTime[sensorID] = data.Timestamp
	}

	if recoveryStart, inRecovery := ad.recoveryTime[sensorID]; inRecovery {
		if data.Timestamp.Sub(recoveryStart) < ad.recoveryPause {
			ad.tempWindows[sensorID].Add(data.Temp)
			ad.humidityWindows[sensorID].Add(data.Humidity)
			return alerts
		}
		delete(ad.recoveryTime, sensorID)
	}

	tempWindow := ad.getTempWindowNoLock(sensorID)
	humidityWindow := ad.getHumidityWindowNoLock(sensorID)

	if tempWindow.IsFull() {
		mean := tempWindow.Mean()
		stdDev := tempWindow.StdDev(mean)
		lowerBound := mean - 3*stdDev
		upperBound := mean + 3*stdDev

		if data.Temp < lowerBound || data.Temp > upperBound {
			alert := &models.Alert{
				ID:        uuid.New().String(),
				SensorID:  sensorID,
				Timestamp: data.Timestamp,
				Type:      "anomaly",
				Metric:    "temperature",
				Value:     data.Temp,
				Message:   fmt.Sprintf("Temperature anomaly detected: %.2f°C (mean: %.2f, σ: %.2f)", data.Temp, mean, stdDev),
			}
			alerts = append(alerts, alert)
		}
	}

	if humidityWindow.IsFull() {
		mean := humidityWindow.Mean()
		stdDev := humidityWindow.StdDev(mean)
		lowerBound := mean - 3*stdDev
		upperBound := mean + 3*stdDev

		if data.Humidity < lowerBound || data.Humidity > upperBound {
			alert := &models.Alert{
				ID:        uuid.New().String(),
				SensorID:  sensorID,
				Timestamp: data.Timestamp,
				Type:      "anomaly",
				Metric:    "humidity",
				Value:     data.Humidity,
				Message:   fmt.Sprintf("Humidity anomaly detected: %.2f%% (mean: %.2f, σ: %.2f)", data.Humidity, mean, stdDev),
			}
			alerts = append(alerts, alert)
		}
	}

	tempWindow.Add(data.Temp)
	humidityWindow.Add(data.Humidity)

	for _, alert := range alerts {
		if ad.alertCallback != nil {
			ad.alertCallback(alert)
		}
	}

	return alerts
}

type AlertStore struct {
	db *sql.DB
}

func NewAlertStore(dbPath string) (*AlertStore, error) {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		return nil, err
	}

	store := &AlertStore{db: db}
	if err := store.initSchema(); err != nil {
		return nil, err
	}

	return store, nil
}

func (s *AlertStore) initSchema() error {
	_, err := s.db.Exec(`
		CREATE TABLE IF NOT EXISTS alerts (
			id TEXT PRIMARY KEY,
			sensor_id TEXT NOT NULL,
			timestamp INTEGER NOT NULL,
			type TEXT NOT NULL,
			metric TEXT NOT NULL,
			value REAL NOT NULL,
			message TEXT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_alerts_sensor_id ON alerts(sensor_id);
		CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts(timestamp);
	`)
	return err
}

func (s *AlertStore) Save(alert *models.Alert) error {
	_, err := s.db.Exec(`
		INSERT INTO alerts (id, sensor_id, timestamp, type, metric, value, message)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, alert.ID, alert.SensorID, alert.Timestamp.UnixMilli(), alert.Type, alert.Metric, alert.Value, alert.Message)
	return err
}

func (s *AlertStore) GetAlerts(sensorID string, limit int) ([]*models.Alert, error) {
	rows, err := s.db.Query(`
		SELECT id, sensor_id, timestamp, type, metric, value, message
		FROM alerts
		WHERE sensor_id = ? OR ? = ''
		ORDER BY timestamp DESC
		LIMIT ?
	`, sensorID, sensorID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var alerts []*models.Alert
	for rows.Next() {
		alert := &models.Alert{}
		var ts int64
		err := rows.Scan(&alert.ID, &alert.SensorID, &ts, &alert.Type, &alert.Metric, &alert.Value, &alert.Message)
		if err != nil {
			return nil, err
		}
		alert.Timestamp = time.UnixMilli(ts)
		alerts = append(alerts, alert)
	}

	return alerts, nil
}

func (s *AlertStore) Close() error {
	return s.db.Close()
}

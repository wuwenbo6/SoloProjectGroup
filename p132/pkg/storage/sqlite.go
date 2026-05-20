package storage

import (
	"encoding/json"
	"fmt"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"modbus-mqtt-gateway/pkg/edge"
)

type DataRecord struct {
	ID        uint      `gorm:"primaryKey"`
	DeviceID  string    `gorm:"index;not null"`
	DataPoint string    `gorm:"index;not null"`
	Value     float64   `gorm:"not null"`
	Unit      string    `gorm:"size:20"`
	Alarm     string    `gorm:"size:20"`
	Published bool      `gorm:"index;default:false"`
	Timestamp int64     `gorm:"index;not null"`
	CreatedAt time.Time
	UpdatedAt time.Time
}

type PayloadRecord struct {
	ID         uint      `gorm:"primaryKey"`
	DeviceID   string    `gorm:"index;not null"`
	Payload    string    `gorm:"type:text;not null"`
	Topic      string    `gorm:"size:255"`
	Published  bool      `gorm:"index;default:false"`
	RetryCount int       `gorm:"default:0"`
	Timestamp  int64     `gorm:"index;not null"`
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

type SQLiteStorage struct {
	db *gorm.DB
}

func NewSQLiteStorage(dbPath string) (*SQLiteStorage, error) {
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("failed to open sqlite: %w", err)
	}

	if err := db.AutoMigrate(&DataRecord{}, &PayloadRecord{}); err != nil {
		return nil, fmt.Errorf("failed to migrate schema: %w", err)
	}

	return &SQLiteStorage{db: db}, nil
}

func (s *SQLiteStorage) SaveProcessedData(deviceId string, data []edge.ProcessedData) error {
	for _, d := range data {
		record := DataRecord{
			DeviceID:  deviceId,
			DataPoint: d.Name,
			Value:     d.Value,
			Unit:      d.Unit,
			Alarm:     string(d.AlarmLevel),
			Published: false,
			Timestamp: d.Timestamp,
		}
		if err := s.db.Create(&record).Error; err != nil {
			return err
		}
	}
	return nil
}

func (s *SQLiteStorage) SavePayload(deviceId, topic, payload string, timestamp int64) error {
	record := PayloadRecord{
		DeviceID:   deviceId,
		Topic:      topic,
		Payload:    payload,
		Published:  false,
		RetryCount: 0,
		Timestamp:  timestamp,
	}
	return s.db.Create(&record).Error
}

func (s *SQLiteStorage) MarkPayloadPublished(id uint) error {
	return s.db.Model(&PayloadRecord{}).Where("id = ?", id).Update("published", true).Error
}

func (s *SQLiteStorage) IncrementRetryCount(id uint) error {
	return s.db.Model(&PayloadRecord{}).Where("id = ?", id).UpdateColumn("retry_count", gorm.Expr("retry_count + 1")).Error
}

func (s *SQLiteStorage) GetUnpublishedPayloads(limit int, maxRetries int) ([]PayloadRecord, error) {
	var records []PayloadRecord
	err := s.db.Where("published = ? AND retry_count < ?", false, maxRetries).
		Order("timestamp ASC").
		Limit(limit).
		Find(&records).Error
	return records, err
}

func (s *SQLiteStorage) GetUnpublishedData(deviceId string, limit int) ([]DataRecord, error) {
	var records []DataRecord
	err := s.db.Where("device_id = ? AND published = ?", deviceId, false).
		Order("timestamp ASC").
		Limit(limit).
		Find(&records).Error
	return records, err
}

func (s *SQLiteStorage) MarkDataPublished(ids []uint) error {
	if len(ids) == 0 {
		return nil
	}
	return s.db.Model(&DataRecord{}).Where("id IN ?", ids).Update("published", true).Error
}

func (s *SQLiteStorage) CleanupPublishedData(olderThan time.Duration) (int64, error) {
	cutoff := time.Now().Add(-olderThan)
	result := s.db.Where("published = ? AND created_at < ?", true, cutoff).Delete(&DataRecord{})
	return result.RowsAffected, result.Error
}

func (s *SQLiteStorage) CleanupPublishedPayloads(olderThan time.Duration) (int64, error) {
	cutoff := time.Now().Add(-olderThan)
	result := s.db.Where("published = ? AND created_at < ?", true, cutoff).Delete(&PayloadRecord{})
	return result.RowsAffected, result.Error
}

func (s *SQLiteStorage) BuildPayloadFromData(records []DataRecord) (string, map[string]interface{}, error) {
	if len(records) == 0 {
		return "", nil, fmt.Errorf("no records provided")
	}

	dataMap := make(map[string]interface{})
	var timestamp int64

	for _, r := range records {
		dataMap[r.DataPoint] = map[string]interface{}{
			"value": r.Value,
			"unit":  r.Unit,
			"alarm": r.Alarm,
		}
		if r.Timestamp > timestamp {
			timestamp = r.Timestamp
		}
	}

	payload := map[string]interface{}{
		"deviceId":  records[0].DeviceID,
		"timestamp": timestamp,
		"data":      dataMap,
	}

	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		return "", nil, err
	}

	return string(jsonBytes), payload, nil
}

func (s *SQLiteStorage) GetStats() (map[string]interface{}, error) {
	var totalData int64
	var unpublishedData int64
	var totalPayloads int64
	var unpublishedPayloads int64

	s.db.Model(&DataRecord{}).Count(&totalData)
	s.db.Model(&DataRecord{}).Where("published = ?", false).Count(&unpublishedData)
	s.db.Model(&PayloadRecord{}).Count(&totalPayloads)
	s.db.Model(&PayloadRecord{}).Where("published = ?", false).Count(&unpublishedPayloads)

	return map[string]interface{}{
		"total_data_records":       totalData,
		"unpublished_data_records": unpublishedData,
		"total_payloads":           totalPayloads,
		"unpublished_payloads":     unpublishedPayloads,
	}, nil
}

func (s *SQLiteStorage) Close() error {
	sqlDB, err := s.db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}

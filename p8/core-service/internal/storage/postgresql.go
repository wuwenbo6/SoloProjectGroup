package storage

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"sync"
	"time"

	_ "github.com/lib/pq"
	"go.uber.org/zap"

	"iot-core-service/internal/models"
	"iot-core-service/pkg/config"
)

const (
	deviceBatchSize  = 100
	deviceFlushInterval = 500 * time.Millisecond
)

type PostgreSQLStorage struct {
	db          *sql.DB
	logger      *zap.Logger
	deviceCache map[string]time.Time
	cacheMutex  sync.Mutex
	cacheCtx    context.Context
	cacheCancel context.CancelFunc
	cacheWG     sync.WaitGroup
}

func NewPostgreSQLStorage(cfg *config.PostgreSQLConfig, logger *zap.Logger) (*PostgreSQLStorage, error) {
	connStr := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=disable",
		cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.DBName)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(25)
	db.SetConnMaxLifetime(5 * time.Minute)

	ctx, cancel := context.WithCancel(context.Background())

	storage := &PostgreSQLStorage{
		db:          db,
		logger:      logger,
		deviceCache: make(map[string]time.Time),
		cacheCtx:    ctx,
		cacheCancel: cancel,
	}

	storage.cacheWG.Add(1)
	go storage.deviceCacheFlusher()

	logger.Info("PostgreSQL connected successfully with batch upsert")

	return storage, nil
}

func (s *PostgreSQLStorage) UpsertDevice(ctx context.Context, deviceID string, timestamp int64) error {
	t := time.Unix(0, timestamp*int64(time.Millisecond))

	s.cacheMutex.Lock()
	if lastSeen, exists := s.deviceCache[deviceID]; exists && t.Sub(lastSeen) < 10*time.Second {
		s.cacheMutex.Unlock()
		return nil
	}
	s.deviceCache[deviceID] = t
	cacheSize := len(s.deviceCache)
	s.cacheMutex.Unlock()

	if cacheSize >= deviceBatchSize {
		go s.FlushDeviceCache()
	}

	return nil
}

func (s *PostgreSQLStorage) deviceCacheFlusher() {
	defer s.cacheWG.Done()

	ticker := time.NewTicker(deviceFlushInterval)
	defer ticker.Stop()

	for {
		select {
		case <-s.cacheCtx.Done():
			s.FlushDeviceCache()
			return
		case <-ticker.C:
			s.FlushDeviceCache()
		}
	}
}

func (s *PostgreSQLStorage) FlushDeviceCache() {
	s.cacheMutex.Lock()
	if len(s.deviceCache) == 0 {
		s.cacheMutex.Unlock()
		return
	}

	cacheCopy := make(map[string]time.Time)
	for k, v := range s.deviceCache {
		cacheCopy[k] = v
	}
	s.deviceCache = make(map[string]time.Time)
	s.cacheMutex.Unlock()

	if err := s.BatchUpsertDevices(context.Background(), cacheCopy); err != nil {
		s.logger.Error("Failed to batch upsert devices", zap.Error(err))
	}
}

func (s *PostgreSQLStorage) BatchUpsertDevices(ctx context.Context, devices map[string]time.Time) error {
	if len(devices) == 0 {
		return nil
	}

	valueStrings := make([]string, 0, len(devices))
	valueArgs := make([]interface{}, 0, len(devices)*2)
	i := 0

	for deviceID, lastSeen := range devices {
		valueStrings = append(valueStrings, fmt.Sprintf("($%d, $%d, $%d, $%d)", i*4+1, i*4+2, i*4+3, i*4+4))
		valueArgs = append(valueArgs, deviceID, "online", lastSeen, lastSeen)
		i++
	}

	query := fmt.Sprintf(`
		INSERT INTO devices (device_id, status, last_seen, updated_at)
		VALUES %s
		ON CONFLICT (device_id) DO UPDATE
		SET last_seen = EXCLUDED.last_seen, updated_at = EXCLUDED.updated_at, status = EXCLUDED.status
	`, strings.Join(valueStrings, ","))

	_, err := s.db.ExecContext(ctx, query, valueArgs...)
	if err != nil {
		s.logger.Error("Failed to batch upsert devices",
			zap.Int("count", len(devices)),
			zap.Error(err))
		return err
	}

	return nil
}

func (s *PostgreSQLStorage) GetDevice(ctx context.Context, deviceID string) (*models.Device, error) {
	query := `
		SELECT id, device_id, device_name, device_type, status, last_seen, created_at, updated_at
		FROM devices
		WHERE device_id = $1
	`

	var device models.Device
	err := s.db.QueryRowContext(ctx, query, deviceID).Scan(
		&device.ID, &device.DeviceID, &device.DeviceName, &device.DeviceType,
		&device.Status, &device.LastSeen, &device.CreatedAt, &device.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		s.logger.Error("Failed to get device",
			zap.String("device_id", deviceID),
			zap.Error(err))
		return nil, err
	}

	return &device, nil
}

func (s *PostgreSQLStorage) InsertAnomalyRecord(ctx context.Context, record *models.AnomalyRecord) error {
	query := `
		INSERT INTO anomaly_records (device_id, anomaly_type, confidence, metric, timestamp, description, data_json)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at
	`

	err := s.db.QueryRowContext(ctx, query,
		record.DeviceID, record.AnomalyType, record.Confidence,
		record.Metric, record.Timestamp, record.Description, record.DataJSON,
	).Scan(&record.ID, &record.CreatedAt)

	if err != nil {
		s.logger.Error("Failed to insert anomaly record",
			zap.String("device_id", record.DeviceID),
			zap.Error(err))
		return err
	}

	return nil
}

func (s *PostgreSQLStorage) GetAnomalyRecords(ctx context.Context, deviceID string, startTime, endTime time.Time) ([]models.AnomalyRecord, error) {
	query := `
		SELECT id, device_id, anomaly_type, confidence, metric, timestamp, description, data_json, created_at
		FROM anomaly_records
		WHERE device_id = $1 AND timestamp >= $2 AND timestamp <= $3
		ORDER BY timestamp DESC
	`

	rows, err := s.db.QueryContext(ctx, query, deviceID, startTime, endTime)
	if err != nil {
		s.logger.Error("Failed to query anomaly records",
			zap.String("device_id", deviceID),
			zap.Error(err))
		return nil, err
	}
	defer rows.Close()

	var records []models.AnomalyRecord
	for rows.Next() {
		var record models.AnomalyRecord
		err := rows.Scan(
			&record.ID, &record.DeviceID, &record.AnomalyType, &record.Confidence,
			&record.Metric, &record.Timestamp, &record.Description, &record.DataJSON,
			&record.CreatedAt,
		)
		if err != nil {
			s.logger.Error("Failed to scan anomaly record", zap.Error(err))
			return nil, err
		}
		records = append(records, record)
	}

	return records, nil
}

func (s *PostgreSQLStorage) Close() error {
	s.cacheCancel()
	s.cacheWG.Wait()
	return s.db.Close()
}

func (s *PostgreSQLStorage) GetDB() *sql.DB {
	return s.db
}

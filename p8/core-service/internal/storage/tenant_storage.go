package storage

import (
	"context"
	"database/sql"
	"fmt"
	"sync"
	"time"

	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
	"github.com/influxdata/influxdb-client-go/v2/api"
	"go.uber.org/zap"

	"iot-core-service/internal/models"
	"iot-core-service/pkg/config"
)

type TenantStorage struct {
	logger         *zap.Logger
	cfg            *config.Config
	influxClient   influxdb2.Client
	pgDB           *sql.DB
	tenantBuckets  map[string]*TenantBucket
	tenantDBs      map[string]*sql.DB
	mu             sync.RWMutex
	batchWriters   map[string]*BatchWriter
}

type TenantBucket struct {
	BucketName string
	Org        string
	WriteAPI   api.WriteAPI
	QueryAPI   api.QueryAPI
}

func NewTenantStorage(cfg *config.Config, influxClient influxdb2.Client, pgDB *sql.DB, logger *zap.Logger) (*TenantStorage, error) {
	ts := &TenantStorage{
		logger:        logger,
		cfg:           cfg,
		influxClient:  influxClient,
		pgDB:          pgDB,
		tenantBuckets: make(map[string]*TenantBucket),
		tenantDBs:     make(map[string]*sql.DB),
		batchWriters:  make(map[string]*BatchWriter),
	}

	if err := ts.initializeDefaultTenant(); err != nil {
		return nil, fmt.Errorf("failed to initialize default tenant: %w", err)
	}

	return ts, nil
}

func (ts *TenantStorage) initializeDefaultTenant() error {
	defaultTenant := "default"
	if err := ts.CreateTenant(context.Background(), defaultTenant); err != nil {
		ts.logger.Warn("Default tenant may already exist", zap.Error(err))
	}
	return nil
}

func (ts *TenantStorage) CreateTenant(ctx context.Context, tenantID string) error {
	ts.mu.Lock()
	defer ts.mu.Unlock()

	if _, exists := ts.tenantBuckets[tenantID]; exists {
		return fmt.Errorf("tenant %s already exists", tenantID)
	}

	bucketName := fmt.Sprintf("tenant_%s_data", tenantID)
	org := ts.cfg.InfluxDB.Org

	orgsAPI := ts.influxClient.OrganizationsAPI()
	bucketsAPI := ts.influxClient.BucketsAPI()

	_, err := bucketsAPI.CreateBucketWithName(ctx, bucketName, org, nil)
	if err != nil {
		ts.logger.Warn("Bucket may already exist", zap.String("bucket", bucketName), zap.Error(err))
	}

	writeAPI := ts.influxClient.WriteAPI(org, bucketName)
	queryAPI := ts.influxClient.QueryAPI(org)

	ts.tenantBuckets[tenantID] = &TenantBucket{
		BucketName: bucketName,
		Org:        org,
		WriteAPI:   writeAPI,
		QueryAPI:   queryAPI,
	}

	ts.batchWriters[tenantID] = NewBatchWriter(ts.influxClient, org, bucketName, ts.logger)

	schemaName := fmt.Sprintf("tenant_%s", tenantID)
	if err := ts.createTenantSchema(ctx, schemaName); err != nil {
		return fmt.Errorf("failed to create tenant schema: %w", err)
	}

	ts.logger.Info("Tenant created successfully",
		zap.String("tenant_id", tenantID),
		zap.String("bucket", bucketName),
		zap.String("schema", schemaName))

	return nil
}

func (ts *TenantStorage) createTenantSchema(ctx context.Context, schemaName string) error {
	queries := []string{
		fmt.Sprintf("CREATE SCHEMA IF NOT EXISTS %s", schemaName),
		fmt.Sprintf(`CREATE TABLE IF NOT EXISTS %s.device_metadata (
			id SERIAL PRIMARY KEY,
			device_id VARCHAR(100) UNIQUE NOT NULL,
			name VARCHAR(200),
			type VARCHAR(100),
			metadata JSONB,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`, schemaName),
		fmt.Sprintf(`CREATE TABLE IF NOT EXISTS %s.anomaly_records (
			id SERIAL PRIMARY KEY,
			device_id VARCHAR(100) NOT NULL,
			metric VARCHAR(100) NOT NULL,
			anomaly_type VARCHAR(100) NOT NULL,
			severity VARCHAR(50) NOT NULL,
			confidence FLOAT,
			timestamp TIMESTAMP NOT NULL,
			metadata JSONB,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`, schemaName),
		fmt.Sprintf(`CREATE TABLE IF NOT EXISTS %s.webhook_configs (
			id SERIAL PRIMARY KEY,
			device_id VARCHAR(100) NOT NULL,
			url VARCHAR(500) NOT NULL,
			secret VARCHAR(200),
			events TEXT[],
			enabled BOOLEAN DEFAULT TRUE,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`, schemaName),
	}

	for _, query := range queries {
		if _, err := ts.pgDB.ExecContext(ctx, query); err != nil {
			return err
		}
	}

	return nil
}

func (ts *TenantStorage) DeleteTenant(ctx context.Context, tenantID string) error {
	ts.mu.Lock()
	defer ts.mu.Unlock()

	if _, exists := ts.tenantBuckets[tenantID]; !exists {
		return fmt.Errorf("tenant %s not found", tenantID)
	}

	bucketName := fmt.Sprintf("tenant_%s_data", tenantID)
	bucketsAPI := ts.influxClient.BucketsAPI()
	bucket, err := bucketsAPI.FindBucketByName(ctx, bucketName)
	if err == nil && bucket != nil {
		if err := bucketsAPI.DeleteBucket(ctx, bucket); err != nil {
			ts.logger.Warn("Failed to delete bucket", zap.String("bucket", bucketName), zap.Error(err))
		}
	}

	schemaName := fmt.Sprintf("tenant_%s", tenantID)
	if _, err := ts.pgDB.ExecContext(ctx, fmt.Sprintf("DROP SCHEMA IF EXISTS %s CASCADE", schemaName)); err != nil {
		ts.logger.Warn("Failed to drop schema", zap.String("schema", schemaName), zap.Error(err))
	}

	if batchWriter, ok := ts.batchWriters[tenantID]; ok {
		batchWriter.Close()
	}

	delete(ts.tenantBuckets, tenantID)
	delete(ts.batchWriters, tenantID)

	ts.logger.Info("Tenant deleted successfully", zap.String("tenant_id", tenantID))
	return nil
}

func (ts *TenantStorage) GetTenantBucket(tenantID string) (*TenantBucket, error) {
	ts.mu.RLock()
	defer ts.mu.RUnlock()

	bucket, exists := ts.tenantBuckets[tenantID]
	if !exists {
		return nil, fmt.Errorf("tenant %s not found", tenantID)
	}
	return bucket, nil
}

func (ts *TenantStorage) WriteDataPoint(ctx context.Context, tenantID string, point *models.DeviceDataPoint) error {
	ts.mu.RLock()
	batchWriter, exists := ts.batchWriters[tenantID]
	ts.mu.RUnlock()

	if !exists {
		return fmt.Errorf("tenant %s not found", tenantID)
	}

	influxPoint := influxdb2.NewPointWithMeasurement("device_metrics").
		AddTag("device_id", point.DeviceID).
		SetTime(time.Unix(0, point.Timestamp*int64(time.Millisecond)))

	for k, v := range point.Metrics {
		influxPoint.AddField(k, v)
	}

	return batchWriter.WriteAsync(influxPoint)
}

func (ts *TenantStorage) WriteBatch(ctx context.Context, tenantID string, points []*models.DeviceDataPoint) (int, error) {
	ts.mu.RLock()
	batchWriter, exists := ts.batchWriters[tenantID]
	ts.mu.RUnlock()

	if !exists {
		return 0, fmt.Errorf("tenant %s not found", tenantID)
	}

	influxPoints := make([]*influxdb2.Point, 0, len(points))
	for _, point := range points {
		p := influxdb2.NewPointWithMeasurement("device_metrics").
			AddTag("device_id", point.DeviceID).
			SetTime(time.Unix(0, point.Timestamp*int64(time.Millisecond)))

		for k, v := range point.Metrics {
			p.AddField(k, v)
		}
		influxPoints = append(influxPoints, p)
	}

	return batchWriter.WriteBatch(influxPoints), nil
}

func (ts *TenantStorage) Query(ctx context.Context, tenantID string, req *models.QueryRequest) ([]models.QueryResult, error) {
	ts.mu.RLock()
	bucket, exists := ts.tenantBuckets[tenantID]
	ts.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("tenant %s not found", tenantID)
	}

	metricFilter := ""
	if req.MetricType != "" {
		metricFilter = fmt.Sprintf(`|> filter(fn: (r) => r._field == "%s")`, req.MetricType)
	}

	var aggFunc string
	switch req.Aggregation {
	case "mean":
		aggFunc = "mean"
	case "max":
		aggFunc = "max"
	case "min":
		aggFunc = "min"
	case "count":
		aggFunc = "count"
	case "sum":
		aggFunc = "sum"
	default:
		aggFunc = "mean"
	}

	fluxQuery := fmt.Sprintf(`
		from(bucket: "%s")
			|> range(start: %d, stop: %d)
			|> filter(fn: (r) => r._measurement == "device_metrics")
			|> filter(fn: (r) => r.device_id == "%s")
			%s
			|> aggregateWindow(every: 1m, fn: %s)
			|> yield(name: "%s")
	`, bucket.BucketName, req.StartTime.Unix(), req.EndTime.Unix(), req.DeviceID, metricFilter, aggFunc, aggFunc)

	result, err := bucket.QueryAPI.Query(ctx, fluxQuery)
	if err != nil {
		return nil, err
	}
	defer result.Close()

	var results []models.QueryResult
	for result.Next() {
		if result.Record().Time().IsZero() {
			continue
		}

		value, ok := result.Record().Value().(float64)
		if !ok {
			continue
		}

		results = append(results, models.QueryResult{
			Timestamp: result.Record().Time(),
			DeviceID:  req.DeviceID,
			Metric:    result.Record().Field(),
			Value:     value,
		})
	}

	if result.Err() != nil {
		return nil, result.Err()
	}

	return results, nil
}

func (ts *TenantStorage) GetTenantDB(tenantID string) (*sql.DB, error) {
	return ts.pgDB, nil
}

func (ts *TenantStorage) ListTenants(ctx context.Context) []string {
	ts.mu.RLock()
	defer ts.mu.RUnlock()

	tenants := make([]string, 0, len(ts.tenantBuckets))
	for tenantID := range ts.tenantBuckets {
		tenants = append(tenants, tenantID)
	}
	return tenants
}

func (ts *TenantStorage) Close() {
	ts.mu.Lock()
	defer ts.mu.Unlock()

	for _, bw := range ts.batchWriters {
		bw.Close()
	}

	ts.influxClient.Close()
}

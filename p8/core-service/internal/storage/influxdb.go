package storage

import (
	"context"
	"fmt"
	"time"

	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
	"github.com/influxdata/influxdb-client-go/v2/api"
	"go.uber.org/zap"

	"iot-core-service/internal/models"
	"iot-core-service/pkg/config"
)

const (
	maxQueryTimeout = 30 * time.Second
)

type InfluxDBStorage struct {
	Client      influxdb2.Client
	writeAPI    api.WriteAPI
	queryAPI    api.QueryAPI
	bucket      string
	org         string
	logger      *zap.Logger
	batchWriter *BatchWriter
	ctx         context.Context
	cancel      context.CancelFunc
}

func NewInfluxDBStorage(cfg *config.InfluxDBConfig, logger *zap.Logger) (*InfluxDBStorage, error) {
	options := influxdb2.DefaultOptions()
	options.SetBatchSize(10000)
	options.SetFlushInterval(50)
	options.SetMaxRetries(5)
	options.SetRetryInterval(250)
	options.SetMaxRetryInterval(5000)
	options.SetMaxRetryTime(30000)
	options.SetUseGZip(true)

	client := influxdb2.NewClientWithOptions(cfg.URL, cfg.Token, options)
	queryAPI := client.QueryAPI(cfg.Org)
	writeAPI := client.WriteAPI(cfg.Org, cfg.Bucket)

	healthCtx, healthCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer healthCancel()
	health, err := client.Health(healthCtx)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to InfluxDB: %w", err)
	}

	if health.Status != "pass" {
		return nil, fmt.Errorf("InfluxDB health check failed: %s", health.Status)
	}

	ctx, cancel := context.WithCancel(context.Background())

	storage := &InfluxDBStorage{
		Client:   client,
		writeAPI: writeAPI,
		queryAPI: queryAPI,
		bucket:   cfg.Bucket,
		org:      cfg.Org,
		logger:   logger,
		ctx:      ctx,
		cancel:   cancel,
	}

	storage.batchWriter = NewBatchWriter(client, cfg.Org, cfg.Bucket, logger)

	errorsCh := writeAPI.Errors()
	go func() {
		for err := range errorsCh {
			logger.Error("InfluxDB write error", zap.Error(err))
		}
	}()

	logger.Info("InfluxDB connected successfully with high-performance batch writer")

	return storage, nil
}

func (s *InfluxDBStorage) WriteDataPoint(ctx context.Context, point *models.DeviceDataPoint) error {
	p := influxdb2.NewPointWithMeasurement("device_metrics").
		AddTag("device_id", point.DeviceID).
		SetTime(time.Unix(0, point.Timestamp*int64(time.Millisecond)))

	for k, v := range point.Metrics {
		p.AddField(k, v)
	}

	return s.batchWriter.WriteAsync(p)
}

func (s *InfluxDBStorage) WriteBatch(ctx context.Context, points []*models.DeviceDataPoint) (int, error) {
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

	return s.batchWriter.WriteBatch(influxPoints), nil
}

func (s *InfluxDBStorage) Query(ctx context.Context, req *models.QueryRequest) ([]models.QueryResult, error) {
	queryCtx, cancel := context.WithTimeout(ctx, maxQueryTimeout)
	defer cancel()

	var fluxQuery string

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

	fluxQuery = fmt.Sprintf(`
		from(bucket: "%s")
			|> range(start: %d, stop: %d)
			|> filter(fn: (r) => r._measurement == "device_metrics")
			|> filter(fn: (r) => r.device_id == "%s")
			%s
			|> aggregateWindow(every: 1m, fn: %s)
			|> yield(name: "%s")
	`, s.bucket, req.StartTime.Unix(), req.EndTime.Unix(), req.DeviceID, metricFilter, aggFunc, aggFunc)

	result, err := s.queryAPI.Query(queryCtx, fluxQuery)
	if err != nil {
		s.logger.Error("Failed to query InfluxDB", zap.Error(err))
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

func (s *InfluxDBStorage) GetWriteMetrics() BatchMetrics {
	return s.batchWriter.GetMetrics()
}

func (s *InfluxDBStorage) GetClient() influxdb2.Client {
	return s.Client
}

func (s *InfluxDBStorage) Close() {
	s.cancel()
	s.batchWriter.Close()
	s.writeAPI.Flush()
	s.Client.Close()
	s.logger.Info("InfluxDB storage closed gracefully")
}

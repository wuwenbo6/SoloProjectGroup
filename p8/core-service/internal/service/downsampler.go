package service

import (
	"context"
	"fmt"
	"time"

	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
	"github.com/influxdata/influxdb-client-go/v2/api"
	"go.uber.org/zap"
)

const (
	defaultRetentionDays     = 30
	downsampleInterval       = "1h"
	downsampleRunInterval    = 6 * time.Hour
	downsampleBatchSize      = 10000
)

type DownsamplerService struct {
	influxClient influxdb2.Client
	writeAPI     api.WriteAPI
	queryAPI     api.QueryAPI
	logger       *zap.Logger
	bucket       string
	org          string
	retentionDays int
	ctx          context.Context
	cancel       context.CancelFunc
}

func NewDownsamplerService(
	influxClient influxdb2.Client,
	bucket, org string,
	retentionDays int,
	logger *zap.Logger,
) *DownsamplerService {
	if retentionDays <= 0 {
		retentionDays = defaultRetentionDays
	}

	ctx, cancel := context.WithCancel(context.Background())

	return &DownsamplerService{
		influxClient: influxClient,
		writeAPI:     influxClient.WriteAPI(org, bucket+"_downsampled"),
		queryAPI:     influxClient.QueryAPI(org),
		logger:       logger,
		bucket:       bucket,
		org:          org,
		retentionDays: retentionDays,
		ctx:          ctx,
		cancel:       cancel,
	}
}

func (d *DownsamplerService) Start() {
	d.logger.Info("Downsampler service started",
		zap.Int("retention_days", d.retentionDays),
		zap.String("interval", downsampleInterval))

	go d.runScheduler()
}

func (d *DownsamplerService) runScheduler() {
	ticker := time.NewTicker(downsampleRunInterval)
	defer ticker.Stop()

	for {
		select {
		case <-d.ctx.Done():
			d.logger.Info("Downsampler service stopped")
			return
		case <-ticker.C:
			d.runDownsample()
		}
	}
}

func (d *DownsamplerService) runDownsample() {
	d.logger.Info("Starting downsample process")

	startTime := time.Now()
	cutoffTime := time.Now().AddDate(0, 0, -d.retentionDays)

	devices, err := d.getDeviceList()
	if err != nil {
		d.logger.Error("Failed to get device list for downsampling", zap.Error(err))
		return
	}

	totalProcessed := 0
	for _, deviceID := range devices {
		count, err := d.downsampleDevice(deviceID, cutoffTime)
		if err != nil {
			d.logger.Error("Failed to downsample device",
				zap.String("device_id", deviceID),
				zap.Error(err))
			continue
		}
		totalProcessed += count
	}

	d.logger.Info("Downsample process completed",
		zap.Int("total_points", totalProcessed),
		zap.Duration("duration", time.Since(startTime)))
}

func (d *DownsamplerService) getDeviceList() ([]string, error) {
	query := fmt.Sprintf(`
		import "influxdata/influxdb/schema"

		schema.tagValues(
			bucket: "%s",
			tag: "device_id",
			start: -%dd
		)
	`, d.bucket, d.retentionDays)

	result, err := d.queryAPI.Query(d.ctx, query)
	if err != nil {
		return nil, err
	}
	defer result.Close()

	var devices []string
	for result.Next() {
		if deviceID, ok := result.Record().Value().(string); ok {
			devices = append(devices, deviceID)
		}
	}

	return devices, result.Err()
}

func (d *DownsamplerService) downsampleDevice(deviceID string, cutoffTime time.Time) (int, error) {
	metrics, err := d.getMetricList(deviceID, cutoffTime)
	if err != nil {
		return 0, err
	}

	totalCount := 0
	for _, metric := range metrics {
		count, err := d.downsampleDeviceMetric(deviceID, metric, cutoffTime)
		if err != nil {
			d.logger.Warn("Failed to downsample metric",
				zap.String("device_id", deviceID),
				zap.String("metric", metric),
				zap.Error(err))
			continue
		}
		totalCount += count
	}

	return totalCount, nil
}

func (d *DownsamplerService) getMetricList(deviceID string, cutoffTime time.Time) ([]string, error) {
	query := fmt.Sprintf(`
		import "influxdata/influxdb/schema"

		schema.measurementFieldKeys(
			bucket: "%s",
			measurement: "device_metrics",
			start: %d,
			stop: %d
		)
		|> filter(fn: (r) => r.device_id == "%s")
	`, d.bucket, cutoffTime.UnixNano(), time.Now().UnixNano(), deviceID)

	result, err := d.queryAPI.Query(d.ctx, query)
	if err != nil {
		return nil, err
	}
	defer result.Close()

	var metrics []string
	for result.Next() {
		if metric, ok := result.Record().Value().(string); ok {
			metrics = append(metrics, metric)
		}
	}

	return metrics, result.Err()
}

func (d *DownsamplerService) downsampleDeviceMetric(deviceID, metric string, cutoffTime time.Time) (int, error) {
	query := fmt.Sprintf(`
		from(bucket: "%s")
			|> range(start: %d, stop: %d)
			|> filter(fn: (r) => r._measurement == "device_metrics")
			|> filter(fn: (r) => r.device_id == "%s")
			|> filter(fn: (r) => r._field == "%s")
			|> aggregateWindow(every: %s, fn: mean, createEmpty: false)
			|> yield(name: "mean")
	`, d.bucket, 0, cutoffTime.UnixNano(), deviceID, metric, downsampleInterval)

	result, err := d.queryAPI.Query(d.ctx, query)
	if err != nil {
		return 0, err
	}
	defer result.Close()

	count := 0
	for result.Next() {
		record := result.Record()
		if value, ok := record.Value().(float64); ok {
			p := influxdb2.NewPointWithMeasurement("device_metrics_downsampled")
			p.AddTag("device_id", deviceID)
			p.AddTag("metric", metric)
			p.AddTag("aggregation", "hourly_mean")
			p.AddField("value", value)
			p.SetTime(record.Time())
			d.writeAPI.WritePoint(p)
			count++
		}
	}

	d.writeAPI.Flush()

	if err := result.Err(); err != nil {
		return count, err
	}

	if count > 0 {
		if err := d.deleteOldData(deviceID, metric, cutoffTime); err != nil {
			d.logger.Warn("Failed to delete old raw data",
				zap.String("device_id", deviceID),
				zap.String("metric", metric),
				zap.Error(err))
		}
	}

	return count, nil
}

func (d *DownsamplerService) deleteOldData(deviceID, metric string, cutoffTime time.Time) error {
	deleteAPI := d.influxClient.DeleteAPI()

	predicate := fmt.Sprintf(`_measurement="device_metrics" AND device_id="%s" AND _field="%s"`,
		deviceID, metric)

	err := deleteAPI.DeleteWithName(
		d.ctx,
		d.org,
		d.bucket,
		time.Unix(0, 0),
		cutoffTime,
		predicate,
	)

	if err != nil {
		return err
	}

	d.logger.Debug("Deleted old raw data",
		zap.String("device_id", deviceID),
		zap.String("metric", metric),
		zap.Time("cutoff", cutoffTime))

	return nil
}

func (d *DownsamplerService) RunNow() {
	d.runDownsample()
}

func (d *DownsamplerService) Stop() {
	d.cancel()
	d.writeAPI.Flush()
}

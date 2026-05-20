package storage

import (
	"sync"
	"sync/atomic"
	"time"

	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
	"github.com/influxdata/influxdb-client-go/v2/api"
	"go.uber.org/zap"
)

const (
	defaultBatchSize     = 5000
	defaultFlushInterval = 100 * time.Millisecond
	defaultMaxRetries    = 3
	defaultRetryInterval = 250 * time.Millisecond
)

type BatchMetrics struct {
	TotalPoints    uint64 `json:"total_points"`
	SuccessPoints  uint64 `json:"success_points"`
	FailedPoints   uint64 `json:"failed_points"`
	PendingPoints  int    `json:"pending_points"`
	ActiveWorkers  int    `json:"active_workers"`
	TotalBatches   uint64 `json:"total_batches"`
	LastError      string `json:"last_error"`
}

type BatchWriter struct {
	client      influxdb2.Client
	writeAPI    api.WriteAPI
	org         string
	bucket      string
	logger      *zap.Logger
	pointChan   chan *influxdb2.Point
	workerCount int
	wg          sync.WaitGroup
	stopChan    chan struct{}
	metrics     BatchMetrics
}

func NewBatchWriter(client influxdb2.Client, org, bucket string, logger *zap.Logger) *BatchWriter {
	bw := &BatchWriter{
		client:      client,
		org:         org,
		bucket:      bucket,
		logger:      logger,
		workerCount: 8,
		pointChan:   make(chan *influxdb2.Point, 100000),
		stopChan:    make(chan struct{}),
	}

	opts := influxdb2.DefaultOptions()
	opts.SetBatchSize(defaultBatchSize)
	opts.SetFlushInterval(uint(defaultFlushInterval.Milliseconds()))
	opts.SetMaxRetries(defaultMaxRetries)
	opts.SetRetryInterval(uint(defaultRetryInterval.Milliseconds()))
	opts.SetUseGZip(true)
	opts.SetPrecision(time.Millisecond)

	bw.writeAPI = client.WriteAPI(org, bucket)

	bw.writeAPI.SetWriteFailedCallback(func(batch api.Batch, err error, retryCount int) bool {
		atomic.AddUint64(&bw.metrics.FailedPoints, uint64(len(batch.Points())))
		bw.metrics.LastError = err.Error()
		bw.logger.Warn("Write failed",
			zap.Int("batch_size", len(batch.Points())),
			zap.Int("retry_count", retryCount),
			zap.Error(err))
		return retryCount < defaultMaxRetries
	})

	bw.wg.Add(bw.workerCount)
	for i := 0; i < bw.workerCount; i++ {
		go bw.worker(i)
	}

	return bw
}

func (bw *BatchWriter) worker(id int) {
	defer bw.wg.Done()

	ticker := time.NewTicker(defaultFlushInterval)
	defer ticker.Stop()

	for {
		select {
		case point, ok := <-bw.pointChan:
			if !ok {
				return
			}
			bw.writeAPI.WritePoint(point)
			atomic.AddUint64(&bw.metrics.TotalPoints, 1)
		case <-ticker.C:
			bw.writeAPI.Flush()
		case <-bw.stopChan:
			return
		}
	}
}

func (bw *BatchWriter) WriteAsync(point *influxdb2.Point) error {
	select {
	case bw.pointChan <- point:
		return nil
	default:
		return nil
	}
}

func (bw *BatchWriter) WriteBatch(points []*influxdb2.Point) int {
	written := 0
	for _, point := range points {
		select {
		case bw.pointChan <- point:
			written++
		default:
			break
		}
	}
	return written
}

func (bw *BatchWriter) GetMetrics() BatchMetrics {
	atomic.AddUint64(&bw.metrics.TotalBatches, 1)
	return BatchMetrics{
		TotalPoints:   atomic.LoadUint64(&bw.metrics.TotalPoints),
		SuccessPoints: atomic.LoadUint64(&bw.metrics.SuccessPoints),
		FailedPoints:  atomic.LoadUint64(&bw.metrics.FailedPoints),
		PendingPoints: len(bw.pointChan),
		ActiveWorkers: bw.workerCount,
		TotalBatches:  atomic.LoadUint64(&bw.metrics.TotalBatches),
		LastError:     bw.metrics.LastError,
	}
}

func (bw *BatchWriter) Close() {
	close(bw.stopChan)
	bw.wg.Wait()
	bw.writeAPI.Flush()
	bw.client.Close()
}

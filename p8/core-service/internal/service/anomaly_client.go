package service

import (
	"context"
	"fmt"
	"sync"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/connectivity"
	"google.golang.org/grpc/credentials/insecure"
	"go.uber.org/zap"

	"iot-core-service/internal/models"
	anomalyPb "iot-core-service/pb/anomaly"
	"iot-core-service/pkg/config"
)

const (
	maxPoolSize      = 5
	maxBatchSize     = 100
	healthCheckInterval = 30 * time.Second
	requestTimeout    = 3 * time.Second
)

type AnomalyDetectionClient struct {
	addr     string
	conns    chan *grpc.ClientConn
	clients  chan anomalyPb.AnomalyDetectionServiceClient
	logger   *zap.Logger
	ctx      context.Context
	cancel   context.CancelFunc
	wg       sync.WaitGroup
	connOnce sync.Once
}

func NewAnomalyDetectionClient(cfg *config.AnomalyDetectionConfig, logger *zap.Logger) (*AnomalyDetectionClient, error) {
	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)

	ctx, cancel := context.WithCancel(context.Background())

	client := &AnomalyDetectionClient{
		addr:    addr,
		conns:   make(chan *grpc.ClientConn, maxPoolSize),
		clients: make(chan anomalyPb.AnomalyDetectionServiceClient, maxPoolSize),
		logger:  logger,
		ctx:     ctx,
		cancel:  cancel,
	}

	if err := client.initPool(); err != nil {
		logger.Warn("Failed to initialize anomaly detection connection pool, will retry in background",
			zap.Error(err))
	}

	client.wg.Add(1)
	go client.healthChecker()

	logger.Info("Anomaly detection client initialized with connection pool",
		zap.String("addr", addr),
		zap.Int("pool_size", maxPoolSize))

	return client, nil
}

func (c *AnomalyDetectionClient) initPool() error {
	for i := 0; i < maxPoolSize; i++ {
		conn, err := c.createConnection()
		if err != nil {
			return err
		}
		c.conns <- conn
		c.clients <- anomalyPb.NewAnomalyDetectionServiceClient(conn)
	}
	return nil
}

func (c *AnomalyDetectionClient) createConnection() (*grpc.ClientConn, error) {
	conn, err := grpc.Dial(
		c.addr,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
		grpc.WithTimeout(5*time.Second),
		grpc.WithKeepaliveParams(grpc.KeepaliveParams{
			Time:                30 * time.Second,
			Timeout:             10 * time.Second,
			PermitWithoutStream: true,
		}),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to anomaly detection service: %w", err)
	}
	return conn, nil
}

func (c *AnomalyDetectionClient) healthChecker() {
	defer c.wg.Done()

	ticker := time.NewTicker(healthCheckInterval)
	defer ticker.Stop()

	for {
		select {
		case <-c.ctx.Done():
			return
		case <-ticker.C:
			c.checkAndReconnect()
		}
	}
}

func (c *AnomalyDetectionClient) checkAndReconnect() {
	for i := 0; i < maxPoolSize; i++ {
		select {
		case conn := <-c.conns:
			if conn.GetState() == connectivity.Shutdown ||
				conn.GetState() == connectivity.TransientFailure {
				c.logger.Warn("Connection unhealthy, recreating",
					zap.String("state", conn.GetState().String()))

				if err := conn.Close(); err != nil {
					c.logger.Warn("Failed to close unhealthy connection", zap.Error(err))
				}

				newConn, err := c.createConnection()
				if err != nil {
					c.logger.Error("Failed to recreate connection", zap.Error(err))
					c.conns <- conn
					<-c.clients
				} else {
					c.conns <- newConn
					c.clients <- anomalyPb.NewAnomalyDetectionServiceClient(newConn)
					continue
				}
			} else {
				c.conns <- conn
			}
		default:
		}
	}
}

func (c *AnomalyDetectionClient) Detect(ctx context.Context, deviceID string, dataPoints []*models.DeviceDataPoint) (*models.AnomalyDetectionResponse, error) {
	select {
	case <-c.ctx.Done():
		return nil, c.ctx.Err()
	case client := <-c.clients:
		defer func() {
			select {
			case c.clients <- client:
			default:
			}
		}()

		return c.doDetect(ctx, client, deviceID, dataPoints)
	case <-time.After(1 * time.Second):
		conn, err := c.createConnection()
		if err != nil {
			return nil, fmt.Errorf("no available connection and failed to create new: %w", err)
		}
		defer conn.Close()
		client := anomalyPb.NewAnomalyDetectionServiceClient(conn)
		return c.doDetect(ctx, client, deviceID, dataPoints)
	}
}

func (c *AnomalyDetectionClient) doDetect(ctx context.Context, client anomalyPb.AnomalyDetectionServiceClient, deviceID string, dataPoints []*models.DeviceDataPoint) (*models.AnomalyDetectionResponse, error) {
	pbPoints := make([]*anomalyPb.TimeSeriesPoint, 0, len(dataPoints))
	for _, dp := range dataPoints {
		for metric, value := range dp.Metrics {
			pbPoints = append(pbPoints, &anomalyPb.TimeSeriesPoint{
				Timestamp: dp.Timestamp,
				Value:     value,
				Metric:    metric,
			})
		}
	}

	if len(pbPoints) > maxBatchSize {
		pbPoints = pbPoints[:maxBatchSize]
	}

	req := &anomalyPb.DetectAnomalyRequest{
		DeviceId: deviceID,
		Data:     pbPoints,
	}

	ctxWithTimeout, cancel := context.WithTimeout(ctx, requestTimeout)
	defer cancel()

	resp, err := client.DetectAnomaly(ctxWithTimeout, req)
	if err != nil {
		c.logger.Warn("Anomaly detection call failed",
			zap.String("device_id", deviceID),
			zap.Error(err))
		return nil, err
	}

	anomalies := make([]models.AnomalyResult, len(resp.Anomalies))
	for i, a := range resp.Anomalies {
		anomalies[i] = models.AnomalyResult{
			AnomalyType: a.AnomalyType,
			Confidence:  a.Confidence,
			Timestamp:   a.Timestamp,
			Metric:      a.Metric,
			Description: a.Description,
		}
	}

	return &models.AnomalyDetectionResponse{
		DeviceID:   resp.DeviceId,
		Anomalies:  anomalies,
		HasAnomaly: resp.HasAnomaly,
	}, nil
}

func (c *AnomalyDetectionClient) Close() error {
	c.cancel()
	c.wg.Wait()

	close(c.clients)
	close(c.conns)

	for conn := range c.conns {
		if err := conn.Close(); err != nil {
			c.logger.Warn("Failed to close connection during shutdown", zap.Error(err))
		}
	}

	c.logger.Info("Anomaly detection client closed gracefully")
	return nil
}

package service

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"go.uber.org/zap"

	"iot-core-service/internal/models"
	"iot-core-service/internal/storage"
)

const (
	maxConcurrentDetectors = 10
	maxBatchSize           = 5000
)



type DataService struct {
	influxDB    *storage.InfluxDBStorage
	postgres    *storage.PostgreSQLStorage
	anomalyCli  *AnomalyDetectionClient
	webhookSvc  *WebhookService
	logger      *zap.Logger
	semaphore   chan struct{}
}

func NewDataService(
	influxDB *storage.InfluxDBStorage,
	postgres *storage.PostgreSQLStorage,
	anomalyCli *AnomalyDetectionClient,
	webhookSvc *WebhookService,
	logger *zap.Logger,
) *DataService {
	return &DataService{
		influxDB:   influxDB,
		postgres:   postgres,
		anomalyCli: anomalyCli,
		webhookSvc: webhookSvc,
		logger:     logger,
		semaphore:  make(chan struct{}, maxConcurrentDetectors),
	}
}

func (s *DataService) ProcessBatchData(ctx context.Context, req *models.BatchDataRequest) (*models.BatchDataResponse, error) {
	response := &models.BatchDataResponse{
		SuccessCount: 0,
		FailedCount:  0,
		Errors:       make([]string, 0),
	}

	if len(req.DataPoints) > maxBatchSize {
		response.Errors = append(response.Errors,
			fmt.Sprintf("batch size exceeds limit: %d > %d", len(req.DataPoints), maxBatchSize))
		return response, nil
	}

	deviceDataMap := make(map[string][]*models.DeviceDataPoint)
	writeCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	for i := range req.DataPoints {
		point := &req.DataPoints[i]
		if err := s.validateDataPoint(point); err != nil {
			response.FailedCount++
			if len(response.Errors) < 10 {
				response.Errors = append(response.Errors, err.Error())
			}
			continue
		}

		if err := s.influxDB.WriteDataPoint(writeCtx, point); err != nil {
			response.FailedCount++
			if len(response.Errors) < 10 {
				response.Errors = append(response.Errors, err.Error())
			}
			continue
		}

		if err := s.postgres.UpsertDevice(ctx, point.DeviceID, point.Timestamp); err != nil {
			s.logger.Debug("Failed to upsert device (will retry on flush)",
				zap.String("device_id", point.DeviceID),
				zap.Error(err))
		}

		deviceDataMap[point.DeviceID] = append(deviceDataMap[point.DeviceID], point)
		response.SuccessCount++
	}

	go s.detectAnomaliesAsync(deviceDataMap)

	return response, nil
}


func (s *DataService) validateDataPoint(point *models.DeviceDataPoint) error {
	if point.DeviceID == "" {
		return &ValidationError{Field: "device_id", Message: "device_id is required"}
	}
	if point.Timestamp <= 0 {
		return &ValidationError{Field: "timestamp", Message: "timestamp must be positive"}
	}
	if len(point.Metrics) == 0 {
		return &ValidationError{Field: "metrics", Message: "at least one metric is required"}
	}
	for metric, value := range point.Metrics {
		if metric == "" {
			return &ValidationError{Field: "metrics", Message: "metric name cannot be empty"}
		}
		if value < -1e18 || value > 1e18 {
			return &ValidationError{Field: "metrics", Message: "metric value out of range"}
		}
	}
	return nil
}

func (s *DataService) detectAnomaliesAsync(deviceDataMap map[string][]*models.DeviceDataPoint) {
	if s.anomalyCli == nil {
		return
	}

	ctx := context.Background()
	var wg sync.WaitGroup

	for deviceID, dataPoints := range deviceDataMap {
		select {
		case s.semaphore <- struct{}{}:
			wg.Add(1)
			go func(dID string, dps []*models.DeviceDataPoint) {
				defer wg.Done()
				defer func() { <-s.semaphore }()

				resp, err := s.anomalyCli.Detect(ctx, dID, dps)
				if err != nil {
					return
				}

				if resp.HasAnomaly {
					s.saveAnomalies(ctx, resp)
				}
			}(deviceID, dataPoints)
		default:
			s.logger.Debug("Skipping anomaly detection due to concurrency limit",
				zap.String("device_id", deviceID))
		}
	}

	wg.Wait()
}

func (s *DataService) saveAnomalies(ctx context.Context, resp *models.AnomalyDetectionResponse) {
	for _, anomaly := range resp.Anomalies {
		dataJSON, _ := json.Marshal(anomaly)

		record := &models.AnomalyRecord{
			DeviceID:    resp.DeviceID,
			AnomalyType: anomaly.AnomalyType,
			Confidence:  anomaly.Confidence,
			Metric:      anomaly.Metric,
			Timestamp:   time.Unix(0, anomaly.Timestamp*int64(time.Millisecond)),
			Description: anomaly.Description,
			DataJSON:    string(dataJSON),
		}

		if err := s.postgres.InsertAnomalyRecord(ctx, record); err != nil {
			s.logger.Error("Failed to save anomaly record",
				zap.String("device_id", resp.DeviceID),
				zap.Error(err))
		}
	}

	if s.webhookSvc != nil && len(resp.Anomalies) > 0 {
		go s.webhookSvc.SendAlert(ctx, resp.DeviceID, resp.Anomalies)
	}
}

func (s *DataService) QueryData(ctx context.Context, req *models.QueryRequest) (*models.QueryResponse, error) {
	results, err := s.influxDB.Query(ctx, req)
	if err != nil {
		return nil, err
	}

	return &models.QueryResponse{
		Data:  results,
		Count: len(results),
	}, nil
}

func (s *DataService) GetAnomalies(ctx context.Context, deviceID string, startTime, endTime time.Time) ([]models.AnomalyRecord, error) {
	return s.postgres.GetAnomalyRecords(ctx, deviceID, startTime, endTime)
}

type ValidationError struct {
	Field   string
	Message string
}

func (e *ValidationError) Error() string {
	return e.Field + ": " + e.Message
}

package storage

import (
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
	"go.uber.org/zap"

	"iot-core-service/internal/models"
	"iot-core-service/pkg/config"
)

const (
	HotRetentionDays  = 30
	ColdArchivePrefix = "cold-archive"
)

type TieredStorage struct {
	hotStorage    *InfluxDBStorage
	logger        *zap.Logger
	s3Client      *s3.S3
	s3Bucket      string
	s3Endpoint    string
	archiveDir    string
	archiveWorker int
	mu            sync.RWMutex
}

func NewTieredStorage(cfg *config.StorageConfig, hotStorage *InfluxDBStorage, logger *zap.Logger) (*TieredStorage, error) {
	ts := &TieredStorage{
		hotStorage:    hotStorage,
		logger:        logger,
		s3Bucket:      cfg.S3Bucket,
		s3Endpoint:    cfg.S3Endpoint,
		archiveDir:    cfg.ArchiveDir,
		archiveWorker: cfg.ArchiveWorkers,
	}

	if ts.archiveDir == "" {
		ts.archiveDir = "./data/archive"
	}

	if err := os.MkdirAll(ts.archiveDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create archive directory: %w", err)
	}

	if cfg.S3Enabled {
		sess, err := session.NewSession(&aws.Config{
			Region:           aws.String(cfg.S3Region),
			Endpoint:         aws.String(cfg.S3Endpoint),
			Credentials:      credentials.NewStaticCredentials(cfg.S3AccessKey, cfg.S3SecretKey, ""),
			S3ForcePathStyle: aws.Bool(true),
		})
		if err != nil {
			return nil, fmt.Errorf("failed to create S3 session: %w", err)
		}
		ts.s3Client = s3.New(sess)
	}

	return ts, nil
}

func (ts *TieredStorage) WriteDataPoint(ctx context.Context, point *models.DeviceDataPoint) error {
	return ts.hotStorage.WriteDataPoint(ctx, point)
}

func (ts *TieredStorage) WriteBatch(ctx context.Context, points []*models.DeviceDataPoint) (int, error) {
	return ts.hotStorage.WriteBatch(ctx, points)
}

func (ts *TieredStorage) Query(ctx context.Context, req *models.QueryRequest) ([]models.QueryResult, error) {
	hotResults, err := ts.hotStorage.Query(ctx, req)
	if err != nil {
		return nil, err
	}

	if req.EndTime.Before(time.Now().AddDate(0, 0, -HotRetentionDays)) {
		coldResults, err := ts.queryColdData(ctx, req)
		if err != nil {
			ts.logger.Warn("Failed to query cold data", zap.Error(err))
			return hotResults, nil
		}
		hotResults = append(hotResults, coldResults...)
	}

	return hotResults, nil
}

func (ts *TieredStorage) ArchiveColdData(ctx context.Context, endDate time.Time) (int, error) {
	ts.logger.Info("Starting cold data archive", zap.Time("end_date", endDate))

	startDate := endDate.AddDate(0, 0, -1)
	devices, err := ts.getAllDevices(ctx)
	if err != nil {
		return 0, fmt.Errorf("failed to get devices: %w", err)
	}

	sem := make(chan struct{}, ts.archiveWorker)
	var wg sync.WaitGroup
	totalArchived := 0
	var mu sync.Mutex

	for _, deviceID := range devices {
		wg.Add(1)
		go func(id string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			count, err := ts.archiveDeviceData(ctx, id, startDate, endDate)
			if err != nil {
				ts.logger.Error("Failed to archive device data",
					zap.String("device_id", id),
					zap.Error(err))
				return
			}

			mu.Lock()
			totalArchived += count
			mu.Unlock()
		}(deviceID)
	}

	wg.Wait()

	ts.logger.Info("Cold data archive completed",
		zap.Int("total_points", totalArchived))

	return totalArchived, nil
}

func (ts *TieredStorage) archiveDeviceData(ctx context.Context, deviceID string, startDate, endDate time.Time) (int, error) {
	points, err := ts.hotStorage.Query(ctx, &models.QueryRequest{
		DeviceID:  deviceID,
		StartTime: startDate,
		EndTime:   endDate,
	})
	if err != nil {
		return 0, err
	}

	if len(points) == 0 {
		return 0, nil
	}

	filename := fmt.Sprintf("device_%s_%s_%s.csv.gz",
		deviceID,
		startDate.Format("20060102"),
		endDate.Format("20060102"))

	localPath := filepath.Join(ts.archiveDir, filename)
	if err := ts.writePointsToCSV(points, localPath); err != nil {
		return 0, err
	}

	if ts.s3Client != nil {
		s3Key := fmt.Sprintf("%s/%s", ColdArchivePrefix, filename)
		if err := ts.uploadToS3(localPath, s3Key); err != nil {
			return 0, err
		}
	}

	return len(points), nil
}

func (ts *TieredStorage) writePointsToCSV(points []models.QueryResult, path string) error {
	file, err := os.Create(path)
	if err != nil {
		return err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	if err := writer.Write([]string{"timestamp", "device_id", "metric", "value"}); err != nil {
		return err
	}

	for _, p := range points {
		record := []string{
			p.Timestamp.Format(time.RFC3339Nano),
			p.DeviceID,
			p.Metric,
			fmt.Sprintf("%f", p.Value),
		}
		if err := writer.Write(record); err != nil {
			return err
		}
	}

	return nil
}

func (ts *TieredStorage) uploadToS3(localPath, s3Key string) error {
	file, err := os.Open(localPath)
	if err != nil {
		return err
	}
	defer file.Close()

	_, err = ts.s3Client.PutObject(&s3.PutObjectInput{
		Bucket: aws.String(ts.s3Bucket),
		Key:    aws.String(s3Key),
		Body:   file,
	})

	return err
}

func (ts *TieredStorage) queryColdData(ctx context.Context, req *models.QueryRequest) ([]models.QueryResult, error) {
	var results []models.QueryResult

	s3Prefix := fmt.Sprintf("%s/device_%s_", ColdArchivePrefix, req.DeviceID)
	objects, err := ts.s3Client.ListObjectsV2(&s3.ListObjectsV2Input{
		Bucket: aws.String(ts.s3Bucket),
		Prefix: aws.String(s3Prefix),
	})
	if err != nil {
		return nil, err
	}

	for _, obj := range objects.Contents {
		points, err := ts.downloadAndParseS3Object(*obj.Key, req.StartTime, req.EndTime)
		if err != nil {
			ts.logger.Warn("Failed to parse S3 object", zap.String("key", *obj.Key), zap.Error(err))
			continue
		}
		results = append(results, points...)
	}

	return results, nil
}

func (ts *TieredStorage) downloadAndParseS3Object(key string, startTime, endTime time.Time) ([]models.QueryResult, error) {
	resp, err := ts.s3Client.GetObject(&s3.GetObjectInput{
		Bucket: aws.String(ts.s3Bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	return ts.parseCSVPoints(resp.Body, startTime, endTime)
}

func (ts *TieredStorage) parseCSVPoints(reader io.Reader, startTime, endTime time.Time) ([]models.QueryResult, error) {
	csvReader := csv.NewReader(reader)
	records, err := csvReader.ReadAll()
	if err != nil {
		return nil, err
	}

	var points []models.QueryResult
	for i, record := range records {
		if i == 0 {
			continue
		}

		ts, err := time.Parse(time.RFC3339Nano, record[0])
		if err != nil {
			continue
		}

		if ts.Before(startTime) || ts.After(endTime) {
			continue
		}

		var value float64
		if _, err := fmt.Sscanf(record[3], "%f", &value); err != nil {
			continue
		}

		points = append(points, models.QueryResult{
			Timestamp: ts,
			DeviceID:  record[1],
			Metric:    record[2],
			Value:     value,
		})
	}

	return points, nil
}

func (ts *TieredStorage) getAllDevices(ctx context.Context) ([]string, error) {
	return []string{}, nil
}

func (ts *TieredStorage) GetHotStorage() *InfluxDBStorage {
	return ts.hotStorage
}

func (ts *TieredStorage) StartArchiver(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			endDate := time.Now().AddDate(0, 0, -HotRetentionDays)
			if _, err := ts.ArchiveColdData(ctx, endDate); err != nil {
				ts.logger.Error("Archive cold data failed", zap.Error(err))
			}
		}
	}
}

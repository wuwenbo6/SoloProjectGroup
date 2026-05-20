package service

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
	"github.com/influxdata/influxdb-client-go/v2/api"
	"go.uber.org/zap"
)

const (
	backupDir      = "./data/backups"
	backupInterval = 24 * time.Hour
	maxBackups     = 7
)

type BackupRecord struct {
	BackupID   string    `json:"backup_id"`
	StartTime  time.Time `json:"start_time"`
	EndTime    time.Time `json:"end_time"`
	Size       int64     `json:"size"`
	DeviceIDs  []string  `json:"device_ids"`
	Metrics    []string  `json:"metrics"`
	CreatedAt  time.Time `json:"created_at"`
}

type BackupService struct {
	logger      *zap.Logger
	client      influxdb2.Client
	queryAPI    api.QueryAPI
	writeAPI    api.WriteAPI
	org         string
	bucket      string
	backups     map[string]*BackupRecord
	backupMutex sync.RWMutex
	ctx         context.Context
	cancel      context.CancelFunc
	scheduled   bool
}

func NewBackupService(client influxdb2.Client, org, bucket string, logger *zap.Logger) *BackupService {
	ctx, cancel := context.WithCancel(context.Background())

	if err := os.MkdirAll(backupDir, 0755); err != nil {
		logger.Warn("Failed to create backup directory", zap.Error(err))
	}

	return &BackupService{
		logger:   logger,
		client:   client,
		queryAPI: client.QueryAPI(org),
		writeAPI: client.WriteAPI(org, bucket),
		org:      org,
		bucket:   bucket,
		backups:  make(map[string]*BackupRecord),
		ctx:      ctx,
		cancel:   cancel,
	}
}

func (bs *BackupService) StartScheduledBackup() {
	if bs.scheduled {
		return
	}
	bs.scheduled = true

	go func() {
		ticker := time.NewTicker(backupInterval)
		defer ticker.Stop()

		for {
			select {
			case <-bs.ctx.Done():
				return
			case <-ticker.C:
				bs.logger.Info("Starting scheduled backup")
				endTime := time.Now()
				startTime := endTime.Add(-24 * time.Hour)
				if _, err := bs.CreateBackup(startTime, endTime, nil, nil); err != nil {
					bs.logger.Error("Scheduled backup failed", zap.Error(err))
				}
				bs.cleanupOldBackups()
			}
		}
	}()

	bs.logger.Info("Scheduled backup service started")
}

func (bs *BackupService) CreateBackup(startTime, endTime time.Time, deviceIDs, metrics []string) (string, error) {
	backupID := fmt.Sprintf("backup_%s", time.Now().Format("20060102_150405"))
	backupPath := filepath.Join(backupDir, backupID+".zip")

	bs.logger.Info("Creating backup",
		zap.String("backup_id", backupID),
		zap.Time("start", startTime),
		zap.Time("end", endTime))

	deviceFilter := ""
	if len(deviceIDs) > 0 {
		filters := make([]string, len(deviceIDs))
		for i, id := range deviceIDs {
			filters[i] = fmt.Sprintf("r.device_id == \"%s\"", id)
		}
		deviceFilter = fmt.Sprintf("|> filter(fn: (r) => %s)", strings.Join(filters, " or "))
	}

	metricFilter := ""
	if len(metrics) > 0 {
		filters := make([]string, len(metrics))
		for i, m := range metrics {
			filters[i] = fmt.Sprintf("r._field == \"%s\"", m)
		}
		metricFilter = fmt.Sprintf("|> filter(fn: (r) => %s)", strings.Join(filters, " or "))
	}

	fluxQuery := fmt.Sprintf(`
		from(bucket: "%s")
			|> range(start: %d, stop: %d)
			|> filter(fn: (r) => r._measurement == "device_metrics")
			%s
			%s
			|> keep(columns: ["_time", "device_id", "_field", "_value"])
	`, bs.bucket, startTime.UnixNano(), endTime.UnixNano(), deviceFilter, metricFilter)

	result, err := bs.queryAPI.Query(bs.ctx, fluxQuery)
	if err != nil {
		return "", fmt.Errorf("failed to query data for backup: %w", err)
	}
	defer result.Close()

	var buf bytes.Buffer
	zipWriter := zip.NewWriter(&buf)

	dataWriter, err := zipWriter.Create("data.csv")
	if err != nil {
		return "", fmt.Errorf("failed to create csv in zip: %w", err)
	}

	csvWriter := csv.NewWriter(dataWriter)
	csvWriter.Write([]string{"timestamp", "device_id", "metric", "value"})

	deviceSet := make(map[string]bool)
	metricSet := make(map[string]bool)
	pointCount := 0

	for result.Next() {
		record := result.Record()
		deviceID := record.ValueByKey("device_id").(string)
		metric := record.Field()
		value := fmt.Sprintf("%v", record.Value())
		timestamp := record.Time().Format(time.RFC3339Nano)

		csvWriter.Write([]string{timestamp, deviceID, metric, value})
		deviceSet[deviceID] = true
		metricSet[metric] = true
		pointCount++
	}

	if result.Err() != nil {
		return "", fmt.Errorf("query error: %w", result.Err())
	}

	csvWriter.Flush()

	metaWriter, err := zipWriter.Create("metadata.json")
	if err != nil {
		return "", fmt.Errorf("failed to create metadata: %w", err)
	}

	deviceList := make([]string, 0, len(deviceSet))
	for id := range deviceSet {
		deviceList = append(deviceList, id)
	}

	metricList := make([]string, 0, len(metricSet))
	for m := range metricSet {
		metricList = append(metricList, m)
	}

	metaContent := fmt.Sprintf(`{
	"backup_id": "%s",
	"start_time": "%s",
	"end_time": "%s",
	"point_count": %d,
	"devices": %s,
	"metrics": %s,
	"created_at": "%s"
}`, backupID, startTime.Format(time.RFC3339), endTime.Format(time.RFC3339),
		pointCount, toJSONArray(deviceList), toJSONArray(metricList),
		time.Now().Format(time.RFC3339))

	metaWriter.Write([]byte(metaContent))
	zipWriter.Close()

	if err := os.WriteFile(backupPath, buf.Bytes(), 0644); err != nil {
		return "", fmt.Errorf("failed to write backup file: %w", err)
	}

	fileInfo, _ := os.Stat(backupPath)

	record := &BackupRecord{
		BackupID:  backupID,
		StartTime: startTime,
		EndTime:   endTime,
		Size:      fileInfo.Size(),
		DeviceIDs: deviceList,
		Metrics:   metricList,
		CreatedAt: time.Now(),
	}

	bs.backupMutex.Lock()
	bs.backups[backupID] = record
	bs.backupMutex.Unlock()

	bs.logger.Info("Backup created successfully",
		zap.String("backup_id", backupID),
		zap.Int("points", pointCount),
		zap.Int64("size", fileInfo.Size()))

	return backupID, nil
}

func (bs *BackupService) RestoreBackup(backupID string, overwrite bool) (int, error) {
	backupPath := filepath.Join(backupDir, backupID+".zip")

	bs.logger.Info("Restoring backup", zap.String("backup_id", backupID))

	data, err := os.ReadFile(backupPath)
	if err != nil {
		return 0, fmt.Errorf("failed to read backup file: %w", err)
	}

	zipReader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return 0, fmt.Errorf("failed to read zip: %w", err)
	}

	var dataFile io.ReadCloser
	for _, f := range zipReader.File {
		if f.Name == "data.csv" {
			dataFile, err = f.Open()
			if err != nil {
				return 0, fmt.Errorf("failed to open data.csv: %w", err)
			}
			break
		}
	}

	if dataFile == nil {
		return 0, fmt.Errorf("data.csv not found in backup")
	}
	defer dataFile.Close()

	csvReader := csv.NewReader(dataFile)
	headers, err := csvReader.Read()
	if err != nil {
		return 0, fmt.Errorf("failed to read csv header: %w", err)
	}

	tsIdx := -1
	devIdx := -1
	metIdx := -1
	valIdx := -1
	for i, h := range headers {
		switch h {
		case "timestamp":
			tsIdx = i
		case "device_id":
			devIdx = i
		case "metric":
			metIdx = i
		case "value":
			valIdx = i
		}
	}

	if tsIdx == -1 || devIdx == -1 || metIdx == -1 || valIdx == -1 {
		return 0, fmt.Errorf("invalid csv format, missing required columns")
	}

	pointCount := 0
	batchSize := 5000
	batch := make([]influxdb2.Point, 0, batchSize)

	for {
		record, err := csvReader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return pointCount, fmt.Errorf("csv read error: %w", err)
		}

		ts, err := time.Parse(time.RFC3339Nano, record[tsIdx])
		if err != nil {
			continue
		}

		value, err := strconv.ParseFloat(record[valIdx], 64)
		if err != nil {
			continue
		}

		p := influxdb2.NewPointWithMeasurement("device_metrics").
			AddTag("device_id", record[devIdx]).
			AddField(record[metIdx], value).
			SetTime(ts)

		batch = append(batch, *p)
		pointCount++

		if len(batch) >= batchSize {
			for _, point := range batch {
				bs.writeAPI.WritePoint(&point)
			}
			batch = batch[:0]
		}
	}

	for _, point := range batch {
		bs.writeAPI.WritePoint(&point)
	}
	bs.writeAPI.Flush()

	bs.logger.Info("Backup restored successfully",
		zap.String("backup_id", backupID),
		zap.Int("points", pointCount))

	return pointCount, nil
}

func (bs *BackupService) ListBackups() []*BackupRecord {
	bs.backupMutex.RLock()
	defer bs.backupMutex.RUnlock()

	list := make([]*BackupRecord, 0, len(bs.backups))
	for _, r := range bs.backups {
		list = append(list, r)
	}
	return list
}

func (bs *BackupService) DeleteBackup(backupID string) error {
	bs.backupMutex.Lock()
	defer bs.backupMutex.Unlock()

	if _, exists := bs.backups[backupID]; !exists {
		return fmt.Errorf("backup not found: %s", backupID)
	}

	backupPath := filepath.Join(backupDir, backupID+".zip")
	if err := os.Remove(backupPath); err != nil {
		return fmt.Errorf("failed to delete backup file: %w", err)
	}

	delete(bs.backups, backupID)
	bs.logger.Info("Backup deleted", zap.String("backup_id", backupID))

	return nil
}

func (bs *BackupService) cleanupOldBackups() {
	bs.backupMutex.Lock()
	defer bs.backupMutex.Unlock()

	if len(bs.backups) <= maxBackups {
		return
	}

	var toDelete []string
	for _, r := range bs.backups {
		toDelete = append(toDelete, r.BackupID)
		if len(toDelete) >= len(bs.backups)-maxBackups {
			break
		}
	}

	for _, id := range toDelete {
		backupPath := filepath.Join(backupDir, id+".zip")
		os.Remove(backupPath)
		delete(bs.backups, id)
		bs.logger.Info("Old backup cleaned up", zap.String("backup_id", id))
	}
}

func (bs *BackupService) Stop() {
	bs.cancel()
	bs.logger.Info("Backup service stopped")
}

func toJSONArray(arr []string) string {
	if len(arr) == 0 {
		return "[]"
	}
	quoted := make([]string, len(arr))
	for i, s := range arr {
		quoted[i] = fmt.Sprintf("\"%s\"", s)
	}
	return fmt.Sprintf("[%s]", strings.Join(quoted, ", "))
}

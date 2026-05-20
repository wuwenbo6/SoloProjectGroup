package service

import (
	"encoding/csv"
	"fmt"
	"strconv"
	"time"

	"shadow-puppet-detection/internal/models"
	"shadow-puppet-detection/internal/repository"
)

type ExportService struct {
	detectionRepo *repository.DetectionRepository
	alertRepo     *repository.AlertRepository
	deviceRepo    *repository.DeviceRepository
}

func NewExportService() *ExportService {
	return &ExportService{
		detectionRepo: repository.NewDetectionRepository(),
		alertRepo:     repository.NewAlertRepository(),
		deviceRepo:    repository.NewDeviceRepository(),
	}
}

type ExportFilter struct {
	DeviceID     string
	MaterialType string
	StartDate    string
	EndDate      string
	AlertLevel   string
}

func (s *ExportService) ExportDetectionsToCSV(filter ExportFilter) ([][]string, error) {
	detections, _, err := s.detectionRepo.List(1, 10000, filter.DeviceID, filter.MaterialType, nil, nil)
	if err != nil {
		return nil, err
	}

	var records [][]string

	header := []string{
		"ID", "检测时间", "设备ID", "材质类型", "厚度(mm)", "硬度",
		"抗拉强度", "湿度(%)", "质量评分", "预警级别", "是否合格", "备注",
	}
	records = append(records, header)

	for _, d := range detections {
		row := []string{
			strconv.Itoa(int(d.ID)),
			d.CreatedAt.Format("2006-01-02 15:04:05"),
			d.DeviceID,
			d.MaterialType,
			fmt.Sprintf("%.2f", d.Thickness),
			fmt.Sprintf("%.1f", d.Hardness),
			fmt.Sprintf("%.1f", d.TensileStrength),
			fmt.Sprintf("%.1f", d.Moisture),
			fmt.Sprintf("%.2f", d.QualityScore),
			string(d.AlertLevel),
			strconv.FormatBool(d.IsQualified),
			d.Remark,
		}
		records = append(records, row)
	}

	return records, nil
}

func (s *ExportService) ExportAlertsToCSV(filter ExportFilter) ([][]string, error) {
	alerts, _, err := s.alertRepo.List(1, 10000, nil, filter.AlertLevel)
	if err != nil {
		return nil, err
	}

	var records [][]string

	header := []string{
		"ID", "告警时间", "设备ID", "告警级别", "告警类型", "消息内容", "是否已处理", "处理时间", "处理人",
	}
	records = append(records, header)

	for _, a := range alerts {
		handledAt := ""
		if a.HandledAt != nil {
			handledAt = a.HandledAt.Format("2006-01-02 15:04:05")
		}

		row := []string{
			strconv.Itoa(int(a.ID)),
			a.CreatedAt.Format("2006-01-02 15:04:05"),
			a.DeviceID,
			string(a.AlertLevel),
			a.AlertType,
			a.Message,
			strconv.FormatBool(a.IsHandled),
			handledAt,
			a.HandledBy,
		}
		records = append(records, row)
	}

	return records, nil
}

func (s *ExportService) ExportStatisticsToCSV(filter ExportFilter) ([][]string, error) {
	stats, err := s.detectionRepo.GetStats(30)
	if err != nil {
		return nil, err
	}

	var records [][]string

	header := []string{
		"日期", "总检测数", "合格数", "不合格数", "合格率(%)", "平均评分",
	}
	records = append(records, header)

	for _, stat := range stats {
		passRate := 0.0
		if stat.TotalCount > 0 {
			passRate = float64(stat.PassCount) / float64(stat.TotalCount) * 100
		}

		row := []string{
			stat.Date,
			strconv.FormatInt(stat.TotalCount, 10),
			strconv.FormatInt(stat.PassCount, 10),
			strconv.FormatInt(stat.FailCount, 10),
			fmt.Sprintf("%.2f", passRate),
			fmt.Sprintf("%.2f", stat.AvgScore),
		}
		records = append(records, row)
	}

	return records, nil
}

func (s *ExportService) ExportFullReport(filter ExportFilter) (*ExportReport, error) {
	detectionRecords, err := s.ExportDetectionsToCSV(filter)
	if err != nil {
		return nil, err
	}

	alertRecords, err := s.ExportAlertsToCSV(filter)
	if err != nil {
		return nil, err
	}

	statRecords, err := s.ExportStatisticsToCSV(filter)
	if err != nil {
		return nil, err
	}

	report := &ExportReport{
		GeneratedAt: time.Now(),
		Filters:     filter,
		Detections:  detectionRecords,
		Alerts:      alertRecords,
		Statistics:  statRecords,
		Summary: ReportSummary{
			TotalDetections:  len(detectionRecords) - 1,
			TotalAlerts:      len(alertRecords) - 1,
			StatisticsPeriod: len(statRecords) - 1,
		},
	}

	return report, nil
}

type ExportReport struct {
	GeneratedAt time.Time
	Filters     ExportFilter
	Detections  [][]string
	Alerts      [][]string
	Statistics  [][]string
	Summary     ReportSummary
}

type ReportSummary struct {
	TotalDetections  int
	TotalAlerts      int
	StatisticsPeriod int
}

func (s *ExportService) GenerateCSVContent(records [][]string) ([]byte, error) {
	buffer := &csvBuffer{}
	writer := csv.NewWriter(buffer)

	for _, record := range records {
		if err := writer.Write(record); err != nil {
			return nil, err
		}
	}

	writer.Flush()
	return buffer.Bytes(), nil
}

type csvBuffer struct {
	data []byte
}

func (b *csvBuffer) Write(p []byte) (n int, err error) {
	b.data = append(b.data, p...)
	return len(p), nil
}

func (b *csvBuffer) Bytes() []byte {
	return b.data
}

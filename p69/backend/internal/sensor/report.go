package sensor

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"papermonitor/internal/config"
	"papermonitor/internal/models"
	"strconv"
	"time"
)

type ReportRequest struct {
	ProcessType models.ProcessType `json:"process_type"`
	StartTime   time.Time          `json:"start_time"`
	EndTime     time.Time          `json:"end_time"`
	Format      string             `json:"format"` // csv, json
}

type ReportSummary struct {
	TotalRecords  int                       `json:"total_records"`
	ProcessType   models.ProcessType        `json:"process_type"`
	StartTime     time.Time                 `json:"start_time"`
	EndTime       time.Time                 `json:"end_time"`
	AvgTemp       float64                   `json:"avg_temperature"`
	AvgHumidity   float64                   `json:"avg_humidity"`
	AvgPH         float64                   `json:"avg_ph_value"`
	AvgConcentration float64                `json:"avg_concentration"`
	AlertCount    int                       `json:"alert_count"`
	AdjustCount   int                       `json:"adjustment_count"`
	GeneratedAt   time.Time                 `json:"generated_at"`
}

func GenerateReport(req ReportRequest) ([]byte, string, error) {
	var data []models.SensorData
	query := config.DB.Where("timestamp BETWEEN ? AND ?", req.StartTime, req.EndTime)
	if req.ProcessType != "" {
		query = query.Where("process_type = ?", req.ProcessType)
	}
	err := query.Order("timestamp asc").Find(&data).Error
	if err != nil {
		return nil, "", err
	}

	if req.Format == "json" {
		return generateJSONReport(data, req)
	}
	return generateCSVReport(data, req)
}

func generateCSVReport(data []models.SensorData, req ReportRequest) ([]byte, string, error) {
	pr, pw := make(chan []byte), make(chan []byte)
	_ = pr

	headers := []string{
		"序号", "工序类型", "时间", "温度", "湿度", "压力",
		"pH值", "浓度", "转速", "设备ID",
	}

	var records [][]string
	records = append(records, headers)

	for i, d := range data {
		record := []string{
			strconv.Itoa(i + 1),
			string(d.ProcessType),
			d.Timestamp.Format("2006-01-02 15:04:05"),
			fmt.Sprintf("%.2f", d.Temperature),
			fmt.Sprintf("%.2f", d.Humidity),
			fmt.Sprintf("%.2f", d.Pressure),
			fmt.Sprintf("%.2f", d.PHValue),
			fmt.Sprintf("%.2f", d.Concentration),
			fmt.Sprintf("%.2f", d.Speed),
			d.DeviceID,
		}
		records = append(records, record)
	}

	summary := CalculateSummary(data, req)
	records = append(records, []string{})
	records = append(records, []string{"报表统计"})
	records = append(records, []string{"总记录数", strconv.Itoa(summary.TotalRecords)})
	records = append(records, []string{"平均温度", fmt.Sprintf("%.2f", summary.AvgTemp)})
	records = append(records, []string{"平均湿度", fmt.Sprintf("%.2f", summary.AvgHumidity)})
	records = append(records, []string{"平均pH值", fmt.Sprintf("%.2f", summary.AvgPH)})
	records = append(records, []string{"平均浓度", fmt.Sprintf("%.2f", summary.AvgConcentration)})
	records = append(records, []string{"预警数量", strconv.Itoa(summary.AlertCount)})
	records = append(records, []string{"调整次数", strconv.Itoa(summary.AdjustCount)})
	records = append(records, []string{"生成时间", summary.GeneratedAt.Format("2006-01-02 15:04:05")})

	r, w := make(chan []byte), make(chan []byte)
	_, _ = r, w

	buf := make([]byte, 0, 1024*1024)
	_ = buf

	csvContent := ""
	for _, record := range records {
		for i, field := range record {
			if i > 0 {
				csvContent += ","
			}
			csvContent += "\"" + field + "\""
		}
		csvContent += "\n"
	}

	filename := fmt.Sprintf("sensor_report_%s_%s.csv",
		req.ProcessType,
		time.Now().Format("20060102_150405"))

	return []byte(csvContent), filename, nil
}

func generateJSONReport(data []models.SensorData, req ReportRequest) ([]byte, string, error) {
	summary := CalculateSummary(data, req)

	result := map[string]interface{}{
		"summary":   summary,
		"data":      data,
		"generated": time.Now(),
	}

	jsonData, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return nil, "", err
	}

	filename := fmt.Sprintf("sensor_report_%s_%s.json",
		req.ProcessType,
		time.Now().Format("20060102_150405"))

	return jsonData, filename, nil
}

func CalculateSummary(data []models.SensorData, req ReportRequest) ReportSummary {
	summary := ReportSummary{
		TotalRecords: len(data),
		ProcessType:  req.ProcessType,
		StartTime:    req.StartTime,
		EndTime:      req.EndTime,
		GeneratedAt:  time.Now(),
	}

	if len(data) == 0 {
		return summary
	}

	var sumTemp, sumHumidity, sumPH, sumConcentration float64
	for _, d := range data {
		sumTemp += d.Temperature
		sumHumidity += d.Humidity
		sumPH += d.PHValue
		sumConcentration += d.Concentration
	}

	n := float64(len(data))
	summary.AvgTemp = sumTemp / n
	summary.AvgHumidity = sumHumidity / n
	summary.AvgPH = sumPH / n
	summary.AvgConcentration = sumConcentration / n

	var alertCount int64
	config.DB.Model(&models.Alert{}).
		Where("process_type = ? AND timestamp BETWEEN ? AND ?",
			req.ProcessType, req.StartTime, req.EndTime).
		Count(&alertCount)
	summary.AlertCount = int(alertCount)

	var adjustCount int64
	config.DB.Table("adjustment_records").
		Where("process_type = ? AND created_at BETWEEN ? AND ?",
			req.ProcessType, req.StartTime, req.EndTime).
		Count(&adjustCount)
	summary.AdjustCount = int(adjustCount)

	return summary
}

package report

import (
	"encoding/csv"
	"fmt"
	"strconv"
	"time"
	"wifi-probe-analytics/models"
)

type ReportGenerator struct{}

func NewReportGenerator() *ReportGenerator {
	return &ReportGenerator{}
}

type TrafficReport struct {
	Period         string                    `json:"period"`
	StartDate      string                    `json:"start_date"`
	EndDate        string                    `json:"end_date"`
	GeneratedAt    string                    `json:"generated_at"`
	TotalVisitors  int                       `json:"total_visitors"`
	DailyBreakdown []DailyTraffic            `json:"daily_breakdown"`
	HourlyPattern  []HourlyTraffic           `json:"hourly_pattern"`
	TopAPs         []APStats                 `json:"top_aps"`
	Summary        ReportSummary             `json:"summary"`
}

type DailyTraffic struct {
	Date           string `json:"date"`
	VisitorCount   int    `json:"visitor_count"`
	NewVisitors    int    `json:"new_visitors"`
	ReturnVisitors int    `json:"return_visitors"`
	AvgStaySeconds int    `json:"avg_stay_seconds"`
}

type HourlyTraffic struct {
	Hour         string `json:"hour"`
	VisitorCount int    `json:"visitor_count"`
	Percentage   string `json:"percentage"`
}

type APStats struct {
	APID        string  `json:"ap_id"`
	VisitorCount int     `json:"visitor_count"`
	Percentage  float64 `json:"percentage"`
}

type ReportSummary struct {
	PeakHour          string `json:"peak_hour"`
	PeakVisitors      int    `json:"peak_visitors"`
	SlowHour          string `json:"slow_hour"`
	SlowVisitors      int    `json:"slow_visitors"`
	AvgDailyVisitors  int    `json:"avg_daily_visitors"`
	TotalDeviceCount  int    `json:"total_device_count"`
	RandomMACPercent  string `json:"random_mac_percent"`
}

func (rg *ReportGenerator) GenerateTrafficReport(
	start, end time.Time,
	dailyData []DailyTraffic,
	hourlyData []HourlyTraffic,
	apStats []APStats,
	totalDevices int,
	randomMACPercent float64,
) *TrafficReport {
	var peakHour, slowHour string
	peakVisitors, slowVisitors := -1, -1

	totalVisitors := 0
	for _, hour := range hourlyData {
		totalVisitors += hour.VisitorCount
		if peakVisitors == -1 || hour.VisitorCount > peakVisitors {
			peakVisitors = hour.VisitorCount
			peakHour = hour.Hour
		}
		if slowVisitors == -1 || hour.VisitorCount < slowVisitors {
			slowVisitors = hour.VisitorCount
			slowHour = hour.Hour
		}
	}

	avgDaily := 0
	if len(dailyData) > 0 {
		sum := 0
		for _, day := range dailyData {
			sum += day.VisitorCount
		}
		avgDaily = sum / len(dailyData)
	}

	return &TrafficReport{
		Period:         fmt.Sprintf("%s - %s", start.Format("2006-01-02"), end.Format("2006-01-02")),
		StartDate:      start.Format("2006-01-02"),
		EndDate:        end.Format("2006-01-02"),
		GeneratedAt:    time.Now().Format("2006-01-02 15:04:05"),
		TotalVisitors:  totalVisitors,
		DailyBreakdown: dailyData,
		HourlyPattern:  hourlyData,
		TopAPs:         apStats,
		Summary: ReportSummary{
			PeakHour:         peakHour,
			PeakVisitors:     peakVisitors,
			SlowHour:         slowHour,
			SlowVisitors:     slowVisitors,
			AvgDailyVisitors: avgDaily,
			TotalDeviceCount: totalDevices,
			RandomMACPercent: fmt.Sprintf("%.1f%%", randomMACPercent),
		},
	}
}

func (rg *ReportGenerator) ExportToCSV(report *TrafficReport) ([]byte, error) {
	records := [][]string{
		{"Wi-Fi Probe Analytics Traffic Report"},
		{"Generated At", report.GeneratedAt},
		{"Period", report.Period},
		{"Total Visitors", strconv.Itoa(report.TotalVisitors)},
		{},
		{"Daily Breakdown"},
		{"Date", "Visitor Count", "New Visitors", "Return Visitors", "Avg Stay (seconds)"},
	}

	for _, day := range report.DailyBreakdown {
		records = append(records, []string{
			day.Date,
			strconv.Itoa(day.VisitorCount),
			strconv.Itoa(day.NewVisitors),
			strconv.Itoa(day.ReturnVisitors),
			strconv.Itoa(day.AvgStaySeconds),
		})
	}

	records = append(records, []string{}, {"Hourly Pattern"}, {"Hour", "Visitor Count", "Percentage"})
	for _, hour := range report.HourlyPattern {
		records = append(records, []string{
			hour.Hour,
			strconv.Itoa(hour.VisitorCount),
			hour.Percentage,
		})
	}

	records = append(records, []string{}, {"Top APs"}, {"AP ID", "Visitor Count", "Percentage"})
	for _, ap := range report.TopAPs {
		records = append(records, []string{
			ap.APID,
			strconv.Itoa(ap.VisitorCount),
			fmt.Sprintf("%.2f%%", ap.Percentage),
		})
	}

	records = append(records, []string{}, {"Summary"})
	records = append(records, []string{"Peak Hour", report.Summary.PeakHour})
	records = append(records, []string{"Peak Visitors", strconv.Itoa(report.Summary.PeakVisitors)})
	records = append(records, []string{"Slow Hour", report.Summary.SlowHour})
	records = append(records, []string{"Slow Visitors", strconv.Itoa(report.Summary.SlowVisitors)})
	records = append(records, []string{"Avg Daily Visitors", strconv.Itoa(report.Summary.AvgDailyVisitors)})
	records = append(records, []string{"Total Device Count", strconv.Itoa(report.Summary.TotalDeviceCount)})
	records = append(records, []string{"Random MAC Percentage", report.Summary.RandomMACPercent})

	buf := new([]byte)
	w := csv.NewWriter(&csvBuffer{buf})
	err := w.WriteAll(records)
	if err != nil {
		return nil, err
	}

	return *buf, nil
}

type csvBuffer struct {
	buf *[]byte
}

func (b *csvBuffer) Write(p []byte) (n int, err error) {
	*b.buf = append(*b.buf, p...)
	return len(p), nil
}

func GenerateCSVReport(
	devices []*models.DeviceInfo,
	sessions map[string]interface{},
	start, end time.Time,
) ([]byte, string, error) {
	filename := fmt.Sprintf("traffic_report_%s.csv", time.Now().Format("20060102_150405"))

	records := [][]string{
		{"Wi-Fi Probe Analytics Report"},
		{"Generated:", time.Now().Format("2006-01-02 15:04:05")},
		{"Period:", fmt.Sprintf("%s to %s", start.Format("2006-01-02"), end.Format("2006-01-02"))},
		{},
		{"Device Details"},
		{"MAC Address", "First Seen", "Last Seen", "Signal Count", "Is Random MAC"},
	}

	totalDevices := len(devices)
	randomMACCount := 0

	for _, dev := range devices {
		isRandom := "No"
		if dev.IsRandomMAC {
			isRandom = "Yes"
			randomMACCount++
		}
		records = append(records, []string{
			dev.MACAddress,
			dev.FirstSeen.Format("2006-01-02 15:04:05"),
			dev.LastSeen.Format("2006-01-02 15:04:05"),
			strconv.Itoa(len(dev.SignalHistory)),
			isRandom,
		})
	}

	records = append(records, []string{}, {"Summary Statistics"})
	records = append(records, []string{"Total Unique Devices", strconv.Itoa(totalDevices)})
	randomPercent := float64(randomMACCount) / float64(totalDevices) * 100
	records = append(records, []string{"Random MAC Devices", fmt.Sprintf("%d (%.1f%%)", randomMACCount, randomPercent)})

	buf := make([]byte, 0, 4096)
	w := csv.NewWriter(&csvWriter{&buf})
	if err := w.WriteAll(records); err != nil {
		return nil, "", err
	}

	return buf, filename, nil
}

type csvWriter struct {
	buf *[]byte
}

func (w *csvWriter) Write(p []byte) (n int, err error) {
	*w.buf = append(*w.buf, p...)
	return len(p), nil
}

package processor

import (
	"context"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
	"wifi-probe-analytics/config"
	"wifi-probe-analytics/dedupe"
	"wifi-probe-analytics/influx"
	"wifi-probe-analytics/models"
	"wifi-probe-analytics/prediction"
	"wifi-probe-analytics/reidentification"
	"wifi-probe-analytics/report"
)

type Processor struct {
	influxClient     *influx.Client
	deduplicator     *dedupe.Deduplicator
	reidentifier     *reidentification.DeviceReidentifier
	trafficPredictor *prediction.TrafficPredictor
	reportGenerator  *report.ReportGenerator
	cfg              config.ProcessorConfig
	visitorSessions  map[string]*VisitorSession
	firstSeenMap     map[string]time.Time
	mutex            sync.RWMutex
	apLocations      map[string]APLocation
	hourlyTraffic    map[string]int
}

type VisitorSession struct {
	MACAddress string
	StartTime  time.Time
	EndTime    time.Time
	APID       string
	Active     bool
}

type APLocation struct {
	ID  string
	Lat float64
	Lng float64
}

func NewProcessor(influxClient *influx.Client, deduplicator *dedupe.Deduplicator, cfg config.ProcessorConfig) *Processor {
	return &Processor{
		influxClient:     influxClient,
		deduplicator:     deduplicator,
		reidentifier:     reidentification.NewDeviceReidentifier(),
		trafficPredictor: prediction.NewTrafficPredictor(),
		reportGenerator:  report.NewReportGenerator(),
		cfg:              cfg,
		visitorSessions:  make(map[string]*VisitorSession),
		firstSeenMap:     make(map[string]time.Time),
		apLocations:      make(map[string]APLocation),
		hourlyTraffic:    make(map[string]int),
	}
}

func (p *Processor) ProcessProbeRequest(ctx context.Context, probe *models.ProbeRequest) error {
	if probe.Timestamp.IsZero() {
		probe.Timestamp = time.Now()
	}

	isDuplicate, isNewDevice, deviceInfo := p.deduplicator.ProcessProbe(probe)

	isRandomMAC := dedupe.IsRandomMACAddress(probe.MACAddress)

	if !isDuplicate {
		err := p.influxClient.WriteProbeRequest(ctx, probe, isDuplicate, isRandomMAC)
		if err != nil {
			return err
		}

		p.updateVisitorSession(probe, deviceInfo)
	}

	return nil
}

func (p *Processor) updateVisitorSession(probe *models.ProbeRequest, deviceInfo *models.DeviceInfo) {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	session, exists := p.visitorSessions[probe.MACAddress]
	if !exists {
		session = &VisitorSession{
			MACAddress: probe.MACAddress,
			StartTime:  probe.Timestamp,
			APID:       probe.APID,
			Active:     true,
		}
		p.visitorSessions[probe.MACAddress] = session

		if _, firstTimeSeen := p.firstSeenMap[probe.MACAddress]; !firstTimeSeen {
			p.firstSeenMap[probe.MACAddress] = probe.Timestamp
		}

		go p.influxClient.WriteVisitorEvent(context.Background(), probe.MACAddress, "arrival", probe.Timestamp, 0)
	}

	session.EndTime = probe.Timestamp
	session.APID = probe.APID
}

func (p *Processor) CheckAndCloseSessions() {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	timeout := p.cfg.StayDurationThreshold
	now := time.Now()

	for mac, session := range p.visitorSessions {
		if session.Active && now.Sub(session.EndTime) > timeout {
			session.Active = false
			duration := session.EndTime.Sub(session.StartTime)
			go p.influxClient.WriteVisitorEvent(context.Background(), mac, "departure", session.EndTime, int64(duration.Seconds()))
		}
	}
}

func (p *Processor) CalculateTrafficStats(ctx context.Context, start, end time.Time) (*models.TrafficStats, error) {
	p.mutex.RLock()
	defer p.mutex.RUnlock()

	var visitorCount, newVisitors, returnVisitors int

	for mac, session := range p.visitorSessions {
		if session.StartTime.After(start) && session.StartTime.Before(end) {
			visitorCount++

			firstSeen, exists := p.firstSeenMap[mac]
			if !exists || firstSeen.Equal(session.StartTime) {
				newVisitors++
			} else {
				returnVisitors++
			}
		}
	}

	if visitorCount == 0 {
		count, err := p.influxClient.QueryUniqueVisitors(ctx, start, end)
		if err == nil {
			visitorCount = count
		}
	}

	return &models.TrafficStats{
		Timestamp:      time.Now(),
		VisitorCount:   visitorCount,
		NewVisitors:    newVisitors,
		ReturnVisitors: returnVisitors,
	}, nil
}

func (p *Processor) CalculateStayDurationStats(ctx context.Context, start, end time.Time) (*models.StayDurationStats, error) {
	p.mutex.RLock()
	defer p.mutex.RUnlock()

	var durations []time.Duration

	for _, session := range p.visitorSessions {
		if !session.Active && session.EndTime.After(start) && session.EndTime.Before(end) {
			duration := session.EndTime.Sub(session.StartTime)
			durations = append(durations, duration)
		}
	}

	if len(durations) == 0 {
		return &models.StayDurationStats{
			AverageStay:  0,
			MedianStay:   0,
			Distribution: make(map[string]int),
		}, nil
	}

	var total time.Duration
	for _, d := range durations {
		total += d
	}
	average := total / time.Duration(len(durations))

	sort.Slice(durations, func(i, j int) bool {
		return durations[i] < durations[j]
	})
	median := durations[len(durations)/2]

	distribution := map[string]int{
		"0-5min":   0,
		"5-15min":  0,
		"15-30min": 0,
		"30-60min": 0,
		"60min+":   0,
	}

	for _, d := range durations {
		switch {
		case d < 5*time.Minute:
			distribution["0-5min"]++
		case d < 15*time.Minute:
			distribution["5-15min"]++
		case d < 30*time.Minute:
			distribution["15-30min"]++
		case d < 60*time.Minute:
			distribution["30-60min"]++
		default:
			distribution["60min+"]++
		}
	}

	return &models.StayDurationStats{
		AverageStay:  average,
		MedianStay:   median,
		Distribution: distribution,
	}, nil
}

func (p *Processor) GenerateHeatmap(ctx context.Context) ([]models.HeatmapPoint, error) {
	p.mutex.RLock()
	defer p.mutex.RUnlock()

	gridSize := p.cfg.HeatmapGridSize
	gridCounts := make(map[string]int)

	devices := p.deduplicator.GetActiveDevices()

	for _, device := range devices {
		if len(device.SignalHistory) > 0 {
			latest := device.SignalHistory[len(device.SignalHistory)-1]

			if ap, ok := p.apLocations[latest.APID]; ok {
				distance := signalToDistance(latest.Strength)

				gridKey := getGridKey(ap.Lat, ap.Lng, gridSize)
				gridCounts[gridKey]++

				if distance > 0 {
					angle := 0.0
					for i := 0; i < 8; i++ {
						offsetLat := distance * math.Cos(angle) / 111000
						offsetLng := distance * math.Sin(angle) / (111000 * math.Cos(ap.Lat*math.Pi/180))
						gridKey = getGridKey(ap.Lat+offsetLat, ap.Lng+offsetLng, gridSize)
						gridCounts[gridKey]++
						angle += math.Pi / 4
					}
				}
			}
		}
	}

	var maxCount int
	for _, count := range gridCounts {
		if count > maxCount {
			maxCount = count
		}
	}

	heatmap := make([]models.HeatmapPoint, 0, len(gridCounts))
	for key, count := range gridCounts {
		lat, lng := parseGridKey(key, gridSize)
		intensity := float64(count) / float64(maxCount)
		heatmap = append(heatmap, models.HeatmapPoint{
			Lat:       lat,
			Lng:       lng,
			Count:     count,
			Intensity: intensity,
		})
	}

	return heatmap, nil
}

func (p *Processor) AddAPLocation(ap APLocation) {
	p.mutex.Lock()
	defer p.mutex.Unlock()
	p.apLocations[ap.ID] = ap
}

func (p *Processor) GetAPLocations() map[string]APLocation {
	p.mutex.RLock()
	defer p.mutex.RUnlock()
	return p.apLocations
}

func signalToDistance(signalStrength int) float64 {
	freq := 2400.0
	return math.Pow(10.0, (27.55-(20*math.Log10(freq))-float64(signalStrength))/20.0) * 1000
}

func getGridKey(lat, lng, gridSize float64) string {
	gridLat := math.Floor(lat/gridSize) * gridSize
	gridLng := math.Floor(lng/gridSize) * gridSize
	return fmt.Sprintf("%.6f:%.6f", gridLat, gridLng)
}

func parseGridKey(key string, gridSize float64) (float64, float64) {
	parts := strings.Split(key, ":")
	if len(parts) != 2 {
		return 0, 0
	}
	lat, _ := strconv.ParseFloat(parts[0], 64)
	lng, _ := strconv.ParseFloat(parts[1], 64)
	return lat, lng
}

func (p *Processor) RecordTrafficData(timestamp time.Time, count int) {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	hourKey := timestamp.Format("2006-01-02 15:00")
	p.hourlyTraffic[hourKey] += count

	p.trafficPredictor.RecordTraffic(timestamp, count)
}

func (p *Processor) PredictTraffic(hours, days int) (*prediction.PredictionResult, *prediction.PredictionResult) {
	hourlyPred := p.trafficPredictor.PredictNextHours(hours)
	dailyPred := p.trafficPredictor.PredictNextDays(days)
	return hourlyPred, dailyPred
}

func (p *Processor) ReidentifyDevice(mac string) *reidentification.MatchResult {
	device, exists := p.deduplicator.GetDevice(mac)
	if !exists || len(device.SignalHistory) < 5 {
		return nil
	}

	return p.reidentifier.Reidentify(mac, device.SignalHistory)
}

func (p *Processor) AddDeviceToReidentification(mac string) {
	device, exists := p.deduplicator.GetDevice(mac)
	if exists && len(device.SignalHistory) >= 5 {
		p.reidentifier.AddDevice(mac, device.SignalHistory)
	}
}

func (p *Processor) GetReidentificationCount() int {
	return p.reidentifier.GetSignatureCount()
}

func (p *Processor) GenerateTrafficReport(start, end time.Time) ([]byte, string, error) {
	devices := p.deduplicator.GetActiveDevices()

	sessions := make(map[string]interface{})
	for mac, session := range p.visitorSessions {
		sessions[mac] = session
	}

	return report.GenerateCSVReport(devices, sessions, start, end)
}

func (p *Processor) GetDailyTrafficData(start, end time.Time) []report.DailyTraffic {
	p.mutex.RLock()
	defer p.mutex.RUnlock()

	var result []report.DailyTraffic

	for d := start; d.Before(end); d = d.AddDate(0, 0, 1) {
		dayKey := d.Format("2006-01-02")
		count := 0
		newCount := 0
		returnCount := 0
		totalStay := 0
		sessionCount := 0

		for mac, session := range p.visitorSessions {
			if session.StartTime.Format("2006-01-02") == dayKey {
				count++
				if firstSeen, exists := p.firstSeenMap[mac]; exists && firstSeen.Format("2006-01-02") == dayKey {
					newCount++
				} else {
					returnCount++
				}
				if !session.Active {
					stay := int(session.EndTime.Sub(session.StartTime).Seconds())
					totalStay += stay
					sessionCount++
				}
			}
		}

		avgStay := 0
		if sessionCount > 0 {
			avgStay = totalStay / sessionCount
		}

		result = append(result, report.DailyTraffic{
			Date:           dayKey,
			VisitorCount:   count,
			NewVisitors:    newCount,
			ReturnVisitors: returnCount,
			AvgStaySeconds: avgStay,
		})
	}

	return result
}

func (p *Processor) GetHourlyTrafficData() []report.HourlyTraffic {
	p.mutex.RLock()
	defer p.mutex.RUnlock()

	hourlyCounts := make(map[string]int)
	total := 0

	for _, session := range p.visitorSessions {
		hour := session.StartTime.Format("15:00")
		hourlyCounts[hour]++
		total++
	}

	var result []report.HourlyTraffic
	for hour := 0; hour < 24; hour++ {
		hourStr := fmt.Sprintf("%02d:00", hour)
		count := hourlyCounts[hourStr]
		percentage := "0%"
		if total > 0 {
			percentage = fmt.Sprintf("%.1f%%", float64(count)/float64(total)*100)
		}
		result = append(result, report.HourlyTraffic{
			Hour:         hourStr,
			VisitorCount: count,
			Percentage:   percentage,
		})
	}

	return result
}

func (p *Processor) GetAPStats() []report.APStats {
	p.mutex.RLock()
	defer p.mutex.RUnlock()

	apCounts := make(map[string]int)
	total := 0

	for _, session := range p.visitorSessions {
		apCounts[session.APID]++
		total++
	}

	var result []report.APStats
	for apID, count := range apCounts {
		percentage := 0.0
		if total > 0 {
			percentage = float64(count) / float64(total) * 100
		}
		result = append(result, report.APStats{
			APID:        apID,
			VisitorCount: count,
			Percentage:  percentage,
		})
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].VisitorCount > result[j].VisitorCount
	})

	return result
}

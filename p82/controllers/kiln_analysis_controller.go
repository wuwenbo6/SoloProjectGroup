package controllers

import (
	"ceramic-api/database"
	"ceramic-api/models"
	"math"
	"net/http"
	"sort"
	"time"

	"github.com/gin-gonic/gin"
)

type TemperaturePoint struct {
	TimeOffset  int64   `json:"time_offset"`
	Temperature float64 `json:"temperature"`
}

type BatchTemperatureCurve struct {
	BatchID     string              `json:"batch_id"`
	KilnID      string              `json:"kiln_id"`
	Points      []TemperaturePoint  `json:"points"`
	StartTime   time.Time           `json:"start_time"`
	EndTime     time.Time           `json:"end_time"`
	AvgTemp     float64             `json:"avg_temp"`
	MaxTemp     float64             `json:"max_temp"`
	MinTemp     float64             `json:"min_temp"`
}

type CurveComparisonResult struct {
	Batches       []BatchTemperatureCurve `json:"batches"`
	Comparison    CurveComparisonStats    `json:"comparison"`
	Suggestions   []string                 `json:"suggestions"`
}

type CurveComparisonStats struct {
	AvgTemperatureVariance float64            `json:"avg_temperature_variance"`
	MaxTemperatureVariance float64            `json:"max_temperature_variance"`
	TimeAlignmentVariance  float64            `json:"time_alignment_variance"`
	SimilarityScores       map[string]float64 `json:"similarity_scores"`
}

func CompareKilnTemperatureCurves(c *gin.Context) {
	var req struct {
		BatchIDs     []string `json:"batch_ids" binding:"required,min=2"`
		Zone         string   `json:"zone"`
		Interpolate  bool     `json:"interpolate" default:"true"`
		Interval     int      `json:"interval" default:"60"`
		NormalizeTime bool    `json:"normalize_time" default:"true"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var allCurves []BatchTemperatureCurve

	for _, batchID := range req.BatchIDs {
		query := database.KilnTempDB.Model(&models.KilnTempRecord{}).Where("batch_id = ?", batchID)
		if req.Zone != "" {
			query = query.Where("zone = ?", req.Zone)
		}

		var records []models.KilnTempRecord
		query.Order("measured_at ASC").Find(&records)

		if len(records) == 0 {
			continue
		}

		curve := processBatchCurve(batchID, records, req.Interval, req.NormalizeTime, req.Interpolate)
		allCurves = append(allCurves, curve)
	}

	if len(allCurves) < 2 {
		c.JSON(http.StatusOK, gin.H{"message": "Not enough valid data for comparison", "curves_count": len(allCurves)})
		return
	}

	comparison := compareCurves(allCurves)
	suggestions := generateCurveSuggestions(allCurves, comparison)

	c.JSON(http.StatusOK, gin.H{
		"curves":       allCurves,
		"comparison":   comparison,
		"suggestions":  suggestions,
	})
}

func processBatchCurve(batchID string, records []models.KilnTempRecord, interval int, normalizeTime bool, interpolate bool) BatchTemperatureCurve {
	var curve BatchTemperatureCurve
	curve.BatchID = batchID
	if len(records) == 0 {
		return curve
	}

	curve.KilnID = records[0].KilnID
	curve.StartTime = records[0].MeasuredAt
	curve.EndTime = records[len(records)-1].MeasuredAt

	var tempSum float64
	maxTemp := records[0].Temperature
	minTemp := records[0].Temperature

	for _, r := range records {
		tempSum += r.Temperature
		if r.Temperature > maxTemp {
			maxTemp = r.Temperature
		}
		if r.Temperature < minTemp {
			minTemp = r.Temperature
		}
	}
	curve.AvgTemp = math.Round(tempSum/float64(len(records))*1000) / 1000
	curve.MaxTemp = maxTemp
	curve.MinTemp = minTemp

	var points []TemperaturePoint
	baseTime := records[0].MeasuredAt

	for _, r := range records {
		offset := int64(r.MeasuredAt.Sub(baseTime).Seconds())
		points = append(points, TemperaturePoint{
			TimeOffset:  offset,
			Temperature: r.Temperature,
		})
	}

	if interpolate && len(points) > 1 {
		points = interpolateCurve(points, interval)
	}

	if normalizeTime {
		maxOffset := points[len(points)-1].TimeOffset
		for i := range points {
			points[i].TimeOffset = int64(float64(points[i].TimeOffset) / float64(maxOffset) * 100)
		}
	}

	curve.Points = points
	return curve
}

func interpolateCurve(points []TemperaturePoint, interval int) []TemperaturePoint {
	if len(points) < 2 {
		return points
	}

	var interpolated []TemperaturePoint
	maxOffset := points[len(points)-1].TimeOffset

	for offset := int64(0); offset <= maxOffset; offset += int64(interval) {
		temp := interpolateTemperature(points, offset)
		interpolated = append(interpolated, TemperaturePoint{
			TimeOffset:  offset,
			Temperature: temp,
		})
	}

	return interpolated
}

func interpolateTemperature(points []TemperaturePoint, targetOffset int64) float64 {
	for i := 0; i < len(points)-1; i++ {
		if points[i].TimeOffset <= targetOffset && points[i+1].TimeOffset >= targetOffset {
			t1 := points[i].TimeOffset
			t2 := points[i+1].TimeOffset
			v1 := points[i].Temperature
			v2 := points[i+1].Temperature

			if t1 == t2 {
				return v1
			}

			ratio := float64(targetOffset-t1) / float64(t2-t1)
			return math.Round((v1+ratio*(v2-v1))*1000) / 1000
		}
	}

	if targetOffset <= points[0].TimeOffset {
		return points[0].Temperature
	}
	return points[len(points)-1].Temperature
}

func compareCurves(curves []BatchTemperatureCurve) CurveComparisonStats {
	var stats CurveComparisonStats

	avgTemps := make([]float64, len(curves))
	maxTemps := make([]float64, len(curves))
	durations := make([]float64, len(curves))

	for i, curve := range curves {
		avgTemps[i] = curve.AvgTemp
		maxTemps[i] = curve.MaxTemp
		if len(curve.Points) > 0 {
			durations[i] = float64(curve.Points[len(curve.Points)-1].TimeOffset)
		}
	}

	stats.AvgTemperatureVariance = calculateVariance(avgTemps)
	stats.MaxTemperatureVariance = calculateVariance(maxTemps)
	stats.TimeAlignmentVariance = calculateVariance(durations)

	stats.SimilarityScores = calculateSimilarityScores(curves)

	return stats
}

func calculateVariance(values []float64) float64 {
	if len(values) < 2 {
		return 0
	}

	mean := 0.0
	for _, v := range values {
		mean += v
	}
	mean /= float64(len(values))

	variance := 0.0
	for _, v := range values {
		variance += (v - mean) * (v - mean)
	}
	variance /= float64(len(values))

	return math.Round(math.Sqrt(variance)*1000) / 1000
}

func calculateSimilarityScores(curves []BatchTemperatureCurve) map[string]float64 {
	scores := make(map[string]float64)

	if len(curves) < 2 {
		return scores
	}

	reference := curves[0]
	for i := 1; i < len(curves); i++ {
		comparison := curves[i]
		score := calculateCurveSimilarity(reference, comparison)
		key := reference.BatchID + "_vs_" + comparison.BatchID
		scores[key] = math.Round(score*1000) / 1000
	}

	return scores
}

func calculateCurveSimilarity(curve1, curve2 BatchTemperatureCurve) float64 {
	if len(curve1.Points) == 0 || len(curve2.Points) == 0 {
		return 0
	}

	points1 := make(map[int64]float64)
	for _, p := range curve1.Points {
		points1[p.TimeOffset] = p.Temperature
	}

	commonPoints := 0
	totalDiff := 0.0

	for _, p := range curve2.Points {
		if temp, ok := points1[p.TimeOffset]; ok {
			diff := math.Abs(temp - p.Temperature)
			totalDiff += diff
			commonPoints++
		}
	}

	if commonPoints == 0 {
		return 0
	}

	avgDiff := totalDiff / float64(commonPoints)
	baseRange := curve1.MaxTemp - curve1.MinTemp
	if baseRange == 0 {
		baseRange = 100
	}

	similarity := 1 - (avgDiff / baseRange)
	if similarity < 0 {
		similarity = 0
	}

	return similarity
}

func generateCurveSuggestions(curves []BatchTemperatureCurve, comparison CurveComparisonStats) []string {
	var suggestions []string

	if comparison.AvgTemperatureVariance > 50 {
		suggestions = append(suggestions, "批次间平均温度差异较大，建议检查窑炉控温系统一致性")
	}

	if comparison.MaxTemperatureVariance > 100 {
		suggestions = append(suggestions, "批次间最高温度差异显著，可能影响产品烧结质量")
	}

	for key, score := range comparison.SimilarityScores {
		if score < 0.7 {
			suggestions = append(suggestions, "批次曲线相似度低("+key+")，建议优化升温曲线一致性")
		}
	}

	if len(suggestions) == 0 {
		suggestions = append(suggestions, "各批次窑温曲线一致性良好，工艺稳定性达标")
	}

	return suggestions
}

func GetBatchTemperatureTrend(c *gin.Context) {
	batchID := c.Query("batch_id")
	kilnID := c.Query("kiln_id")
	zone := c.Query("zone")
	duration := c.DefaultQuery("duration", "24")

	if batchID == "" && kilnID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "batch_id or kiln_id is required"})
		return
	}

	query := database.KilnTempDB.Model(&models.KilnTempRecord{})

	if batchID != "" {
		query = query.Where("batch_id = ?", batchID)
	}
	if kilnID != "" {
		query = query.Where("kiln_id = ?", kilnID)
	}
	if zone != "" {
		query = query.Where("zone = ?", zone)
	}

	durationHours, _ := time.ParseDuration(duration + "h")
	startTime := time.Now().Add(-durationHours)
	query = query.Where("measured_at >= ?", startTime)

	var records []models.KilnTempRecord
	query.Order("measured_at ASC").Find(&records)

	if len(records) == 0 {
		c.JSON(http.StatusOK, gin.H{"message": "No temperature data found", "count": 0})
		return
	}

	var points []TemperaturePoint
	baseTime := records[0].MeasuredAt

	for _, r := range records {
		offset := int64(r.MeasuredAt.Sub(baseTime).Seconds())
		points = append(points, TemperaturePoint{
			TimeOffset:  offset,
			Temperature: r.Temperature,
		})
	}

	trend := calculateTrend(points)
	stats := calculateBasicStats(records)

	c.JSON(http.StatusOK, gin.H{
		"points": points,
		"trend":  trend,
		"stats":  stats,
	})
}

func calculateTrend(points []TemperaturePoint) string {
	if len(points) < 2 {
		return "stable"
	}

	firstThird := len(points) / 3
	lastThird := len(points) * 2 / 3

	earlyAvg := 0.0
	for i := 0; i < firstThird; i++ {
		earlyAvg += points[i].Temperature
	}
	earlyAvg /= float64(firstThird)

	lateAvg := 0.0
	for i := lastThird; i < len(points); i++ {
		lateAvg += points[i].Temperature
	}
	lateAvg /= float64(len(points) - lastThird)

	diff := lateAvg - earlyAvg
	if diff > 20 {
		return "rising"
	} else if diff < -20 {
		return "falling"
	}
	return "stable"
}

func calculateBasicStats(records []models.KilnTempRecord) map[string]interface{} {
	if len(records) == 0 {
		return nil
	}

	sum := 0.0
	maxTemp := records[0].Temperature
	minTemp := records[0].Temperature

	for _, r := range records {
		sum += r.Temperature
		if r.Temperature > maxTemp {
			maxTemp = r.Temperature
		}
		if r.Temperature < minTemp {
			minTemp = r.Temperature
		}
	}

	avg := sum / float64(len(records))

	return map[string]interface{}{
		"average":   math.Round(avg*1000) / 1000,
		"max":       maxTemp,
		"min":       minTemp,
		"range":     math.Round((maxTemp-minTemp)*1000) / 1000,
		"count":     len(records),
		"duration":  records[len(records)-1].MeasuredAt.Sub(records[0].MeasuredAt).Minutes(),
	}
}

func GetZoneTemperatureComparison(c *gin.Context) {
	batchID := c.Query("batch_id")
	if batchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "batch_id is required"})
		return
	}

	var zones []struct {
		Zone  string `json:"zone"`
		Count int64  `json:"count"`
	}

	database.KilnTempDB.Model(&models.KilnTempRecord{}).
		Select("zone, COUNT(*) as count").
		Where("batch_id = ?", batchID).
		Group("zone").
		Scan(&zones)

	zoneStats := make(map[string]interface{})

	for _, z := range zones {
		var records []models.KilnTempRecord
		database.KilnTempDB.Where("batch_id = ? AND zone = ?", batchID, z.Zone).
			Order("measured_at ASC").
			Find(&records)

		if len(records) > 0 {
			stats := calculateBasicStats(records)

			var points []TemperaturePoint
			baseTime := records[0].MeasuredAt
			for _, r := range records {
				offset := int64(r.MeasuredAt.Sub(baseTime).Seconds())
				points = append(points, TemperaturePoint{
					TimeOffset:  offset,
					Temperature: r.Temperature,
				})
			}

			zoneStats[z.Zone] = map[string]interface{}{
				"stats":  stats,
				"points": points,
			}
		}
	}

	zoneNames := make([]string, 0, len(zones))
	for _, z := range zones {
		zoneNames = append(zoneNames, z.Zone)
	}
	sort.Strings(zoneNames)

	c.JSON(http.StatusOK, gin.H{
		"zones":     zoneNames,
		"zone_data": zoneStats,
	})
}

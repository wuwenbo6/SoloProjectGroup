package controllers

import (
	"ceramic-api/database"
	"ceramic-api/models"
	"context"
	"encoding/json"
	"math"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	ProcessAnalysisTimeout = 30 * time.Second
)

type ProcessParamRequest struct {
	BatchID      string  `json:"batch_id" binding:"required"`
	ProcessStage string  `json:"process_stage" binding:"required"`
	ParamName    string  `json:"param_name" binding:"required"`
	ParamValue   float64 `json:"param_value" binding:"required"`
	StandardMin  float64 `json:"standard_min"`
	StandardMax  float64 `json:"standard_max"`
}

func validateProcessParam(req *ProcessParamRequest) error {
	if strings.TrimSpace(req.BatchID) == "" {
		return nil
	}
	if strings.TrimSpace(req.ProcessStage) == "" {
		return nil
	}
	if strings.TrimSpace(req.ParamName) == "" {
		return nil
	}
	if math.IsNaN(req.ParamValue) || math.IsInf(req.ParamValue, 0) {
		return nil
	}
	return nil
}

func CollectProcessParam(c *gin.Context) {
	var req ProcessParamRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format: " + err.Error()})
		return
	}

	if err := validateProcessParam(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	isQualified := true
	if req.StandardMax > req.StandardMin {
		isQualified = req.ParamValue >= req.StandardMin && req.ParamValue <= req.StandardMax
	}

	param := models.ProcessParam{
		BatchID:      strings.TrimSpace(req.BatchID),
		ProcessStage: strings.TrimSpace(req.ProcessStage),
		ParamName:    strings.TrimSpace(req.ParamName),
		ParamValue:   math.Round(req.ParamValue*100000) / 100000,
		StandardMin:  math.Round(req.StandardMin*100000) / 100000,
		StandardMax:  math.Round(req.StandardMax*100000) / 100000,
		IsQualified:  isQualified,
		RecordedAt:   time.Now(),
		CreatedAt:    time.Now(),
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), CollectTimeout)
	defer cancel()

	err := database.WithRetry(ctx, func() error {
		result := database.ProcessDB.WithContext(ctx).Create(&param)
		return result.Error
	}, MaxRetryAttempts)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to collect process parameter: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Process parameter collected successfully",
		"data":    param,
	})
}

func GetProcessParams(c *gin.Context) {
	batchID := c.Query("batch_id")
	stage := c.Query("stage")
	isQualified := c.Query("is_qualified")
	limit := c.DefaultQuery("limit", "1000")

	query := database.ProcessDB.Model(&models.ProcessParam{})

	if batchID != "" {
		query = query.Where("batch_id = ?", batchID)
	}
	if stage != "" {
		query = query.Where("process_stage = ?", stage)
	}
	if isQualified != "" {
		query = query.Where("is_qualified = ?", isQualified == "true")
	}

	var params []models.ProcessParam
	query.Order("recorded_at DESC").Limit(limit).Find(&params)

	c.JSON(http.StatusOK, gin.H{
		"data":  params,
		"count": len(params),
	})
}

type ParamStats struct {
	ParamName    string  `json:"param_name"`
	Count        int     `json:"count"`
	QualifiedCount int   `json:"qualified_count"`
	Mean         float64 `json:"mean"`
	StdDev       float64 `json:"std_dev"`
	Min          float64 `json:"min"`
	Max          float64 `json:"max"`
	Median       float64 `json:"median"`
	P95          float64 `json:"p95"`
	PassRate     float64 `json:"pass_rate"`
	CPK          float64 `json:"cpk"`
}

type StageAnalysis struct {
	StageName  string       `json:"stage_name"`
	TotalCount int          `json:"total_count"`
	PassCount  int          `json:"pass_count"`
	PassRate   float64      `json:"pass_rate"`
	Params     []ParamStats `json:"params"`
}

func calculateMean(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	sum := 0.0
	for _, v := range values {
		sum += v
	}
	return math.Round(sum/float64(len(values))*100000) / 100000
}

func calculateStdDev(values []float64, mean float64) float64 {
	if len(values) < 2 {
		return 0
	}
	sum := 0.0
	for _, v := range values {
		diff := v - mean
		sum += diff * diff
	}
	variance := sum / float64(len(values)-1)
	return math.Round(math.Sqrt(variance)*100000) / 100000
}

func calculateMedian(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	sorted := make([]float64, len(values))
	copy(sorted, values)
	sort.Float64s(sorted)
	mid := len(sorted) / 2
	if len(sorted)%2 == 0 {
		return math.Round((sorted[mid-1]+sorted[mid])/2*100000) / 100000
	}
	return math.Round(sorted[mid]*100000) / 100000
}

func calculatePercentile(values []float64, percentile float64) float64 {
	if len(values) == 0 {
		return 0
	}
	sorted := make([]float64, len(values))
	copy(sorted, values)
	sort.Float64s(sorted)
	index := int(math.Ceil(percentile/100*float64(len(values)))) - 1
	if index < 0 {
		index = 0
	}
	if index >= len(sorted) {
		index = len(sorted) - 1
	}
	return math.Round(sorted[index]*100000) / 100000
}

func calculateCPK(mean, stdDev, min, max float64) float64 {
	if stdDev == 0 || max <= min {
		return 0
	}
	cpu := (max - mean) / (3 * stdDev)
	cpl := (mean - min) / (3 * stdDev)
	cpk := math.Min(cpu, cpl)
	return math.Round(cpk*1000) / 1000
}

func analyzeBatch(batchID string) (*map[string]interface{}, error) {
	var params []models.ProcessParam
	result := database.ProcessDB.Where("batch_id = ?", batchID).Find(&params)
	if result.Error != nil {
		return nil, result.Error
	}

	if len(params) == 0 {
		return &map[string]interface{}{
			"error":       "No process parameters found",
			"total_count": 0,
		}, nil
	}

	stageMap := make(map[string][]models.ProcessParam)
	paramMap := make(map[string][]models.ProcessParam)
	qualifiedCount := 0

	for _, p := range params {
		stageMap[p.ProcessStage] = append(stageMap[p.ProcessStage], p)
		paramMap[p.ParamName] = append(paramMap[p.ParamName], p)
		if p.IsQualified {
			qualifiedCount++
		}
	}

	overallPassRate := math.Round(float64(qualifiedCount)/float64(len(params))*10000) / 100

	var stageAnalyses []StageAnalysis
	for stage, stageParams := range stageMap {
		stageQualified := 0
		paramStatsMap := make(map[string][]float64)
		paramQualifiedMap := make(map[string]int)

		for _, p := range stageParams {
			paramStatsMap[p.ParamName] = append(paramStatsMap[p.ParamName], p.ParamValue)
			if p.IsQualified {
				stageQualified++
			}
		}

		var paramStats []ParamStats
		for paramName, values := range paramStatsMap {
			mean := calculateMean(values)
			stdDev := calculateStdDev(values, mean)
			min := calculatePercentile(values, 0)
			max := calculatePercentile(values, 100)
			median := calculateMedian(values)
			p95 := calculatePercentile(values, 95)

			var stdMin, stdMax float64
			for _, p := range stageParams {
				if p.ParamName == paramName {
					stdMin = p.StandardMin
					stdMax = p.StandardMax
					break
				}
			}
			qualifiedParamCount := 0
			for _, p := range stageParams {
				if p.ParamName == paramName && p.IsQualified {
					qualifiedParamCount++
				}
			}

			paramStats = append(paramStats, ParamStats{
				ParamName:     paramName,
				Count:         len(values),
				QualifiedCount: qualifiedParamCount,
				Mean:          mean,
				StdDev:        stdDev,
				Min:           min,
				Max:           max,
				Median:        median,
				P95:           p95,
				PassRate:      math.Round(float64(qualifiedParamCount)/float64(len(values))*10000) / 100,
				CPK:           calculateCPK(mean, stdDev, stdMin, stdMax),
			})
		}

		stageAnalyses = append(stageAnalyses, StageAnalysis{
			StageName:  stage,
			TotalCount: len(stageParams),
			PassCount:  stageQualified,
			PassRate:   math.Round(float64(stageQualified)/float64(len(stageParams))*10000) / 100,
			Params:     paramStats,
		})
	}

	analysisResult := map[string]interface{}{
		"total_params":      len(params),
		"qualified_count":   qualifiedCount,
		"quality_score":     overallPassRate,
		"stage_breakdown":   stageAnalyses,
		"analysis_time":     time.Now(),
	}

	return &analysisResult, nil
}

func AnalyzeProcess(c *gin.Context) {
	batchID := c.Query("batch_id")
	if batchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "batch_id is required"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), ProcessAnalysisTimeout)
	defer cancel()

	var analysisResult *map[string]interface{}
	var err error

	err = database.WithRetry(ctx, func() error {
		analysisResult, err = analyzeBatch(batchID)
		return err
	}, MaxRetryAttempts)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Analysis failed: " + err.Error()})
		return
	}

	analysisJSON, _ := json.Marshal(analysisResult)

	qualityScore := 0.0
	if ar, ok := (*analysisResult)["quality_score"].(float64); ok {
		qualityScore = ar
	}

	analysis := models.ProcessAnalysis{
		BatchID:       batchID,
		AnalysisType:  "full",
		AnalysisResult: string(analysisJSON),
		QualityScore:  qualityScore,
		Suggestions:   generateSuggestions(qualityScore, *analysisResult),
		AnalyzedAt:    time.Now(),
		CreatedAt:     time.Now(),
	}

	database.ProcessDB.Create(&analysis)

	c.JSON(http.StatusOK, gin.H{
		"message": "Process analysis completed",
		"data":    analysisResult,
	})
}

func generateSuggestions(qualityScore float64, analysisResult map[string]interface{}) string {
	var suggestions string

	if qualityScore < 70 {
		suggestions += "工艺质量较差，建议立即检查各环节参数设置，重点关注不合格率高的工序。"
	} else if qualityScore < 85 {
		suggestions += "工艺质量一般，建议优化关键参数控制，加强过程巡检。"
	} else if qualityScore < 95 {
		suggestions += "工艺质量良好，可进一步优化部分参数以提升稳定性。"
	} else {
		suggestions += "工艺质量优秀，继续保持当前参数设置和操作流程。"
	}

	if stageBreakdown, ok := analysisResult["stage_breakdown"].([]StageAnalysis); ok {
		for _, stage := range stageBreakdown {
			if stage.PassRate < 80 {
				suggestions += "【" + stage.StageName + "】工序合格率较低，建议重点检查。"
			}
		}
	}

	return suggestions
}

func GetProcessAnalysis(c *gin.Context) {
	batchID := c.Query("batch_id")
	limit := c.DefaultQuery("limit", "10")

	query := database.ProcessDB.Model(&models.ProcessAnalysis{})

	if batchID != "" {
		query = query.Where("batch_id = ?", batchID)
	}

	var analyses []models.ProcessAnalysis
	query.Order("analyzed_at DESC").Limit(limit).Find(&analyses)

	var parsedResults []map[string]interface{}
	for _, a := range analyses {
		var result map[string]interface{}
		if err := json.Unmarshal([]byte(a.AnalysisResult), &result); err == nil {
			parsedResults = append(parsedResults, map[string]interface{}{
				"id":            a.ID,
				"batch_id":      a.BatchID,
				"quality_score": a.QualityScore,
				"suggestions":   a.Suggestions,
				"analyzed_at":   a.AnalyzedAt,
				"detail":        result,
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  parsedResults,
		"count": len(parsedResults),
	})
}

package main

import (
	"context"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

type QueryServer struct {
	aggregator *Aggregator
}

func NewQueryServer(clickhouseDSN string) (*QueryServer, error) {
	agg, err := NewAggregator(clickhouseDSN)
	if err != nil {
		return nil, err
	}
	return &QueryServer{aggregator: agg}, nil
}

func (s *QueryServer) GetTraces(c *gin.Context) {
	service := c.Query("service")
	startStr := c.Query("start_time")
	endStr := c.Query("end_time")
	limitStr := c.DefaultQuery("limit", "100")

	startTime, _ := time.Parse(time.RFC3339, startStr)
	if startTime.IsZero() {
		startTime = time.Now().Add(-1 * time.Hour)
	}

	endTime, _ := time.Parse(time.RFC3339, endStr)
	if endTime.IsZero() {
		endTime = time.Now()
	}

	limit, _ := strconv.Atoi(limitStr)
	if limit <= 0 {
		limit = 100
	}

	traces, err := s.aggregator.GetTraces(context.Background(), service, startTime, endTime, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  traces,
		"total": len(traces),
	})
}

func (s *QueryServer) GetTraceById(c *gin.Context) {
	traceId := c.Param("trace_id")

	trace, err := s.aggregator.GetTraceById(context.Background(), traceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if trace == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Trace not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": trace})
}

func (s *QueryServer) GetTopology(c *gin.Context) {
	startStr := c.Query("start_time")
	endStr := c.Query("end_time")

	startTime, _ := time.Parse(time.RFC3339, startStr)
	if startTime.IsZero() {
		startTime = time.Now().Add(-1 * time.Hour)
	}

	endTime, _ := time.Parse(time.RFC3339, endStr)
	if endTime.IsZero() {
		endTime = time.Now()
	}

	topology, err := s.aggregator.GetTopology(context.Background(), startTime, endTime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": topology})
}

func (s *QueryServer) GetServices(c *gin.Context) {
	services, err := s.aggregator.GetServiceList(context.Background())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": services})
}

func (s *QueryServer) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (s *QueryServer) GetMLHealth(c *gin.Context) {
	client := GetMLClient()
	healthy, err := client.HealthCheck()
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status":  "unhealthy",
			"error":   err.Error(),
			"service": "ml-service",
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"healthy": healthy,
		"service": "ml-service",
	})
}

func (s *QueryServer) DetectTraceAnomaly(c *gin.Context) {
	traceId := c.Param("trace_id")

	trace, err := s.aggregator.GetTraceById(context.Background(), traceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if trace == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Trace not found"})
		return
	}

	client := GetMLClient()
	prediction, err := client.PredictAnomaly(context.Background(), trace)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":       "Anomaly detection failed",
			"detail":      err.Error(),
			"trace_id":    traceId,
			"fallback":    true,
			"anomaly_level": "unknown",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": prediction})
}

func (s *QueryServer) DetectBatchAnomalies(c *gin.Context) {
	var request struct {
		TraceIDs  []string `json:"trace_ids" binding:"required"`
	}
	
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var traces []*Trace
	for _, traceId := range request.TraceIDs {
		trace, err := s.aggregator.GetTraceById(context.Background(), traceId)
		if err != nil {
			log.Printf("Failed to fetch trace %s: %v", traceId, err)
			continue
		}
		if trace != nil {
			traces = append(traces, trace)
		}
	}

	client := GetMLClient()
	result, err := client.PredictBatch(context.Background(), traces)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "Batch anomaly detection failed",
			"detail": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": result})
}

func (s *QueryServer) DetectAllAnomalies(c *gin.Context) {
	service := c.Query("service")
	startStr := c.Query("start_time")
	endStr := c.Query("end_time")
	limitStr := c.DefaultQuery("limit", "100")

	startTime, _ := time.Parse(time.RFC3339, startStr)
	if startTime.IsZero() {
		startTime = time.Now().Add(-1 * time.Hour)
	}

	endTime, _ := time.Parse(time.RFC3339, endStr)
	if endTime.IsZero() {
		endTime = time.Now()
	}

	limit, _ := strconv.Atoi(limitStr)
	if limit <= 0 {
		limit = 100
	}

	tracesMap, err := s.aggregator.GetTraces(context.Background(), service, startTime, endTime, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var traceIDs []string
	for _, trace := range tracesMap {
		if traceId, ok := trace["trace_id"].(string); ok {
			traceIDs = append(traceIDs, traceId)
		}
	}

	var fullTraces []*Trace
	for _, traceId := range traceIDs {
		trace, err := s.aggregator.GetTraceById(context.Background(), traceId)
		if err != nil {
			continue
		}
		if trace != nil {
			fullTraces = append(fullTraces, trace)
		}
	}

	client := GetMLClient()
	result, err := client.PredictBatch(context.Background(), fullTraces)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "Anomaly detection failed",
			"detail": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": result})
}

func (s *QueryServer) GetModelInfo(c *gin.Context) {
	client := GetMLClient()
	info, err := client.GetModelInfo(context.Background())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": info})
}

func (s *QueryServer) TrainModel(c *gin.Context) {
	var request struct {
		Contamination float64 `json:"contamination" default:"0.05"`
		Limit         int     `json:"limit" default:"1000"`
	}
	
	if err := c.ShouldBindJSON(&request); err != nil {
		request.Contamination = 0.05
		request.Limit = 1000
	}

	startTime := time.Now().Add(-24 * time.Hour)
	endTime := time.Now()

	tracesMap, err := s.aggregator.GetTraces(context.Background(), "", startTime, endTime, request.Limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var fullTraces []*Trace
	for _, trace := range tracesMap {
		if traceId, ok := trace["trace_id"].(string); ok {
			fullTrace, err := s.aggregator.GetTraceById(context.Background(), traceId)
			if err == nil && fullTrace != nil {
				fullTraces = append(fullTraces, fullTrace)
			}
		}
	}

	client := GetMLClient()
	result, err := client.TrainModel(context.Background(), fullTraces, request.Contamination)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "Model training failed",
			"detail": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": result})
}

func main() {
	server, err := NewQueryServer("clickhouse://clickhouse:9000?database=traces")
	if err != nil {
		log.Fatalf("Failed to create query server: %v", err)
	}

	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"*"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	api := r.Group("/api")
	{
		api.GET("/health", server.HealthCheck)
		api.GET("/ml/health", server.GetMLHealth)
		
		api.GET("/traces", server.GetTraces)
		api.GET("/traces/:trace_id", server.GetTraceById)
		api.GET("/traces/:trace_id/anomaly", server.DetectTraceAnomaly)
		
		api.POST("/anomalies/batch", server.DetectBatchAnomalies)
		api.GET("/anomalies", server.DetectAllAnomalies)
		
		api.GET("/model/info", server.GetModelInfo)
		api.POST("/model/train", server.TrainModel)
		
		api.GET("/topology", server.GetTopology)
		api.GET("/services", server.GetServices)
	}

	log.Println("Query service listening on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to run server: %v", err)
	}
}

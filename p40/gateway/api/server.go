package api

import (
	"log"
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"

	"edge-gateway/ingester"
	"edge-gateway/models"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type Server struct {
	router       *gin.Engine
	dataCleaner  DataCleaner
	alertStore   AlertStore
	clients      map[*websocket.Conn]bool
	clientsMu    sync.RWMutex
	canController *CANController
}

type DataCleaner interface {
	GetRecentData(sensorID string, limit int) []*models.CleanedData
	GetAllSensors() []string
	GetMissingStatus(sensorID string) (int64, int)
	GetCurrentSampleRate(sensorID string) int
	GetAllSampleRates() map[string]int
	GetRateStatistics() (int, int, float64, float64)
	GetSensorVarianceStats(sensorID string) *ingester.SensorStats
}

type AlertStore interface {
	GetAlerts(sensorID string, limit int) ([]*models.Alert, error)
}

func NewServer(dataCleaner DataCleaner, alertStore AlertStore) *Server {
	gin.SetMode(gin.ReleaseMode)
	router := gin.Default()

	server := &Server{
		router:        router,
		dataCleaner:   dataCleaner,
		alertStore:    alertStore,
		clients:       make(map[*websocket.Conn]bool),
		canController: NewCANController(),
	}

	server.setupRoutes()
	return server
}

func (s *Server) setupRoutes() {
	s.router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	api := s.router.Group("/api")
	{
		api.GET("/sensors", s.getSensors)
		api.GET("/sensors/status", s.getAllSensorStatus)
		api.GET("/sensors/:id/status", s.getSensorStatus)
		api.GET("/sensors/:id/data", s.getSensorData)
	api.GET("/sensors/:id/logs", s.getSensorLogs)
	api.GET("/sensors/:id/sample-rate", s.getSensorSampleRate)
	api.GET("/sample-rates/statistics", s.getSampleRateStatistics)
		api.GET("/alerts", s.getAlerts)
		api.GET("/ws", s.handleWebSocket)
		s.canController.RegisterRoutes(api)
	}
}

func (s *Server) getSensors(c *gin.Context) {
	sensors := s.dataCleaner.GetAllSensors()
	c.JSON(http.StatusOK, gin.H{
		"sensors": sensors,
		"count":   len(sensors),
	})
}

func (s *Server) getSensorData(c *gin.Context) {
	sensorID := c.Param("id")
	limit := 100
	if l := c.Query("limit"); l != "" {
		if _, err := http.ParseCookie(l); err == nil {
		}
	}
	
	data := s.dataCleaner.GetRecentData(sensorID, limit)
	c.JSON(http.StatusOK, gin.H{
		"sensor_id": sensorID,
		"data":      data,
		"count":     len(data),
	})
}

func (s *Server) getAlerts(c *gin.Context) {
	sensorID := c.Query("sensor_id")
	limit := 50
	
	alerts, err := s.alertStore.GetAlerts(sensorID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"alerts": alerts,
		"count":  len(alerts),
	})
}

func (s *Server) handleWebSocket(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	s.clientsMu.Lock()
	s.clients[conn] = true
	s.clientsMu.Unlock()

	defer func() {
		s.clientsMu.Lock()
		delete(s.clients, conn)
		s.clientsMu.Unlock()
		conn.Close()
	}()

	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			break
		}
	}
}

func (s *Server) BroadcastData(data *models.CleanedData) {
	s.clientsMu.RLock()
	defer s.clientsMu.RUnlock()

	msg := gin.H{
		"type": "sensor_data",
		"data": data,
	}

	for client := range s.clients {
		if err := client.WriteJSON(msg); err != nil {
			log.Printf("WebSocket write error: %v", err)
		}
	}
}

func (s *Server) BroadcastAlert(alert *models.Alert) {
	s.clientsMu.RLock()
	defer s.clientsMu.RUnlock()

	msg := gin.H{
		"type":  "alert",
		"alert": alert,
	}

	for client := range s.clients {
		if err := client.WriteJSON(msg); err != nil {
			log.Printf("WebSocket write error: %v", err)
		}
	}
}

func (s *Server) getAllSensorStatus(c *gin.Context) {
	sensors := s.dataCleaner.GetAllSensors()
	statusList := make([]gin.H, 0, len(sensors))

	for _, sensorID := range sensors {
		missingDurationMs, missingCount := s.dataCleaner.GetMissingStatus(sensorID)
		recentData := s.dataCleaner.GetRecentData(sensorID, 1)
		
		status := "normal"
		currentTemp := 0.0
		currentHumidity := 0.0

		if len(recentData) > 0 {
			currentTemp = recentData[0].Temp
			currentHumidity = recentData[0].Humidity
			if recentData[0].MissingCount > 0 || missingDurationMs > 10000 {
				status = "missing"
			}
		}

		alerts, _ := s.alertStore.GetAlerts(sensorID, 1)
		if len(alerts) > 0 {
			lastAlertTime := alerts[0].Timestamp.UnixMilli()
			if c.GetTime("now").UnixMilli()-lastAlertTime < 60000 {
				status = "anomaly"
			}
		}

		statusList = append(statusList, gin.H{
			"sensor_id":         sensorID,
			"status":            status,
			"missing_duration_ms": missingDurationMs,
			"missing_count":     missingCount,
			"current_temp":      currentTemp,
			"current_humidity":  currentHumidity,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"sensors": statusList,
		"count":   len(statusList),
	})
}

func (s *Server) getSensorStatus(c *gin.Context) {
	sensorID := c.Param("id")
	missingDurationMs, missingCount := s.dataCleaner.GetMissingStatus(sensorID)
	recentData := s.dataCleaner.GetRecentData(sensorID, 1)

	status := "normal"
	currentTemp := 0.0
	currentHumidity := 0.0

	if len(recentData) > 0 {
		currentTemp = recentData[0].Temp
		currentHumidity = recentData[0].Humidity
		if recentData[0].MissingCount > 0 || missingDurationMs > 10000 {
			status = "missing"
		}
	}

	alerts, _ := s.alertStore.GetAlerts(sensorID, 1)
	if len(alerts) > 0 {
		status = "anomaly"
	}

	c.JSON(http.StatusOK, gin.H{
		"sensor_id":         sensorID,
		"status":            status,
		"missing_duration_ms": missingDurationMs,
		"missing_count":     missingCount,
		"current_temp":      currentTemp,
		"current_humidity":  currentHumidity,
	})
}

func (s *Server) getSensorLogs(c *gin.Context) {
	sensorID := c.Param("id")
	limit := 100
	if l := c.Query("limit"); l != "" {
	}

	recentData := s.dataCleaner.GetRecentData(sensorID, limit)
	alerts, _ := s.alertStore.GetAlerts(sensorID, limit)

	logs := make([]gin.H, 0, len(recentData)+len(alerts))

	for _, d := range recentData {
		logEntry := gin.H{
			"timestamp": d.Timestamp,
			"type":      "data",
			"sensor_id": d.SensorID,
			"temp":      d.Temp,
			"humidity":  d.Humidity,
		}
		if d.IsInterpolated {
			logEntry["is_interpolated"] = true
			logEntry["interpolation_method"] = d.InterpolationMethod
			logEntry["missing_duration_ms"] = d.MissingDurationMs
			logEntry["missing_count"] = d.MissingCount
		}
		logs = append(logs, logEntry)
	}

	for _, a := range alerts {
		logs = append(logs, gin.H{
			"timestamp": a.Timestamp,
			"type":      "alert",
			"sensor_id": a.SensorID,
			"alert_type": a.Type,
			"metric":    a.Metric,
			"value":     a.Value,
			"message":   a.Message,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"sensor_id": sensorID,
		"logs":      logs,
		"count":     len(logs),
	})
}

func (s *Server) getSensorSampleRate(c *gin.Context) {
	sensorID := c.Param("id")
	rate := s.dataCleaner.GetCurrentSampleRate(sensorID)
	stats := s.dataCleaner.GetSensorVarianceStats(sensorID)

	response := gin.H{
		"sensor_id":           sensorID,
		"current_rate_ms":        rate,
		"is_low_rate":       rate == 500,
	}

	if stats != nil {
		response["temp_variance"] = stats.TempVariance
		response["humidity_variance"] = stats.HumidityVariance
		response["temp_mean"] = stats.TempMean
		response["humidity_mean"] = stats.HumidityMean
	}

	c.JSON(http.StatusOK, response)
}

func (s *Server) getSampleRateStatistics(c *gin.Context) {
	highCount, lowCount, avgTempVariance, avgHumidityVariance := s.dataCleaner.GetRateStatistics()
	allRates := s.dataCleaner.GetAllSampleRates()

	c.JSON(http.StatusOK, gin.H{
		"high_rate_count":     highCount,
		"low_rate_count":    lowCount,
		"total_sensors":   len(allRates),
		"bandwidth_saved_percent": float64(lowCount) / float64(len(allRates)) * 100 * 0.8,
		"avg_temp_variance":     avgTempVariance,
		"avg_humidity_variance": avgHumidityVariance,
		"sensor_rates":          allRates,
	})
}

func (s *Server) Start(addr string) error {
	log.Printf("HTTP server starting on %s", addr)
	return s.router.Run(addr)
}

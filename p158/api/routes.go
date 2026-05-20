package api

import (
	"net/http"
	"time"
	"wifi-probe-analytics/config"
	"wifi-probe-analytics/influx"
	"wifi-probe-analytics/models"
	"wifi-probe-analytics/processor"

	"github.com/gin-gonic/gin"
)

func SetupRoutes(router *gin.Engine, proc *processor.Processor, influxClient *influx.Client, cfg *config.Config) {
	api := router.Group("/api/v1")
	{
		api.POST("/probe", handleProbeRequest(proc))
		api.GET("/stats/traffic", handleTrafficStats(proc))
		api.GET("/stats/stay-duration", handleStayDurationStats(proc))
		api.GET("/heatmap", handleHeatmap(proc))
		api.GET("/trend", handleTrend(influxClient))
		api.GET("/config/map", handleMapConfig(cfg))
		api.POST("/ap/location", handleAddAPLocation(proc))
		api.GET("/ap/locations", handleGetAPLocations(proc))

		api.GET("/prediction/traffic", handleTrafficPrediction(proc))
		api.GET("/reidentify/:mac", handleReidentifyDevice(proc))
		api.GET("/report/download", handleDownloadReport(proc))
		api.GET("/report/daily", handleDailyReport(proc))
	}

	router.Static("/static", "./static")
	router.GET("/", func(c *gin.Context) {
		c.File("./static/index.html")
	})
}

func handleProbeRequest(proc *processor.Processor) gin.HandlerFunc {
	return func(c *gin.Context) {
		var probes []models.ProbeRequest
		if err := c.ShouldBindJSON(&probes); err != nil {
			var singleProbe models.ProbeRequest
			if err := c.ShouldBindJSON(&singleProbe); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			probes = append(probes, singleProbe)
		}

		for _, probe := range probes {
			if err := proc.ProcessProbeRequest(c.Request.Context(), &probe); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
		}

		c.JSON(http.StatusOK, gin.H{"status": "success", "processed": len(probes)})
	}
}

func handleTrafficStats(proc *processor.Processor) gin.HandlerFunc {
	return func(c *gin.Context) {
		startStr := c.DefaultQuery("start", time.Now().Add(-24*time.Hour).Format(time.RFC3339))
		endStr := c.DefaultQuery("end", time.Now().Format(time.RFC3339))

		start, _ := time.Parse(time.RFC3339, startStr)
		end, _ := time.Parse(time.RFC3339, endStr)

		stats, err := proc.CalculateTrafficStats(c.Request.Context(), start, end)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, stats)
	}
}

func handleStayDurationStats(proc *processor.Processor) gin.HandlerFunc {
	return func(c *gin.Context) {
		startStr := c.DefaultQuery("start", time.Now().Add(-24*time.Hour).Format(time.RFC3339))
		endStr := c.DefaultQuery("end", time.Now().Format(time.RFC3339))

		start, _ := time.Parse(time.RFC3339, startStr)
		end, _ := time.Parse(time.RFC3339, endStr)

		stats, err := proc.CalculateStayDurationStats(c.Request.Context(), start, end)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"average_stay_seconds": stats.AverageStay.Seconds(),
			"median_stay_seconds":  stats.MedianStay.Seconds(),
			"distribution":         stats.Distribution,
		})
	}
}

func handleHeatmap(proc *processor.Processor) gin.HandlerFunc {
	return func(c *gin.Context) {
		heatmap, err := proc.GenerateHeatmap(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, heatmap)
	}
}

func handleTrend(influxClient *influx.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		startStr := c.DefaultQuery("start", time.Now().Add(-24*time.Hour).Format(time.RFC3339))
		endStr := c.DefaultQuery("end", time.Now().Format(time.RFC3339))
		interval := c.DefaultQuery("interval", "1h")

		start, _ := time.Parse(time.RFC3339, startStr)
		end, _ := time.Parse(time.RFC3339, endStr)

		trend, err := influxClient.QueryTrafficTrend(c.Request.Context(), start, end, interval)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, trend)
	}
}

func handleMapConfig(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"center_lat": cfg.Map.CenterLat,
			"center_lng": cfg.Map.CenterLng,
			"zoom":       cfg.Map.Zoom,
			"api_key":    cfg.Map.APIKey,
		})
	}
}

func handleAddAPLocation(proc *processor.Processor) gin.HandlerFunc {
	return func(c *gin.Context) {
		var ap struct {
			ID  string  `json:"id" binding:"required"`
			Lat float64 `json:"lat" binding:"required"`
			Lng float64 `json:"lng" binding:"required"`
		}

		if err := c.ShouldBindJSON(&ap); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		proc.AddAPLocation(processor.APLocation{
			ID:  ap.ID,
			Lat: ap.Lat,
			Lng: ap.Lng,
		})

		c.JSON(http.StatusOK, gin.H{"status": "success"})
	}
}

func handleGetAPLocations(proc *processor.Processor) gin.HandlerFunc {
	return func(c *gin.Context) {
		locations := proc.GetAPLocations()
		c.JSON(http.StatusOK, locations)
	}
}

func handleTrafficPrediction(proc *processor.Processor) gin.HandlerFunc {
	return func(c *gin.Context) {
		hours := 24
		days := 7

		hourlyPred, dailyPred := proc.PredictTraffic(hours, days)

		c.JSON(http.StatusOK, gin.H{
			"hourly_prediction": hourlyPred.HourlyPrediction,
			"daily_prediction":  dailyPred.DailyPrediction,
			"confidence": gin.H{
				"lower": hourlyPred.ConfidenceLower,
				"upper": hourlyPred.ConfidenceUpper,
			},
		})
	}
}

func handleReidentifyDevice(proc *processor.Processor) gin.HandlerFunc {
	return func(c *gin.Context) {
		mac := c.Param("mac")
		if mac == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "MAC address is required"})
			return
		}

		result := proc.ReidentifyDevice(mac)
		if result == nil {
			c.JSON(http.StatusOK, gin.H{
				"match_found": false,
				"message":     "No matching device found or insufficient data",
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"match_found": true,
			"original_mac": result.OriginalMAC,
			"similarity":   result.Similarity,
			"match_type":   result.MatchType,
		})
	}
}

func handleDownloadReport(proc *processor.Processor) gin.HandlerFunc {
	return func(c *gin.Context) {
		startStr := c.DefaultQuery("start", time.Now().AddDate(0, 0, -7).Format(time.RFC3339))
		endStr := c.DefaultQuery("end", time.Now().Format(time.RFC3339))
		format := c.DefaultQuery("format", "csv")

		start, _ := time.Parse(time.RFC3339, startStr)
		end, _ := time.Parse(time.RFC3339, endStr)

		if format == "csv" {
			data, filename, err := proc.GenerateTrafficReport(start, end)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			c.Header("Content-Type", "text/csv; charset=utf-8")
			c.Header("Content-Disposition", "attachment; filename="+filename)
			c.Writer.Write(data)
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported format"})
		}
	}
}

func handleDailyReport(proc *processor.Processor) gin.HandlerFunc {
	return func(c *gin.Context) {
		startStr := c.DefaultQuery("start", time.Now().AddDate(0, 0, -7).Format(time.RFC3339))
		endStr := c.DefaultQuery("end", time.Now().Format(time.RFC3339))

		start, _ := time.Parse(time.RFC3339, startStr)
		end, _ := time.Parse(time.RFC3339, endStr)

		dailyData := proc.GetDailyTrafficData(start, end)
		hourlyData := proc.GetHourlyTrafficData()
		apStats := proc.GetAPStats()

		c.JSON(http.StatusOK, gin.H{
			"daily":  dailyData,
			"hourly": hourlyData,
			"aps":    apStats,
		})
	}
}

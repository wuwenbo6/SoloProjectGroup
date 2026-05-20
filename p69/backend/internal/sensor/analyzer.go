package sensor

import (
	"log"
	"papermonitor/internal/config"
	"papermonitor/internal/models"
	"papermonitor/internal/ws"
	"sync"
	"time"
)

var (
	alertQueue  = make(chan models.Alert, 100)
	once        sync.Once
	configCache = make(map[models.ProcessType]models.ProcessConfig)
	configMu    sync.RWMutex
)

func InitAlertPusher() {
	once.Do(func() {
		RefreshConfigCache()
		go func() {
			for alert := range alertQueue {
				ws.BroadcastAlert(alert)
			}
		}()
	})
}

func RefreshConfigCache() {
	var configs []models.ProcessConfig
	if err := config.DB.Find(&configs).Error; err != nil {
		log.Printf("Failed to refresh config cache: %v", err)
		return
	}

	configMu.Lock()
	defer configMu.Unlock()
	for _, cfg := range configs {
		configCache[cfg.ProcessType] = cfg
	}
	log.Printf("Config cache refreshed, %d configs loaded", len(configs))
}

func GetCachedConfig(processType models.ProcessType) (models.ProcessConfig, bool) {
	configMu.RLock()
	defer configMu.RUnlock()
	cfg, ok := configCache[processType]
	return cfg, ok
}

func AnalyzeAndAlert(data models.SensorData) {
	config, ok := GetCachedConfig(data.ProcessType)
	if !ok {
		RefreshConfigCache()
		config, ok = GetCachedConfig(data.ProcessType)
		if !ok {
			return
		}
	}

	checkParameter("温度", data.Temperature, config.TempMin, config.TempMax, data)
	checkParameter("pH值", data.PHValue, config.PHMin, config.PHMax, data)
	checkParameter("浓度", data.Concentration, config.ConcentrationMin, config.ConcentrationMax, data)
	
	if data.ProcessType != models.ProcessSoaking {
		checkParameter("速度", data.Speed, config.SpeedMin, config.SpeedMax, data)
	}
}

func checkParameter(paramName string, value, min, max float64, data models.SensorData) {
	if min == 0 && max == 0 {
		return
	}

	var alertLevel models.AlertLevel
	var message string
	var threshold float64

	if value < min {
		deviation := (min - value) / min * 100
		threshold = min
		if deviation > 20 {
			alertLevel = models.AlertLevelCritical
			message = paramName + "严重偏低"
		} else if deviation > 10 {
			alertLevel = models.AlertLevelError
			message = paramName + "偏低"
		} else {
			alertLevel = models.AlertLevelWarning
			message = paramName + "略低"
		}
	} else if value > max {
		deviation := (value - max) / max * 100
		threshold = max
		if deviation > 20 {
			alertLevel = models.AlertLevelCritical
			message = paramName + "严重偏高"
		} else if deviation > 10 {
			alertLevel = models.AlertLevelError
			message = paramName + "偏高"
		} else {
			alertLevel = models.AlertLevelWarning
			message = paramName + "略高"
		}
	} else {
		return
	}

	alert := models.Alert{
		AlertLevel:  alertLevel,
		ProcessType: data.ProcessType,
		DeviceID:    data.DeviceID,
		Message:     message,
		Parameter:   paramName,
		Value:       value,
		Threshold:   threshold,
		Timestamp:   time.Now(),
	}
	if err := config.DB.Create(&alert).Error; err != nil {
		log.Printf("Failed to save alert: %v", err)
	}
	select {
	case alertQueue <- alert:
	default:
		log.Printf("Alert queue is full, dropping alert")
	}
}

func GetRecentSensorData(processType models.ProcessType, limit int) ([]models.SensorData, error) {
	var data []models.SensorData
	err := config.DB.Where("process_type = ?", processType).
		Order("timestamp desc").
		Limit(limit).
		Find(&data).Error
	return data, err
}

func GetActiveAlerts(limit int) ([]models.Alert, error) {
	var alerts []models.Alert
	err := config.DB.Where("acknowledged = ?", false).
		Order("timestamp desc").
		Limit(limit).
		Find(&alerts).Error
	return alerts, err
}

func GetProcessConfigs() ([]models.ProcessConfig, error) {
	var configs []models.ProcessConfig
	err := config.DB.Find(&configs).Error
	return configs, err
}

func UpdateProcessConfig(processType models.ProcessType, cfg *models.ProcessConfig) error {
	err := config.DB.Model(&models.ProcessConfig{}).
		Where("process_type = ?", processType).
		Updates(map[string]interface{}{
			"config_name":        cfg.ConfigName,
			"temp_min":           cfg.TempMin,
			"temp_max":           cfg.TempMax,
			"ph_min":             cfg.PHMin,
			"ph_max":             cfg.PHMax,
			"concentration_min":  cfg.ConcentrationMin,
			"concentration_max":  cfg.ConcentrationMax,
			"speed_min":          cfg.SpeedMin,
			"speed_max":          cfg.SpeedMax,
			"updated_at":         time.Now(),
		}).Error
	if err != nil {
		return err
	}
	RefreshConfigCache()
	log.Printf("Config updated for process: %s, cache refreshed", processType)
	return nil
}

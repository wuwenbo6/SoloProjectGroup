package database

import (
	"fermentation-monitor/internal/models"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

func Init() error {
	var err error
	DB, err = gorm.Open(sqlite.Open("fermentation.db"), &gorm.Config{})
	if err != nil {
		return err
	}

	err = DB.AutoMigrate(&models.Fermenter{}, &models.SensorData{}, &models.Settings{}, &models.Alert{}, &models.AdjustmentRecord{}, &models.FaultDiagnosis{})
	if err != nil {
		return err
	}

	return InitDefaultData()
}

func InitDefaultData() error {
	var count int64
	DB.Model(&models.Fermenter{}).Count(&count)
	if count == 0 {
		fermenters := []models.Fermenter{
			{Name: "发酵罐 #1", Location: "A区", Status: "running"},
			{Name: "发酵罐 #2", Location: "A区", Status: "running"},
			{Name: "发酵罐 #3", Location: "B区", Status: "idle"},
		}
		for _, f := range fermenters {
			if err := DB.Create(&f).Error; err != nil {
				return err
			}
		}
	}

	var settingsCount int64
	DB.Model(&models.Settings{}).Count(&settingsCount)
	if settingsCount == 0 {
		settings := models.Settings{
			TempMin:        20,
			TempMax:        35,
			HumidityMin:    40,
			HumidityMax:    70,
			MicrobeMin:     1000,
			MicrobeMax:     1000000,
			SampleInterval: 5000,
		}
		if err := DB.Create(&settings).Error; err != nil {
			return err
		}
	}

	return nil
}

func SaveSensorData(data *models.SensorData) error {
	data.Timestamp = time.Now()
	return DB.Create(data).Error
}

func GetLatestSensorData(fermenterID uint) (*models.SensorData, error) {
	var data models.SensorData
	err := DB.Where("fermenter_id = ?", fermenterID).Order("timestamp DESC").First(&data).Error
	if err != nil {
		return nil, err
	}
	return &data, nil
}

func GetHistorySensorData(fermenterID uint, hours int) ([]models.SensorData, error) {
	var data []models.SensorData
	since := time.Now().Add(-time.Duration(hours) * time.Hour)
	err := DB.Where("fermenter_id = ? AND timestamp > ?", fermenterID, since).Order("timestamp ASC").Find(&data).Error
	return data, err
}

func GetSettings() (*models.Settings, error) {
	var settings models.Settings
	err := DB.First(&settings, 1).Error
	return &settings, err
}

func UpdateSettings(settings *models.Settings) error {
	settings.UpdatedAt = time.Now()
	return DB.Save(settings).Error
}

func GetFermenters() ([]models.Fermenter, error) {
	var fermenters []models.Fermenter
	err := DB.Find(&fermenters).Error
	return fermenters, err
}

func CreateAlert(alert *models.Alert) error {
	alert.Timestamp = time.Now()
	return DB.Create(alert).Error
}

func GetAlerts(limit int) ([]models.Alert, error) {
	var alerts []models.Alert
	err := DB.Order("timestamp DESC").Limit(limit).Find(&alerts).Error
	return alerts, err
}

func CreateAdjustmentRecord(record *models.AdjustmentRecord) error {
	record.Timestamp = time.Now()
	return DB.Create(record).Error
}

func GetRecentAdjustments(fermenterID uint, limit int) ([]models.AdjustmentRecord, error) {
	var records []models.AdjustmentRecord
	query := DB.Order("timestamp DESC")
	if fermenterID > 0 {
		query = query.Where("fermenter_id = ?", fermenterID)
	}
	err := query.Limit(limit).Find(&records).Error
	return records, err
}

func CreateFaultDiagnosis(fault *models.FaultDiagnosis) error {
	fault.Timestamp = time.Now()
	return DB.Create(fault).Error
}

func GetActiveFaults(fermenterID uint) ([]models.FaultDiagnosis, error) {
	var faults []models.FaultDiagnosis
	query := DB.Where("status = ?", "detected")
	if fermenterID > 0 {
		query = query.Where("fermenter_id = ?", fermenterID)
	}
	err := query.Order("timestamp DESC").Find(&faults).Error
	return faults, err
}

func ResolveFault(id uint) error {
	now := time.Now()
	return DB.Model(&models.FaultDiagnosis{}).Where("id = ?", id).Updates(map[string]interface{}{"status": "resolved", "resolved_at": &now}).Error
}

func GetSensorDataByTimeRange(fermenterID uint, startTime, endTime time.Time) ([]models.SensorData, error) {
	var data []models.SensorData
	err := DB.Where("fermenter_id = ? AND timestamp >= ? AND timestamp <= ?", fermenterID, startTime, endTime).Order("timestamp ASC").Find(&data).Error
	return data, err
}

func UpdateFermenterStatus(id uint, status string) error {
	return DB.Model(&models.Fermenter{}).Where("id = ?", id).Update("status", status).Error
}

func GetFermenterByID(id uint) (*models.Fermenter, error) {
	var fermenter models.Fermenter
	err := DB.First(&fermenter, id).Error
	return &fermenter, err
}

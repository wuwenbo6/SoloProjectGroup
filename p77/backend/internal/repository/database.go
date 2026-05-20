package repository

import (
	"shadow-puppet-detection/internal/models"
	"log"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

func InitDatabase() {
	var err error
	DB, err = gorm.Open(sqlite.Open("shadow_puppet.db"), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect database:", err)
	}

	err = DB.AutoMigrate(
		&models.DetectionRecord{},
		&models.MaterialParam{},
		&models.DeviceInfo{},
		&models.AlertRecord{},
	)
	if err != nil {
		log.Fatal("Failed to migrate database:", err)
	}

	initDefaultData()
}

func initDefaultData() {
	var count int64
	DB.Model(&models.MaterialParam{}).Count(&count)
	if count == 0 {
		defaultParams := []models.MaterialParam{
			{
				MaterialType:        models.MaterialLeather,
				MinThickness:        1.0,
				MaxThickness:        3.0,
				MinHardness:         50.0,
				MaxHardness:         80.0,
				MinTensileStrength:  15.0,
				MaxTensileStrength:  30.0,
				MinMoisture:         8.0,
				MaxMoisture:         15.0,
				PassScore:           70.0,
				WarnThreshold:       60.0,
				Description:         "皮影专用皮革材质参数标准",
			},
			{
				MaterialType:        models.MaterialPaper,
				MinThickness:        0.3,
				MaxThickness:        0.8,
				MinHardness:         30.0,
				MaxHardness:         60.0,
				MinTensileStrength:  8.0,
				MaxTensileStrength:  20.0,
				MinMoisture:         5.0,
				MaxMoisture:         12.0,
				PassScore:           65.0,
				WarnThreshold:       55.0,
				Description:         "传统纸质皮影参数标准",
			},
		}
		DB.Create(&defaultParams)
	}

	DB.Model(&models.DeviceInfo{}).Count(&count)
	if count == 0 {
		defaultDevices := []models.DeviceInfo{
			{
				DeviceID:   "DEV001",
				DeviceName: "主检测设备-01",
				DeviceType: "材质检测仪",
				Status:     models.DeviceOnline,
				Location:   "A车间-1号线",
				IPAddress:  "192.168.1.101",
			},
			{
				DeviceID:   "DEV002",
				DeviceName: "备用检测设备-02",
				DeviceType: "材质检测仪",
				Status:     models.DeviceOnline,
				Location:   "A车间-2号线",
				IPAddress:  "192.168.1.102",
			},
		}
		DB.Create(&defaultDevices)
	}
}

package repository

import (
	"shadow-puppet-detection/internal/models"
	"gorm.io/gorm"
	"time"
)

type DeviceRepository struct{}

func NewDeviceRepository() *DeviceRepository {
	return &DeviceRepository{}
}

func (r *DeviceRepository) GetByID(deviceID string) (*models.DeviceInfo, error) {
	var device models.DeviceInfo
	err := DB.Where("device_id = ?", deviceID).First(&device).Error
	return &device, err
}

func (r *DeviceRepository) List() ([]models.DeviceInfo, error) {
	var devices []models.DeviceInfo
	err := DB.Find(&devices).Error
	return devices, err
}

func (r *DeviceRepository) Update(device *models.DeviceInfo) error {
	return DB.Save(device).Error
}

func (r *DeviceRepository) UpdateStatus(deviceID string, status models.DeviceStatus) error {
	return DB.Model(&models.DeviceInfo{}).Where("device_id = ?", deviceID).Updates(map[string]interface{}{
		"status":      status,
		"last_online": time.Now(),
	}).Error
}

func (r *DeviceRepository) IncrementDetectionCount(deviceID string) error {
	return DB.Model(&models.DeviceInfo{}).Where("device_id = ?", deviceID).UpdateColumn("detection_count", gorm.Expr("detection_count + 1")).Error
}

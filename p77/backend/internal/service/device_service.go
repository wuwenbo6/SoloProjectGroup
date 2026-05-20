package service

import (
	"shadow-puppet-detection/internal/models"
	"shadow-puppet-detection/internal/repository"
)

type DeviceService struct {
	deviceRepo *repository.DeviceRepository
}

func NewDeviceService() *DeviceService {
	return &DeviceService{
		deviceRepo: repository.NewDeviceRepository(),
	}
}

func (s *DeviceService) GetAllDevices() ([]models.DeviceInfo, error) {
	return s.deviceRepo.List()
}

func (s *DeviceService) GetDeviceByID(deviceID string) (*models.DeviceInfo, error) {
	return s.deviceRepo.GetByID(deviceID)
}

func (s *DeviceService) UpdateDeviceStatus(deviceID string, status models.DeviceStatus) error {
	return s.deviceRepo.UpdateStatus(deviceID, status)
}

func (s *DeviceService) UpdateDevice(device *models.DeviceInfo) error {
	return s.deviceRepo.Update(device)
}

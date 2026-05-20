package service

import (
	"shadow-puppet-detection/internal/models"
	"shadow-puppet-detection/internal/repository"
)

type AlertService struct {
	alertRepo *repository.AlertRepository
}

func NewAlertService() *AlertService {
	return &AlertService{
		alertRepo: repository.NewAlertRepository(),
	}
}

func (s *AlertService) GetAlertList(page, pageSize int, isHandled *bool, alertLevel string) ([]models.AlertRecord, int64, error) {
	return s.alertRepo.List(page, pageSize, isHandled, alertLevel)
}

func (s *AlertService) GetUnHandledCount() (int64, error) {
	return s.alertRepo.GetUnHandledCount()
}

func (s *AlertService) HandleAlert(id uint, handledBy string) error {
	return s.alertRepo.Handle(id, handledBy)
}

func (s *AlertService) CreateAlert(alert *models.AlertRecord) error {
	return s.alertRepo.Create(alert)
}

func (s *AlertService) GetLatestAlerts(limit int) ([]models.AlertRecord, error) {
	return s.alertRepo.GetLatest(limit)
}

func (s *AlertService) GetAlertRepo() *repository.AlertRepository {
	return s.alertRepo
}

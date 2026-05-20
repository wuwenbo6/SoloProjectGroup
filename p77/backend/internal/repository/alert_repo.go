package repository

import (
	"shadow-puppet-detection/internal/models"
	"time"
)

type AlertRepository struct{}

func NewAlertRepository() *AlertRepository {
	return &AlertRepository{}
}

func (r *AlertRepository) Create(alert *models.AlertRecord) error {
	return DB.Create(alert).Error
}

func (r *AlertRepository) List(page, pageSize int, isHandled *bool, alertLevel string) ([]models.AlertRecord, int64, error) {
	var alerts []models.AlertRecord
	var total int64

	query := DB.Model(&models.AlertRecord{})

	if isHandled != nil {
		query = query.Where("is_handled = ?", *isHandled)
	}
	if alertLevel != "" {
		query = query.Where("alert_level = ?", alertLevel)
	}

	query.Count(&total)
	err := query.Order("created_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&alerts).Error

	return alerts, total, err
}

func (r *AlertRepository) GetUnHandledCount() (int64, error) {
	var count int64
	err := DB.Model(&models.AlertRecord{}).Where("is_handled = ?", false).Count(&count).Error
	return count, err
}

func (r *AlertRepository) Handle(id uint, handledBy string) error {
	now := time.Now()
	return DB.Model(&models.AlertRecord{}).Where("id = ?", id).Updates(map[string]interface{}{
		"is_handled": true,
		"handled_at": &now,
		"handled_by": handledBy,
	}).Error
}

func (r *AlertRepository) GetLatest(limit int) ([]models.AlertRecord, error) {
	var alerts []models.AlertRecord
	err := DB.Order("created_at DESC").Limit(limit).Find(&alerts).Error
	return alerts, err
}

package repository

import (
	"shadow-puppet-detection/internal/models"
	"time"
)

type DetectionRepository struct{}

func NewDetectionRepository() *DetectionRepository {
	return &DetectionRepository{}
}

func (r *DetectionRepository) Create(record *models.DetectionRecord) error {
	return DB.Create(record).Error
}

func (r *DetectionRepository) GetByID(id uint) (*models.DetectionRecord, error) {
	var record models.DetectionRecord
	err := DB.First(&record, id).Error
	return &record, err
}

func (r *DetectionRepository) List(page, pageSize int, deviceID, materialType string, startDate, endDate *time.Time) ([]models.DetectionRecord, int64, error) {
	var records []models.DetectionRecord
	var total int64

	query := DB.Model(&models.DetectionRecord{})

	if deviceID != "" {
		query = query.Where("device_id = ?", deviceID)
	}
	if materialType != "" {
		query = query.Where("material_type = ?", materialType)
	}
	if startDate != nil {
		query = query.Where("created_at >= ?", *startDate)
	}
	if endDate != nil {
		query = query.Where("created_at <= ?", *endDate)
	}

	query.Count(&total)
	err := query.Order("created_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&records).Error

	return records, total, err
}

func (r *DetectionRepository) GetLatest(limit int) ([]models.DetectionRecord, error) {
	var records []models.DetectionRecord
	err := DB.Order("created_at DESC").Limit(limit).Find(&records).Error
	return records, err
}

func (r *DetectionRepository) GetStats(days int) ([]models.DetectionStats, error) {
	var stats []models.DetectionStats

	query := `
		SELECT 
			DATE(created_at) as date,
			COUNT(*) as total_count,
			SUM(CASE WHEN is_qualified THEN 1 ELSE 0 END) as pass_count,
			SUM(CASE WHEN is_qualified THEN 0 ELSE 1 END) as fail_count,
			AVG(quality_score) as avg_score
		FROM detection_records
		WHERE created_at >= ?
		GROUP BY DATE(created_at)
		ORDER BY date DESC
	`

	startDate := time.Now().AddDate(0, 0, -days)
	err := DB.Raw(query, startDate).Scan(&stats).Error

	for i := range stats {
		if stats[i].TotalCount > 0 {
			stats[i].PassRate = float64(stats[i].PassCount) / float64(stats[i].TotalCount) * 100
		}
	}

	return stats, err
}

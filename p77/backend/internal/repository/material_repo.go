package repository

import (
	"shadow-puppet-detection/internal/models"
)

type MaterialRepository struct{}

func NewMaterialRepository() *MaterialRepository {
	return &MaterialRepository{}
}

func (r *MaterialRepository) GetByType(materialType models.MaterialType) (*models.MaterialParam, error) {
	var param models.MaterialParam
	err := DB.Where("material_type = ?", materialType).First(&param).Error
	return &param, err
}

func (r *MaterialRepository) List() ([]models.MaterialParam, error) {
	var params []models.MaterialParam
	err := DB.Find(&params).Error
	return params, err
}

func (r *MaterialRepository) Update(param *models.MaterialParam) error {
	return DB.Save(param).Error
}

func (r *MaterialRepository) Create(param *models.MaterialParam) error {
	return DB.Create(param).Error
}

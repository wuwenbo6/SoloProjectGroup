package service

import (
	"shadow-puppet-detection/internal/models"
	"shadow-puppet-detection/internal/repository"
)

type MaterialService struct {
	materialRepo *repository.MaterialRepository
}

func NewMaterialService() *MaterialService {
	return &MaterialService{
		materialRepo: repository.NewMaterialRepository(),
	}
}

func (s *MaterialService) GetAllParams() ([]models.MaterialParam, error) {
	return s.materialRepo.List()
}

func (s *MaterialService) GetParamByType(materialType models.MaterialType) (*models.MaterialParam, error) {
	return s.materialRepo.GetByType(materialType)
}

func (s *MaterialService) UpdateParam(param *models.MaterialParam) error {
	return s.materialRepo.Update(param)
}

func (s *MaterialService) CreateParam(param *models.MaterialParam) error {
	return s.materialRepo.Create(param)
}

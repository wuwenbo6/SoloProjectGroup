package config

import (
	"log"
	"papermonitor/internal/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

func InitDatabase() error {
	var err error
	DB, err = gorm.Open(sqlite.Open("../database/papermonitor.db"), &gorm.Config{})
	if err != nil {
		return err
	}

	err = models.AutoMigrate(DB)
	if err != nil {
		return err
	}

	err = models.InitDefaultConfigs(DB)
	if err != nil {
		return err
	}

	log.Println("Database initialized successfully")
	return nil
}

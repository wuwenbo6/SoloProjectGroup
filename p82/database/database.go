package database

import (
	"ceramic-api/config"
	"ceramic-api/models"
	"context"
	"fmt"
	"log"
	"time"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var (
	FiringDB   *gorm.DB
	KilnTempDB *gorm.DB
	ProcessDB  *gorm.DB
	AuthDB     *gorm.DB
)

const (
	MaxOpenConns    = 100
	MaxIdleConns    = 25
	ConnMaxLifetime = 1 * time.Hour
	ConnMaxIdleTime = 30 * time.Minute
)

func InitDatabases(cfg *config.DatabaseConfig) {
	var err error

	FiringDB, err = initDB(cfg.FiringDSN, "firing")
	if err != nil {
		log.Fatalf("Failed to connect firing database: %v", err)
	}

	KilnTempDB, err = initDB(cfg.KilnTempDSN, "kiln_temp")
	if err != nil {
		log.Fatalf("Failed to connect kiln temperature database: %v", err)
	}

	ProcessDB, err = initDB(cfg.ProcessDSN, "process")
	if err != nil {
		log.Fatalf("Failed to connect process database: %v", err)
	}

	AuthDB, err = initDB(cfg.AuthDSN, "auth")
	if err != nil {
		log.Fatalf("Failed to connect auth database: %v", err)
	}

	autoMigrate()
}

func initDB(dsn, name string) (*gorm.DB, error) {
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
		NowFunc: func() time.Time {
			return time.Now().Local()
		},
		PrepareStmt:     true,
		CreateBatchSize: 500,
	})
	if err != nil {
		return nil, err
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}

	sqlDB.SetMaxOpenConns(MaxOpenConns)
	sqlDB.SetMaxIdleConns(MaxIdleConns)
	sqlDB.SetConnMaxLifetime(ConnMaxLifetime)
	sqlDB.SetConnMaxIdleTime(ConnMaxIdleTime)

	if err := sqlDB.Ping(); err != nil {
		return nil, err
	}

	fmt.Printf("%s database connected (pool: %d/%d)\n", name, MaxIdleConns, MaxOpenConns)
	return db, nil
}

func WithRetry(ctx context.Context, fn func() error, maxRetries int) error {
	var err error
	for i := 0; i < maxRetries; i++ {
		if err = fn(); err == nil {
			return nil
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(time.Duration(i+1) * 100 * time.Millisecond):
		}
	}
	return err
}

func autoMigrate() {
	FiringDB.AutoMigrate(&models.FiringParam{}, &models.Batch{})
	KilnTempDB.AutoMigrate(&models.KilnTempRecord{})
	ProcessDB.AutoMigrate(&models.ProcessParam{}, &models.ProcessAnalysis{})
	AuthDB.AutoMigrate(&models.User{}, &models.APIKey{}, &models.Permission{})
}

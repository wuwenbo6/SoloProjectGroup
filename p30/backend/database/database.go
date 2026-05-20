package database

import (
	"fmt"
	"time"

	"backend/models"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func Init(dbPath string) error {
	var err error
	DB, err = gorm.Open(sqlite.Open(dbPath), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return fmt.Errorf("failed to connect database: %w", err)
	}

	err = DB.AutoMigrate(
		&models.EdgeDevice{},
		&models.CollectedData{},
		&models.InferenceResult{},
		&models.PestKnowledge{},
		&models.ModelVersion{},
		&models.Alert{},
	)
	if err != nil {
		return fmt.Errorf("failed to migrate database: %w", err)
	}

	if err := seedInitialData(); err != nil {
		return fmt.Errorf("failed to seed data: %w", err)
	}

	return nil
}

func seedInitialData() error {
	var count int64
	DB.Model(&models.PestKnowledge{}).Count(&count)
	if count > 0 {
		return nil
	}

	pests := []models.PestKnowledge{
		{
			PestType:    "aphid",
			NameZh:      "蚜虫",
			Description: "蚜虫又称蜜虫、腻虫等，属于同翅目蚜科，是植食性昆虫。",
			Damage:      "以成虫和若虫刺吸植物汁液，造成叶片皱缩、卷曲、变黄，同时传播病毒病。",
			Control:     "生物防治：释放瓢虫、草蛉等天敌；化学防治：使用吡虫啉、啶虫脒等杀虫剂。",
		},
		{
			PestType:    "whitefly",
			NameZh:      "粉虱",
			Description: "粉虱属于同翅目粉虱科，是一类体型微小的植食性昆虫。",
			Damage:      "刺吸植物汁液，导致叶片失绿、变黄、萎蔫，分泌蜜露诱发煤污病。",
			Control:     "物理防治：黄色粘虫板诱杀；生物防治：释放丽蚜小蜂；化学防治：噻虫嗪、溴氰虫酰胺。",
		},
		{
			PestType:    "thrips",
			NameZh:      "蓟马",
			Description: "蓟马属于缨翅目，体型微小，锉吸式口器。",
			Damage:      "锉吸植物叶片、花、果实汁液，造成银灰色斑点、叶片卷曲、果实畸形。",
			Control:     "物理防治：蓝色粘虫板；生物防治：释放捕食螨；化学防治：乙基多杀菌素。",
		},
		{
			PestType:    "spider_mite",
			NameZh:      "红蜘蛛",
			Description: "红蜘蛛属于叶螨科，是一类重要的农业害螨。",
			Damage:      "在叶片背面刺吸汁液，造成叶片失绿、出现白色斑点，严重时叶片干枯脱落。",
			Control:     "农业防治：清除杂草；生物防治：释放捕食螨；化学防治：阿维菌素、螺螨酯。",
		},
		{
			PestType:    "bollworm",
			NameZh:      "棉铃虫",
			Description: "棉铃虫属于鳞翅目夜蛾科，是世界性农业害虫。",
			Damage:      "幼虫蛀食蕾、花、果，也取食嫩叶，造成大量落蕾、落花、落果。",
			Control:     "物理防治：黑光灯诱杀成虫；生物防治：释放赤眼蜂；化学防治：氯虫苯甲酰胺。",
		},
		{
			PestType:    "healthy",
			NameZh:      "健康",
			Description: "作物生长状态良好，未发现病虫害。",
			Damage:      "无",
			Control:     "继续保持良好的田间管理。",
		},
		{
			PestType:    "unknown",
			NameZh:      "未知",
			Description: "未能识别的对象。",
			Damage:      "未知",
			Control:     "需要进一步人工检查确认。",
		},
	}

	for _, pest := range pests {
		DB.Create(&pest)
	}

	modelVersions := []models.ModelVersion{
		{
			ModelType:    "image_classification",
			Version:      "v1.0.0",
			DownloadURL:  "/api/v1/models/download/image_v1.0.0",
			Checksum:     "sha256:abc123",
			ReleaseNotes: "Initial release with basic pest classification",
			CreatedAt:    time.Now(),
		},
		{
			ModelType:    "audio_classification",
			Version:      "v1.0.0",
			DownloadURL:  "/api/v1/models/download/audio_v1.0.0",
			Checksum:     "sha256:def456",
			ReleaseNotes: "Initial release with audio classification",
			CreatedAt:    time.Now(),
		},
	}

	for _, mv := range modelVersions {
		DB.Create(&mv)
	}

	return nil
}

func GetStatistics() (*models.StatisticsResponse, error) {
	var totalDevices, onlineDevices int64
	DB.Model(&models.EdgeDevice{}).Count(&totalDevices)
	DB.Model(&models.EdgeDevice{}).Where("status = ?", "online").Count(&onlineDevices)

	var totalInferences int64
	DB.Model(&models.InferenceResult{}).Count(&totalInferences)

	type PestCount struct {
		PestType string
		Count    int64
	}
	var pestCounts []PestCount
	DB.Model(&models.InferenceResult{}).
		Select("pest_type, count(*) as count").
		Group("pest_type").
		Scan(&pestCounts)

	pestDistribution := make(map[string]int64)
	for _, pc := range pestCounts {
		pestDistribution[pc.PestType] = pc.Count
	}

	var dailyStats []DailyStatDB
	DB.Model(&models.InferenceResult{}).
		Select("date(timestamp) as date, count(*) as count").
		Where("timestamp >= date('now', '-7 days')").
		Group("date(timestamp)").
		Order("date DESC").
		Scan(&dailyStats)

	dailyInferences := make([]models.DailyStat, len(dailyStats))
	for i, ds := range dailyStats {
		dailyInferences[i] = models.DailyStat{
			Date:  ds.Date,
			Count: ds.Count,
		}
	}

	return &models.StatisticsResponse{
		TotalDevices:     int(totalDevices),
		OnlineDevices:    int(onlineDevices),
		TotalInferences:  totalInferences,
		PestDistribution: pestDistribution,
		DailyInferences:  dailyInferences,
	}, nil
}

type DailyStatDB struct {
	Date  string
	Count int64
}

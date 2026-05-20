package storage

import (
	"os"
	"testing"

	"modbus-mqtt-gateway/pkg/edge"
)

func TestSQLiteStorage(t *testing.T) {
	dbPath := "test_modbus.db"
	defer os.Remove(dbPath)

	storage, err := NewSQLiteStorage(dbPath)
	if err != nil {
		t.Fatalf("Failed to create storage: %v", err)
	}
	defer storage.Close()

	data := []edge.ProcessedData{
		{Name: "temperature", Value: 25.5, Unit: "°C", AlarmLevel: edge.AlarmNormal},
		{Name: "humidity", Value: 50.0, Unit: "%", AlarmLevel: edge.AlarmNormal},
	}

	err = storage.SaveProcessedData("device-001", data)
	if err != nil {
		t.Errorf("Failed to save processed data: %v", err)
	}

	records, err := storage.GetUnpublishedData("device-001", 10)
	if err != nil {
		t.Errorf("Failed to get unpublished data: %v", err)
	}
	if len(records) != 2 {
		t.Errorf("Expected 2 unpublished records, got %d", len(records))
	}

	ids := make([]uint, len(records))
	for i, r := range records {
		ids[i] = r.ID
	}

	err = storage.MarkDataPublished(ids)
	if err != nil {
		t.Errorf("Failed to mark data published: %v", err)
	}

	records, err = storage.GetUnpublishedData("device-001", 10)
	if err != nil {
		t.Errorf("Failed to get unpublished data: %v", err)
	}
	if len(records) != 0 {
		t.Errorf("Expected 0 unpublished records after marking, got %d", len(records))
	}
}

func TestSavePayload(t *testing.T) {
	dbPath := "test_modbus_payload.db"
	defer os.Remove(dbPath)

	storage, err := NewSQLiteStorage(dbPath)
	if err != nil {
		t.Fatalf("Failed to create storage: %v", err)
	}
	defer storage.Close()

	err = storage.SavePayload("device-001", "test/topic", `{"data":"test"}`, 1234567890)
	if err != nil {
		t.Errorf("Failed to save payload: %v", err)
	}

	records, err := storage.GetUnpublishedPayloads(10, 5)
	if err != nil {
		t.Errorf("Failed to get unpublished payloads: %v", err)
	}
	if len(records) != 1 {
		t.Errorf("Expected 1 unpublished payload, got %d", len(records))
	}
}

func TestGetStats(t *testing.T) {
	dbPath := "test_modbus_stats.db"
	defer os.Remove(dbPath)

	storage, err := NewSQLiteStorage(dbPath)
	if err != nil {
		t.Fatalf("Failed to create storage: %v", err)
	}
	defer storage.Close()

	data := []edge.ProcessedData{
		{Name: "temperature", Value: 25.5, Unit: "°C", AlarmLevel: edge.AlarmNormal},
	}
	storage.SaveProcessedData("device-001", data)

	stats, err := storage.GetStats()
	if err != nil {
		t.Errorf("Failed to get stats: %v", err)
	}

	statsMap, ok := stats.(map[string]interface{})
	if !ok {
		t.Errorf("Expected map[string]interface{}, got %T", stats)
	}

	if statsMap["total_data_records"].(int64) != 1 {
		t.Errorf("Expected 1 total data record, got %v", statsMap["total_data_records"])
	}
	if statsMap["unpublished_data_records"].(int64) != 1 {
		t.Errorf("Expected 1 unpublished data record, got %v", statsMap["unpublished_data_records"])
	}
}

func TestCleanup(t *testing.T) {
	dbPath := "test_modbus_cleanup.db"
	defer os.Remove(dbPath)

	storage, err := NewSQLiteStorage(dbPath)
	if err != nil {
		t.Fatalf("Failed to create storage: %v", err)
	}
	defer storage.Close()

	data := []edge.ProcessedData{
		{Name: "temperature", Value: 25.5, Unit: "°C", AlarmLevel: edge.AlarmNormal},
	}
	storage.SaveProcessedData("device-001", data)

	records, _ := storage.GetUnpublishedData("device-001", 10)
	ids := make([]uint, len(records))
	for i, r := range records {
		ids[i] = r.ID
	}
	storage.MarkDataPublished(ids)

	deleted, err := storage.CleanupPublishedData(0)
	if err != nil {
		t.Errorf("Failed to cleanup: %v", err)
	}
	if deleted == 0 {
		t.Errorf("Expected at least 1 deleted record, got %d", deleted)
	}
}

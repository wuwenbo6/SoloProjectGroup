package database

import (
	"database/sql"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

type Record struct {
	ID          int
	PID         int
	Comm        string
	SourceAddr  string
	DestAddr    string
	LatencyMs   float64
	ContainerID string
	Protocol    string
	Timestamp   time.Time
}

type Database struct {
	db *sql.DB
}

func New(path string) (*Database, error) {
	db, err := sql.Open("sqlite3", path)
	if err != nil {
		return nil, err
	}

	if err := createTables(db); err != nil {
		return nil, err
	}

	return &Database{db: db}, nil
}

func createTables(db *sql.DB) error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS latency_records (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			pid INTEGER NOT NULL,
			comm TEXT NOT NULL,
			source_addr TEXT NOT NULL,
			dest_addr TEXT NOT NULL,
			latency_ms REAL NOT NULL,
			container_id TEXT,
			protocol TEXT,
			timestamp DATETIME NOT NULL
		)
	`)
	return err
}

func (d *Database) InsertRecord(r *Record) error {
	_, err := d.db.Exec(`
		INSERT INTO latency_records (pid, comm, source_addr, dest_addr, latency_ms, container_id, protocol, timestamp)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, r.PID, r.Comm, r.SourceAddr, r.DestAddr, r.LatencyMs, r.ContainerID, r.Protocol, r.Timestamp)
	return err
}

func (d *Database) GetRecords(limit int) ([]Record, error) {
	rows, err := d.db.Query(`
		SELECT id, pid, comm, source_addr, dest_addr, latency_ms, container_id, protocol, timestamp
		FROM latency_records
		ORDER BY timestamp DESC
		LIMIT ?
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []Record
	for rows.Next() {
		var r Record
		err := rows.Scan(&r.ID, &r.PID, &r.Comm, &r.SourceAddr, &r.DestAddr, &r.LatencyMs, &r.ContainerID, &r.Protocol, &r.Timestamp)
		if err != nil {
			return nil, err
		}
		records = append(records, r)
	}

	return records, nil
}

func (d *Database) GetStatsByProtocol() (map[string]*struct{ Count int; AvgLatency float64; MaxLatency float64 }, error) {
	rows, err := d.db.Query(`
		SELECT protocol, COUNT(*) as count, AVG(latency_ms) as avg_latency, MAX(latency_ms) as max_latency
		FROM latency_records
		GROUP BY protocol
		ORDER BY count DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stats := make(map[string]*struct {
		Count     int
		AvgLatency float64
		MaxLatency float64
	})

	for rows.Next() {
		var protocol string
		var count int
		var avgLatency, maxLatency float64
		if err := rows.Scan(&protocol, &count, &avgLatency, &maxLatency); err != nil {
			return nil, err
		}
		stats[protocol] = &struct {
			Count     int
			AvgLatency float64
			MaxLatency float64
		}{Count: count, AvgLatency: avgLatency, MaxLatency: maxLatency}
	}

	return stats, nil
}

func (d *Database) Close() error {
	return d.db.Close()
}

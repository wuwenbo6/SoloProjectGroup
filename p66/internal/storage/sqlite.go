package storage

import (
	"database/sql"
	"fmt"

	"musicscore/pkg/models"

	_ "github.com/mattn/go-sqlite3"
)

type Storage struct {
	db *sql.DB
}

func New(dbPath string) (*Storage, error) {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	storage := &Storage{db: db}
	if err := storage.initSchema(); err != nil {
		return nil, fmt.Errorf("failed to initialize schema: %w", err)
	}

	return storage, nil
}

func (s *Storage) initSchema() error {
	schema := `
	CREATE TABLE IF NOT EXISTS recognition_history (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		input_path TEXT NOT NULL,
		score_type TEXT NOT NULL,
		output_midi TEXT,
		output_xml TEXT,
		created_at DATETIME NOT NULL,
		completed_at DATETIME,
		status TEXT NOT NULL,
		error TEXT
	);

	CREATE INDEX IF NOT EXISTS idx_history_created ON recognition_history(created_at);
	CREATE INDEX IF NOT EXISTS idx_history_status ON recognition_history(status);
	`
	_, err := s.db.Exec(schema)
	return err
}

func (s *Storage) Close() error {
	return s.db.Close()
}

func (s *Storage) CreateHistory(history *models.RecognitionHistory) error {
	query := `
	INSERT INTO recognition_history (
		input_path, score_type, output_midi, output_xml,
		created_at, completed_at, status, error
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`
	result, err := s.db.Exec(query,
		history.InputPath,
		history.ScoreType,
		history.OutputMIDI,
		history.OutputXML,
		history.CreatedAt,
		history.CompletedAt,
		history.Status,
		history.Error,
	)
	if err != nil {
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	history.ID = id
	return nil
}

func (s *Storage) UpdateHistory(history *models.RecognitionHistory) error {
	query := `
	UPDATE recognition_history SET
		output_midi = ?, output_xml = ?, completed_at = ?, status = ?, error = ?
	WHERE id = ?
	`
	_, err := s.db.Exec(query,
		history.OutputMIDI,
		history.OutputXML,
		history.CompletedAt,
		history.Status,
		history.Error,
		history.ID,
	)
	return err
}

func (s *Storage) GetHistoryByID(id int64) (*models.RecognitionHistory, error) {
	query := `
	SELECT id, input_path, score_type, output_midi, output_xml,
	       created_at, completed_at, status, error
	FROM recognition_history WHERE id = ?
	`
	var h models.RecognitionHistory
	var completedAt sql.NullTime
	var errMsg sql.NullString
	err := s.db.QueryRow(query, id).Scan(
		&h.ID, &h.InputPath, &h.ScoreType, &h.OutputMIDI, &h.OutputXML,
		&h.CreatedAt, &completedAt, &h.Status, &errMsg,
	)
	if err != nil {
		return nil, err
	}
	if completedAt.Valid {
		h.CompletedAt = &completedAt.Time
	}
	if errMsg.Valid {
		h.Error = &errMsg.String
	}
	return &h, nil
}

func (s *Storage) ListHistory(limit int) ([]*models.RecognitionHistory, error) {
	query := `
	SELECT id, input_path, score_type, output_midi, output_xml,
	       created_at, completed_at, status, error
	FROM recognition_history ORDER BY created_at DESC LIMIT ?
	`
	rows, err := s.db.Query(query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var histories []*models.RecognitionHistory
	for rows.Next() {
		var h models.RecognitionHistory
		var completedAt sql.NullTime
		var errMsg sql.NullString
		err := rows.Scan(
			&h.ID, &h.InputPath, &h.ScoreType, &h.OutputMIDI, &h.OutputXML,
			&h.CreatedAt, &completedAt, &h.Status, &errMsg,
		)
		if err != nil {
			return nil, err
		}
		if completedAt.Valid {
			h.CompletedAt = &completedAt.Time
		}
		if errMsg.Valid {
			h.Error = &errMsg.String
		}
		histories = append(histories, &h)
	}
	return histories, nil
}

func (s *Storage) DeleteHistory(id int64) error {
	query := `DELETE FROM recognition_history WHERE id = ?`
	_, err := s.db.Exec(query, id)
	return err
}

func (s *Storage) Begin() error {
	_, err := s.db.Exec("BEGIN")
	return err
}

func (s *Storage) Commit() error {
	_, err := s.db.Exec("COMMIT")
	return err
}

func (s *Storage) Rollback() error {
	_, err := s.db.Exec("ROLLBACK")
	return err
}

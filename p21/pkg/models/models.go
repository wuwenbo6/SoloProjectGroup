package models

import "time"

type TaskStatus string

const (
	TaskStatusUnknown   TaskStatus = "UNKNOWN"
	TaskStatusPending   TaskStatus = "PENDING"
	TaskStatusUploading TaskStatus = "UPLOADING"
	TaskStatusProcessing TaskStatus = "PROCESSING"
	TaskStatusMerging   TaskStatus = "MERGING"
	TaskStatusCompleted TaskStatus = "COMPLETED"
	TaskStatusFailed    TaskStatus = "FAILED"
)

type Task struct {
	ID              string        `json:"id"`
	FileName        string        `json:"file_name"`
	FileSize        int64         `json:"file_size"`
	Status          TaskStatus    `json:"status"`
	TotalChunks     int           `json:"total_chunks"`
	CompletedChunks int           `json:"completed_chunks"`
	Progress        int           `json:"progress"`
	CreatedAt       time.Time     `json:"created_at"`
	UpdatedAt       time.Time     `json:"updated_at"`
	Message         string        `json:"message,omitempty"`
	ScoringConfig   *ScoringConfig `json:"scoring_config,omitempty"`
}

type ChunkTask struct {
	TaskID       string        `json:"task_id"`
	ChunkID      int           `json:"chunk_id"`
	SequenceIDs  []string      `json:"sequence_ids"`
	Sequences    []string      `json:"sequences"`
	RetryCount   int           `json:"retry_count"`
	ScoringConfig *ScoringConfig `json:"scoring_config,omitempty"`
}

type ChunkResult struct {
	TaskID     string            `json:"task_id"`
	ChunkID    int               `json:"chunk_id"`
	Results    []AlignmentResult `json:"results"`
	Success    bool              `json:"success"`
	Error      string            `json:"error,omitempty"`
	WorkerID   string            `json:"worker_id"`
	DurationMs int64             `json:"duration_ms"`
	RetryCount int               `json:"retry_count"`
}

type AlignmentResult struct {
	SequenceA string  `json:"sequence_a"`
	SequenceB string  `json:"sequence_b"`
	AlignedA  string  `json:"aligned_a"`
	AlignedB  string  `json:"aligned_b"`
	Score     int     `json:"score"`
	Identity  float64 `json:"identity"`
	Heatmap   string  `json:"heatmap,omitempty"`
}

type TaskResult struct {
	TaskID      string            `json:"task_id"`
	Results     []AlignmentResult `json:"results"`
	BatchHeatmap string           `json:"batch_heatmap,omitempty"`
	CreatedAt   time.Time         `json:"created_at"`
}

type ScoringConfig struct {
	MatrixType string `json:"matrix_type"`
	MatrixURL  string `json:"matrix_url,omitempty"`
	GapOpen    int    `json:"gap_open"`
	GapExtend  int    `json:"gap_extend"`
}

type WorkerInfo struct {
	ID          string    `json:"id"`
	Hostname    string    `json:"hostname"`
	PID         int       `json:"pid"`
	StartedAt   time.Time `json:"started_at"`
	LastSeenAt  time.Time `json:"last_seen_at"`
	TasksDone   int64     `json:"tasks_done"`
	IsHealthy   bool      `json:"is_healthy"`
}

package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type TaskStatus string

const (
	StatusPending    TaskStatus = "pending"
	StatusUploading  TaskStatus = "uploading"
	StatusUploaded   TaskStatus = "uploaded"
	StatusSplitting  TaskStatus = "splitting"
	StatusAnalyzing  TaskStatus = "analyzing"
	StatusQueued     TaskStatus = "queued"
	StatusProcessing TaskStatus = "processing"
	StatusMerging    TaskStatus = "merging"
	StatusPackaging  TaskStatus = "packaging"
	StatusCompleted  TaskStatus = "completed"
	StatusFailed     TaskStatus = "failed"
)

type CodecType string

const (
	CodecH265 CodecType = "h265"
	CodecAV1  CodecType = "av1"
	CodecH264 CodecType = "h264"
)

type OutputFormat string

const (
	FormatMP4  OutputFormat = "mp4"
	FormatHLS  OutputFormat = "hls"
	FormatDASH OutputFormat = "dash"
)

type BitrateMode string

const (
	BitrateModeCBR  BitrateMode = "cbr"
	BitrateModeVBR  BitrateMode = "vbr"
	BitrateModeSmart BitrateMode = "smart"
)

type WatermarkPosition string

const (
	WatermarkTopLeft     WatermarkPosition = "top_left"
	WatermarkTopRight    WatermarkPosition = "top_right"
	WatermarkBottomLeft  WatermarkPosition = "bottom_left"
	WatermarkBottomRight WatermarkPosition = "bottom_right"
	WatermarkCenter      WatermarkPosition = "center"
)

type WatermarkConfig struct {
	Enabled   bool              `json:"enabled"`
	ImageURL  string            `json:"image_url,omitempty"`
	Text      string            `json:"text,omitempty"`
	Position  WatermarkPosition `json:"position"`
	Opacity   float64           `json:"opacity"`
	Scale     float64           `json:"scale"`
	PaddingX  int               `json:"padding_x"`
	PaddingY  int               `json:"padding_y"`
	FontSize  int               `json:"font_size"`
	FontColor string            `json:"font_color"`
}

type CropConfig struct {
	Enabled bool   `json:"enabled"`
	X       int    `json:"x"`
	Y       int    `json:"y"`
	Width   int    `json:"width"`
	Height  int    `json:"height"`
}

type BitrateConfig struct {
	Mode        BitrateMode `json:"mode"`
	TargetBitrate string     `json:"target_bitrate,omitempty"`
	MaxBitrate    string     `json:"max_bitrate,omitempty"`
	MinBitrate    string     `json:"min_bitrate,omitempty"`
	BufferSize    string     `json:"buffer_size,omitempty"`
}

type HLSConfig struct {
	Enabled        bool     `json:"enabled"`
	SegmentDuration int     `json:"segment_duration"`
	PlaylistType    string   `json:"playlist_type"`
	Encrypted       bool     `json:"encrypted"`
	KeyURL          string   `json:"key_url,omitempty"`
}

type DASHConfig struct {
	Enabled        bool     `json:"enabled"`
	SegmentDuration int     `json:"segment_duration"`
	AdaptationSets bool     `json:"adaptation_sets"`
}

type TaskConfig struct {
	Watermark WatermarkConfig `json:"watermark"`
	Crop      CropConfig      `json:"crop"`
	Bitrate   BitrateConfig   `json:"bitrate"`
	HLS       HLSConfig       `json:"hls"`
	DASH      DASHConfig      `json:"dash"`
}

type SceneAnalysis struct {
	SegmentID   int     `json:"segment_id"`
	Complexity  float64 `json:"complexity"`
	Motion      float64 `json:"motion"`
	SceneChange bool    `json:"scene_change"`
	Bitrate     string  `json:"bitrate"`
}

type Task struct {
	ID          uuid.UUID    `gorm:"type:uuid;primary_key" json:"id"`
	Filename    string       `json:"filename"`
	OriginalURL string       `json:"original_url,omitempty"`
	OutputURL   string       `json:"output_url,omitempty"`
	Codec       CodecType    `json:"codec"`
	OutputFormat OutputFormat `json:"output_format"`
	Status      TaskStatus   `json:"status"`
	Progress    int          `json:"progress"`
	Duration    float64      `json:"duration,omitempty"`
	FileSize    int64        `json:"file_size,omitempty"`
	OutputSize  int64        `json:"output_size,omitempty"`
	ErrorMsg    string       `json:"error_msg,omitempty"`
	SegmentCount int         `json:"segment_count"`
	SegmentsDone int         `json:"segments_done"`
	ConfigJSON  string       `json:"config_json,omitempty"`
	SceneAnalysisJSON string `json:"scene_analysis_json,omitempty"`
	CreatedAt   time.Time    `json:"created_at"`
	UpdatedAt   time.Time    `json:"updated_at"`
	CompletedAt *time.Time   `json:"completed_at,omitempty"`
}

func (t *Task) GetConfig() TaskConfig {
	var cfg TaskConfig
	if t.ConfigJSON != "" {
		json.Unmarshal([]byte(t.ConfigJSON), &cfg)
	}
	return cfg
}

func (t *Task) SetConfig(cfg TaskConfig) error {
	data, err := json.Marshal(cfg)
	if err != nil {
		return err
	}
	t.ConfigJSON = string(data)
	return nil
}

func (t *Task) GetSceneAnalysis() []SceneAnalysis {
	var analysis []SceneAnalysis
	if t.SceneAnalysisJSON != "" {
		json.Unmarshal([]byte(t.SceneAnalysisJSON), &analysis)
	}
	return analysis
}

func (t *Task) SetSceneAnalysis(analysis []SceneAnalysis) error {
	data, err := json.Marshal(analysis)
	if err != nil {
		return err
	}
	t.SceneAnalysisJSON = string(data)
	return nil
}

type Segment struct {
	ID          uuid.UUID  `gorm:"type:uuid;primary_key"`
	TaskID      uuid.UUID  `gorm:"type:uuid;index"`
	SegmentID   int        `json:"segment_id"`
	StartTime   float64    `json:"start_time"`
	Duration    float64    `json:"duration"`
	InputPath   string     `json:"input_path"`
	OutputPath  string     `json:"output_path"`
	Status      TaskStatus `json:"status"`
	WorkerID    string     `json:"worker_id,omitempty"`
	ErrorMsg    string     `json:"error_msg,omitempty"`
	RetryCount  int        `json:"retry_count"`
	LastProcessAt *time.Time `json:"last_process_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

func (t *Task) BeforeCreate(tx *gorm.DB) error {
	if t.ID == uuid.Nil {
		t.ID = uuid.New()
	}
	return nil
}

func (s *Segment) BeforeCreate(tx *gorm.DB) error {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	return nil
}

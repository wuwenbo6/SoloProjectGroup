package models

import (
	"time"
)

type ScoreType string

const (
	ScoreTypeGongche ScoreType = "gongche"
	ScoreTypeJianzi  ScoreType = "jianzi"
)

type RecognitionHistory struct {
	ID          int64
	InputPath   string
	ScoreType   ScoreType
	OutputMIDI  string
	OutputXML   string
	CreatedAt   time.Time
	CompletedAt *time.Time
	Status      string
	Error       *string
}

type MusicSymbol struct {
	ID        int
	Type      string
	PositionX int
	PositionY int
	Width     int
	Height    int
	Confidence float64
	Value     string
}

type Note struct {
	Pitch     string
	Octave    int
	Duration  float64
	StartTime float64
}

type Measure struct {
	Notes    []Note
	TimeSig  string
	KeySig   string
	Duration float64
}

type MusicScore struct {
	Type     ScoreType
	Measures []Measure
	Tempo    int
	Title    string
}

type ImageProcessResult struct {
	OriginalPath string
	ProcessedPath string
	Symbols []MusicSymbol
	SkewAngle float64
}

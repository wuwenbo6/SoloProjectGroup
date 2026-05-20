package batch

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"musicscore/pkg/models"
)

type Operation string

const (
	OpTranspose    Operation = "transpose"
	OpChangeTempo  Operation = "change_tempo"
	OpScaleVolume  Operation = "scale_volume"
	OpChangeOctave Operation = "change_octave"
	OpSetDuration  Operation = "set_duration"
)

type BatchConfig struct {
	InputDir    string
	OutputDir   string
	Operations  []BatchOperation
	Formats     []string
	Recursive   bool
}

type BatchOperation struct {
	Type      Operation
	Value     interface{}
	Filter    *NoteFilter
}

type NoteFilter struct {
	Pitch     []string
	Octave    *int
	MinDuration *float64
	MaxDuration *float64
}

type Processor struct {
	config BatchConfig
}

func NewProcessor(config BatchConfig) *Processor {
	return &Processor{config: config}
}

func (p *Processor) Process() (*BatchResult, error) {
	result := &BatchResult{
		InputDir:  p.config.InputDir,
		OutputDir: p.config.OutputDir,
	}

	files, err := p.findScoreFiles()
	if err != nil {
		return nil, fmt.Errorf("failed to find score files: %w", err)
	}

	result.TotalFiles = len(files)

	if err := os.MkdirAll(p.config.OutputDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create output directory: %w", err)
	}

	for _, file := range files {
		score, err := p.loadScore(file)
		if err != nil {
			result.Errors = append(result.Errors, FileError{
				Filename: filepath.Base(file),
				Error:    err.Error(),
			})
			continue
		}

		processedScore, err := p.applyOperations(score)
		if err != nil {
			result.Errors = append(result.Errors, FileError{
				Filename: filepath.Base(file),
				Error:    err.Error(),
			})
			continue
		}

		if err := p.exportScore(processedScore, file); err != nil {
			result.Errors = append(result.Errors, FileError{
				Filename: filepath.Base(file),
				Error:    err.Error(),
			})
			continue
		}

		result.ProcessedFiles = append(result.ProcessedFiles, filepath.Base(file))
		result.SuccessCount++
	}

	return result, nil
}

func (p *Processor) findScoreFiles() ([]string, error) {
	var files []string

	err := filepath.Walk(p.config.InputDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if info.IsDir() && !p.config.Recursive && path != p.config.InputDir {
			return filepath.SkipDir
		}

		ext := strings.ToLower(filepath.Ext(path))
		if ext == ".json" || ext == ".score" {
			files = append(files, path)
		}

		return nil
	})

	return files, err
}

func (p *Processor) loadScore(path string) (*models.MusicScore, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var score models.MusicScore
	if err := json.Unmarshal(data, &score); err != nil {
		return nil, fmt.Errorf("invalid score format: %w", err)
	}

	return &score, nil
}

func (p *Processor) applyOperations(score *models.MusicScore) (*models.MusicScore, error) {
	result := *score

	for mIdx := range result.Measures {
		for nIdx := range result.Measures[mIdx].Notes {
			note := &result.Measures[mIdx].Notes[nIdx]

			for _, op := range p.config.Operations {
				if op.Filter != nil && !p.matchesFilter(*note, *op.Filter) {
					continue
				}

				if err := p.applyOperation(note, op); err != nil {
					return nil, err
				}
			}
		}
	}

	return &result, nil
}

func (p *Processor) matchesFilter(note models.Note, filter NoteFilter) bool {
	if len(filter.Pitch) > 0 {
		found := false
		for _, p := range filter.Pitch {
			if strings.EqualFold(p, note.Pitch) {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}

	if filter.Octave != nil && *filter.Octave != note.Octave {
		return false
	}

	if filter.MinDuration != nil && note.Duration < *filter.MinDuration {
		return false
	}

	if filter.MaxDuration != nil && note.Duration > *filter.MaxDuration {
		return false
	}

	return true
}

func (p *Processor) applyOperation(note *models.Note, op BatchOperation) error {
	switch op.Type {
	case OpTranspose:
		semitones, ok := op.Value.(float64)
		if !ok {
			return fmt.Errorf("transpose requires numeric value")
		}
		return p.transposeNote(note, int(semitones))

	case OpChangeOctave:
		offset, ok := op.Value.(float64)
		if !ok {
			return fmt.Errorf("change_octave requires numeric value")
		}
		note.Octave += int(offset)
		if note.Octave < 0 {
			note.Octave = 0
		} else if note.Octave > 8 {
			note.Octave = 8
		}

	case OpSetDuration:
		duration, ok := op.Value.(float64)
		if !ok {
			return fmt.Errorf("set_duration requires numeric value")
		}
		note.Duration = duration

	default:
		return fmt.Errorf("unknown operation: %s", op.Type)
	}

	return nil
}

func (p *Processor) transposeNote(note *models.Note, semitones int) error {
	pitchOrder := []string{"C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"}

	currentIdx := -1
	for i, p := range pitchOrder {
		if strings.EqualFold(p, note.Pitch) {
			currentIdx = i
			break
		}
	}

	if currentIdx == -1 {
		return fmt.Errorf("unknown pitch: %s", note.Pitch)
	}

	newIdx := currentIdx + semitones
	octaveChange := 0

	for newIdx < 0 {
		newIdx += 12
		octaveChange--
	}

	for newIdx >= 12 {
		newIdx -= 12
		octaveChange++
	}

	note.Pitch = pitchOrder[newIdx]
	note.Octave += octaveChange

	if note.Octave < 0 {
		note.Octave = 0
	} else if note.Octave > 8 {
		note.Octave = 8
	}

	return nil
}

func (p *Processor) exportScore(score *models.MusicScore, inputPath string) error {
	baseName := filepath.Base(inputPath)
	ext := filepath.Ext(baseName)
	name := baseName[:len(baseName)-len(ext)]

	for _, format := range p.config.Formats {
		switch strings.ToLower(format) {
		case "json":
			if err := p.exportJSON(score, filepath.Join(p.config.OutputDir, name+".json")); err != nil {
				return err
			}
		case "csv":
			if err := p.exportCSV(score, filepath.Join(p.config.OutputDir, name+".csv")); err != nil {
				return err
			}
		}
	}

	return nil
}

func (p *Processor) exportJSON(score *models.MusicScore, path string) error {
	data, err := json.MarshalIndent(score, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

func (p *Processor) exportCSV(score *models.MusicScore, path string) error {
	file, err := os.Create(path)
	if err != nil {
		return err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	header := []string{"Measure", "Pitch", "Octave", "Duration", "StartTime"}
	if err := writer.Write(header); err != nil {
		return err
	}

	for mIdx, measure := range score.Measures {
		for _, note := range measure.Notes {
			row := []string{
				fmt.Sprintf("%d", mIdx+1),
				note.Pitch,
				fmt.Sprintf("%d", note.Octave),
				fmt.Sprintf("%.3f", note.Duration),
				fmt.Sprintf("%.3f", note.StartTime),
			}
			if err := writer.Write(row); err != nil {
				return err
			}
		}
	}

	return nil
}

type BatchResult struct {
	InputDir       string
	OutputDir      string
	TotalFiles     int
	SuccessCount   int
	ProcessedFiles []string
	Errors         []FileError
}

type FileError struct {
	Filename string
	Error    string
}

func (r *BatchResult) PrintSummary() {
	fmt.Printf("\n=== Batch Processing Summary ===\n")
	fmt.Printf("Input Directory: %s\n", r.InputDir)
	fmt.Printf("Output Directory: %s\n", r.OutputDir)
	fmt.Printf("Total Files: %d\n", r.TotalFiles)
	fmt.Printf("Successfully Processed: %d\n", r.SuccessCount)
	fmt.Printf("Errors: %d\n", len(r.Errors))

	if len(r.ProcessedFiles) > 0 {
		fmt.Printf("\nProcessed Files:\n")
		for _, f := range r.ProcessedFiles {
			fmt.Printf("  ✓ %s\n", f)
		}
	}

	if len(r.Errors) > 0 {
		fmt.Printf("\nErrors:\n")
		for _, e := range r.Errors {
			fmt.Printf("  ✗ %s: %s\n", e.Filename, e.Error)
		}
	}
}

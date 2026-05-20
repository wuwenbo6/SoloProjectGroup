package rhythm

import (
	"math"
	"sort"

	"musicscore/pkg/models"
)

type Corrector struct {
	Tempo         int
	TimeSignature string
	QuantizeLevel float64
}

func NewCorrector(tempo int, timeSig string) *Corrector {
	if tempo <= 0 {
		tempo = 60
	}
	if timeSig == "" {
		timeSig = "4/4"
	}
	return &Corrector{
		Tempo:         tempo,
		TimeSignature: timeSig,
		QuantizeLevel: 0.25,
	}
}

func (c *Corrector) CorrectScore(score *models.MusicScore) (*models.MusicScore, error) {
	corrected := &models.MusicScore{
		Type:  score.Type,
		Tempo: c.Tempo,
		Title: score.Title,
	}

	for _, measure := range score.Measures {
		correctedMeasure := c.correctMeasure(measure)
		corrected.Measures = append(corrected.Measures, correctedMeasure)
	}

	c.alignMeasures(corrected)

	return corrected, nil
}

func (c *Corrector) correctMeasure(measure models.Measure) models.Measure {
	corrected := models.Measure{
		TimeSig:  measure.TimeSig,
		KeySig:   measure.KeySig,
		Duration: measure.Duration,
	}

	sortedNotes := make([]models.Note, len(measure.Notes))
	copy(sortedNotes, measure.Notes)
	sort.Slice(sortedNotes, func(i, j int) bool {
		return sortedNotes[i].StartTime < sortedNotes[j].StartTime
	})

	for i := range sortedNotes {
		correctedNote := c.correctNote(sortedNotes[i])
		corrected.Notes = append(corrected.Notes, correctedNote)
	}

	corrected.Notes = c.removeOverlaps(corrected.Notes)

	return corrected
}

func (c *Corrector) correctNote(note models.Note) models.Note {
	quantizedStart := c.quantize(note.StartTime)
	quantizedDuration := c.quantizeDuration(note.Duration)

	if quantizedDuration < c.QuantizeLevel {
		quantizedDuration = c.QuantizeLevel
	}

	return models.Note{
		Pitch:     note.Pitch,
		Octave:    note.Octave,
		Duration:  quantizedDuration,
		StartTime: quantizedStart,
	}
}

func (c *Corrector) quantize(value float64) float64 {
	quantum := c.QuantizeLevel
	return math.Round(value/quantum) * quantum
}

func (c *Corrector) quantizeDuration(duration float64) float64 {
	validDurations := []float64{0.125, 0.25, 0.5, 1.0, 2.0, 4.0, 8.0}

	bestDiff := math.Inf(1)
	bestDur := 1.0

	for _, d := range validDurations {
		diff := math.Abs(duration - d)
		if diff < bestDiff {
			bestDiff = diff
			bestDur = d
		}
	}

	return bestDur
}

func (c *Corrector) removeOverlaps(notes []models.Note) []models.Note {
	if len(notes) < 2 {
		return notes
	}

	sort.Slice(notes, func(i, j int) bool {
		if notes[i].StartTime != notes[j].StartTime {
			return notes[i].StartTime < notes[j].StartTime
		}
		return notes[i].Pitch < notes[j].Pitch
	})

	for i := 0; i < len(notes)-1; i++ {
		currentEnd := notes[i].StartTime + notes[i].Duration
		nextStart := notes[i+1].StartTime

		if nextStart < currentEnd && nextStart > notes[i].StartTime {
			notes[i].Duration = nextStart - notes[i].StartTime
			if notes[i].Duration < 0.125 {
				notes[i].Duration = 0.125
			}
		}
	}

	return notes
}

func (c *Corrector) alignMeasures(score *models.MusicScore) {
	beatsPerMeasure := c.getBeatsPerMeasure()

	for mIdx := range score.Measures {
		measure := &score.Measures[mIdx]

		totalDuration := 0.0
		for _, note := range measure.Notes {
			totalDuration += note.Duration
		}

		if totalDuration > 0 && totalDuration < float64(beatsPerMeasure) {
			scaleFactor := float64(beatsPerMeasure) / totalDuration
			if scaleFactor > 0.5 && scaleFactor < 2.0 {
				for nIdx := range measure.Notes {
					measure.Notes[nIdx].Duration *= scaleFactor
				}
			}
		}

		measure.Duration = float64(beatsPerMeasure)
	}
}

func (c *Corrector) getBeatsPerMeasure() int {
	switch c.TimeSignature {
	case "2/4":
		return 2
	case "3/4":
		return 3
	case "6/8":
		return 6
	case "4/4", "C":
		return 4
	default:
		return 4
	}
}

func (c *Corrector) DetectTempo(notes []models.Note) int {
	if len(notes) < 2 {
		return c.Tempo
	}

	var intervals []float64
	for i := 1; i < len(notes); i++ {
		interval := notes[i].StartTime - notes[i-1].StartTime
		if interval > 0 {
			intervals = append(intervals, interval)
		}
	}

	if len(intervals) == 0 {
		return c.Tempo
	}

	sum := 0.0
	for _, interval := range intervals {
		sum += interval
	}
	avgInterval := sum / float64(len(intervals))

	estimatedTempo := int(60.0 / avgInterval)
	if estimatedTempo < 40 {
		estimatedTempo = 40
	} else if estimatedTempo > 200 {
		estimatedTempo = 200
	}

	return estimatedTempo
}

func (c *Corrector) NormalizeRhythm(notes []models.Note) []models.Note {
	if len(notes) == 0 {
		return notes
	}

	normalized := make([]models.Note, len(notes))
	copy(normalized, notes)

	startOffset := normalized[0].StartTime
	for i := range normalized {
		normalized[i].StartTime -= startOffset
	}

	return normalized
}

func (c *Corrector) QuantizeToGrid(notes []models.Note, gridSize float64) []models.Note {
	oldQuantum := c.QuantizeLevel
	c.QuantizeLevel = gridSize
	defer func() { c.QuantizeLevel = oldQuantum }()

	result := make([]models.Note, len(notes))
	for i, note := range notes {
		result[i] = c.correctNote(note)
	}

	return result
}

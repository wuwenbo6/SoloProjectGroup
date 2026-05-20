package export

import (
	"encoding/binary"
	"encoding/xml"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"musicscore/pkg/models"
)

type MidiEvent struct {
	Time    uint32
	Status  byte
	Data1   byte
	Data2   byte
}

type Exporter struct{}

func NewExporter() *Exporter {
	return &Exporter{}
}

func (e *Exporter) ExportMIDI(score *models.MusicScore, outputPath string) error {
	var events []MidiEvent

	tempoBPM := score.Tempo
	if tempoBPM <= 0 {
		tempoBPM = 60
	}
	tempo := 60000000 / tempoBPM
	events = append(events, MidiEvent{
		Time:   0,
		Status: 0xFF,
		Data1:  0x51,
		Data2:  byte(tempo >> 16),
	})

	currentTime := uint32(0)
	for _, measure := range score.Measures {
		sortedNotes := make([]models.Note, len(measure.Notes))
		copy(sortedNotes, measure.Notes)
		sort.Slice(sortedNotes, func(i, j int) bool {
			if sortedNotes[i].StartTime != sortedNotes[j].StartTime {
				return sortedNotes[i].StartTime < sortedNotes[j].StartTime
			}
			return e.noteToMidi(sortedNotes[i]) < e.noteToMidi(sortedNotes[j])
		})

		for _, note := range sortedNotes {
			midiNote := e.noteToMidi(note)
			if midiNote < 21 || midiNote > 108 {
				continue
			}

			noteStart := currentTime + uint32(note.StartTime*480)
			durationTicks := uint32(note.Duration * 480)
			if durationTicks < 120 {
				durationTicks = 240
			}
			noteEnd := noteStart + durationTicks

			events = append(events, MidiEvent{
				Time:   noteStart,
				Status: 0x90,
				Data1:  byte(midiNote),
				Data2:  80,
			})

			events = append(events, MidiEvent{
				Time:   noteEnd,
				Status: 0x80,
				Data1:  byte(midiNote),
				Data2:  40,
			})
		}

		measureDuration := e.calculateMeasureDuration(measure)
		if measureDuration > 0 {
			currentTime += uint32(measureDuration * 480)
		} else {
			currentTime += uint32(4.0 * 480)
		}
	}

	if len(events) > 0 {
		sort.Slice(events, func(i, j int) bool {
			if events[i].Time != events[j].Time {
				return events[i].Time < events[j].Time
			}
			if events[i].Status != events[j].Status {
				return events[i].Status < events[j].Status
			}
			return events[i].Data1 < events[j].Data1
		})
	}

	midiData := e.buildMidiFile(events)
	return os.WriteFile(outputPath, midiData, 0644)
}

func (e *Exporter) calculateMeasureDuration(measure models.Measure) float64 {
	maxTime := 0.0
	for _, note := range measure.Notes {
		endTime := note.StartTime + note.Duration
		if endTime > maxTime {
			maxTime = endTime
		}
	}
	if maxTime < 0.1 {
		maxTime = 4.0
	}
	return maxTime
}

func (e *Exporter) buildMidiFile(events []MidiEvent) []byte {
	var data []byte

	headerChunk := []byte{
		0x4D, 0x54, 0x68, 0x64,
		0x00, 0x00, 0x00, 0x06,
		0x00, 0x01,
		0x00, 0x01,
		0x01, 0xE0,
	}
	data = append(data, headerChunk...)

	trackData := e.buildTrackData(events)
	trackHeader := []byte{0x4D, 0x54, 0x72, 0x6B}
	trackLen := uint32(len(trackData))
	trackHeader = append(trackHeader,
		byte(trackLen>>24),
		byte(trackLen>>16),
		byte(trackLen>>8),
		byte(trackLen),
	)
	data = append(data, trackHeader...)
	data = append(data, trackData...)

	return data
}

func (e *Exporter) buildTrackData(events []MidiEvent) []byte {
	var data []byte
	prevTime := uint32(0)

	for i := 0; i < len(events); i++ {
		event := events[i]

		deltaTime := int32(event.Time - prevTime)
		if deltaTime < 0 {
			deltaTime = 0
		}
		variableLen := e.encodeVariableLength(uint32(deltaTime))
		data = append(data, variableLen...)

		if event.Status == 0xFF {
			data = append(data, 0xFF)
			data = append(data, event.Data1)
			if event.Data1 == 0x51 {
				data = append(data, 0x03)
				tempo := (uint32(event.Data2) << 16) | 0x000000
				data = append(data, byte(tempo>>16), byte(tempo>>8), byte(tempo))
			} else if event.Data1 == 0x2F {
				data = append(data, 0x00)
			}
		} else {
			data = append(data, event.Status)
			data = append(data, event.Data1)
			data = append(data, event.Data2)
		}

		prevTime = event.Time
	}

	if len(events) == 0 || events[len(events)-1].Status != 0xFF || events[len(events)-1].Data1 != 0x2F {
		data = append(data, 0x00)
		data = append(data, 0xFF, 0x2F, 0x00)
	}

	return data
}

func (e *Exporter) encodeVariableLength(value uint32) []byte {
	var result []byte

	buffer := value & 0x7F
	for value >>= 7; value > 0; value >>= 7 {
		buffer <<= 8
		buffer |= 0x80
		buffer |= (value & 0x7F)
	}

	for {
		result = append(result, byte(buffer))
		if (buffer & 0x80) != 0 {
			buffer >>= 8
		} else {
			break
		}
	}

	return result
}

func (e *Exporter) noteToMidi(note models.Note) int {
	octave := note.Octave + 1
	pitchMap := map[string]int{
		"C":  0, "C#": 1, "D": 2, "D#": 3, "E": 4,
		"F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9,
		"A#": 10, "B": 11,
	}
	pitch, ok := pitchMap[note.Pitch]
	if !ok {
		pitch = 0
	}
	return octave*12 + pitch
}

type MusicXML struct {
	XMLName xml.Name `xml:"score-partwise"`
	Version string   `xml:"version,attr"`
	PartList PartList `xml:"part-list"`
	Parts    []Part   `xml:"part"`
}

type PartList struct {
	ScorePart ScorePart `xml:"score-part"`
}

type ScorePart struct {
	ID           string      `xml:"id,attr"`
	PartName     string      `xml:"part-name"`
	ScoreInstrument ScoreInstrument `xml:"score-instrument"`
}

type ScoreInstrument struct {
	ID   string `xml:"id,attr"`
	Name string `xml:"instrument-name"`
}

type Part struct {
	ID       string    `xml:"id,attr"`
	Measures []MeasureXML `xml:"measure"`
}

type MeasureXML struct {
	Number     string      `xml:"number,attr"`
	Attributes *Attributes `xml:"attributes,omitempty"`
	Notes      []NoteXML   `xml:"note"`
}

type Attributes struct {
	Divisions int    `xml:"divisions"`
	Key       Key    `xml:"key"`
	Time      Time   `xml:"time"`
	Clef      Clef   `xml:"clef"`
}

type Key struct {
	Fifths int `xml:"fifths"`
}

type Time struct {
	Beats    int `xml:"beats"`
	BeatType int `xml:"beat-type"`
}

type Clef struct {
	Sign string `xml:"sign"`
	Line int    `xml:"line"`
}

type NoteXML struct {
	Pitch    *Pitch `xml:"pitch,omitempty"`
	Duration  int    `xml:"duration"`
	Type      string `xml:"type"`
	Voice     int    `xml:"voice"`
	Rest      *struct{} `xml:"rest,omitempty"`
}

type Pitch struct {
	Step  string `xml:"step"`
	Alter *int   `xml:"alter,omitempty"`
	Octave int    `xml:"octave"`
}

func (e *Exporter) ExportMusicXML(score *models.MusicScore, outputPath string) error {
	musicXML := e.convertToMusicXML(score)
	xmlData, err := xml.MarshalIndent(musicXML, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal XML: %w", err)
	}

	xmlWithHeader := []byte(xml.Header + string(xmlData))
	return os.WriteFile(outputPath, xmlWithHeader, 0644)
}

func (e *Exporter) convertToMusicXML(score *models.MusicScore) *MusicXML {
	musicXML := &MusicXML{
		Version: "3.0",
		PartList: PartList{
			ScorePart: ScorePart{
				ID:       "P1",
				PartName: "Music",
				ScoreInstrument: ScoreInstrument{
					ID:   "P1-I1",
					Name: "Piano",
				},
			},
		},
	}

	var measures []MeasureXML
	for i, measure := range score.Measures {
		measureXML := MeasureXML{
			Number: fmt.Sprintf("%d", i+1),
		}

		if i == 0 {
			measureXML.Attributes = &Attributes{
				Divisions: 4,
				Key: Key{
					Fifths: 0,
				},
				Time: Time{
					Beats:    4,
					BeatType: 4,
				},
				Clef: Clef{
					Sign: "G",
					Line: 2,
				},
			}
		}

		for _, note := range measure.Notes {
			noteXML := e.convertNoteToXML(note)
			measureXML.Notes = append(measureXML.Notes, noteXML)
		}

		if len(measureXML.Notes) == 0 {
			measureXML.Notes = append(measureXML.Notes, NoteXML{
				Rest:     &struct{}{},
				Duration: 16,
				Type:     "whole",
				Voice:    1,
			})
		}

		measures = append(measures, measureXML)
	}

	musicXML.Parts = []Part{
		{
			ID:       "P1",
			Measures: measures,
		},
	}

	return musicXML
}

func (e *Exporter) convertNoteToXML(note models.Note) NoteXML {
	noteXML := NoteXML{
		Duration: int(note.Duration * 4),
		Type:     e.durationToType(note.Duration),
		Voice:    1,
	}

	step, alter := e.pitchToStepAlter(note.Pitch)
	noteXML.Pitch = &Pitch{
		Step:   step,
		Octave: note.Octave,
	}
	if alter != 0 {
		noteXML.Pitch.Alter = &alter
	}

	return noteXML
}

func (e *Exporter) pitchToStepAlter(pitch string) (string, int) {
	switch pitch {
	case "C", "c", "1":
		return "C", 0
	case "C#", "c#", "1#":
		return "C", 1
	case "D", "d", "2":
		return "D", 0
	case "D#", "d#", "2#":
		return "D", 1
	case "E", "e", "3":
		return "E", 0
	case "F", "f", "4":
		return "F", 0
	case "F#", "f#", "4#":
		return "F", 1
	case "G", "g", "5":
		return "G", 0
	case "G#", "g#", "5#":
		return "G", 1
	case "A", "a", "6":
		return "A", 0
	case "A#", "a#", "6#":
		return "A", 1
	case "B", "b", "7":
		return "B", 0
	default:
		return "C", 0
	}
}

func (e *Exporter) durationToType(duration float64) string {
	switch {
	case duration >= 8.0:
		return "breve"
	case duration >= 4.0:
		return "whole"
	case duration >= 2.0:
		return "half"
	case duration >= 1.0:
		return "quarter"
	case duration >= 0.5:
		return "eighth"
	case duration >= 0.25:
		return "16th"
	case duration >= 0.125:
		return "32nd"
	default:
		return "quarter"
	}
}

func (e *Exporter) Export(score *models.MusicScore, outputDir string) (midiPath string, xmlPath string, err error) {
	title := score.Title
	if title == "" {
		title = "output"
	}
	title = strings.ReplaceAll(title, string(filepath.Separator), "_")
	title = strings.ReplaceAll(title, "/", "_")
	title = strings.ReplaceAll(title, "\\", "_")

	midiPath = filepath.Join(outputDir, fmt.Sprintf("%s.mid", title))
	xmlPath = filepath.Join(outputDir, fmt.Sprintf("%s.xml", title))

	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return "", "", fmt.Errorf("failed to create output directory: %w", err)
	}

	if err := e.ExportMIDI(score, midiPath); err != nil {
		return "", "", fmt.Errorf("failed to export MIDI: %w", err)
	}

	if err := e.ExportMusicXML(score, xmlPath); err != nil {
		return "", "", fmt.Errorf("failed to export MusicXML: %w", err)
	}

	return midiPath, xmlPath, nil
}

func writeUint16(buf []byte, offset int, value uint16) {
	binary.BigEndian.PutUint16(buf[offset:], value)
}

func writeUint32(buf []byte, offset int, value uint32) {
	binary.BigEndian.PutUint32(buf[offset:], value)
}

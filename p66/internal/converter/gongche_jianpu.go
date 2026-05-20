package converter

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"musicscore/pkg/models"
)

type GongcheToJianpuConverter struct {
	Key          string
	Tempo        int
	ShowDuration bool
}

func NewGongcheToJianpuConverter() *GongcheToJianpuConverter {
	return &GongcheToJianpuConverter{
		Key:          "C",
		Tempo:        60,
		ShowDuration: true,
	}
}

type NoteMapping struct {
	Gongche string
	Jianpu  string
	MIDI    int
}

var gongcheMapping = []NoteMapping{
	{Gongche: "合", Jianpu: "5̣", MIDI: 60},
	{Gongche: "四", Jianpu: "6̣", MIDI: 62},
	{Gongche: "一", Jianpu: "7̣", MIDI: 64},
	{Gongche: "上", Jianpu: "1̣", MIDI: 65},
	{Gongche: "尺", Jianpu: "2̣", MIDI: 67},
	{Gongche: "工", Jianpu: "3̣", MIDI: 69},
	{Gongche: "凡", Jianpu: "4̣", MIDI: 71},
	{Gongche: "六", Jianpu: "5̲", MIDI: 72},
	{Gongche: "五", Jianpu: "6̲", MIDI: 74},
	{Gongche: "乙", Jianpu: "7̲", MIDI: 76},
}

var gongcheMap map[string]NoteMapping

func init() {
	gongcheMap = make(map[string]NoteMapping)
	for _, m := range gongcheMapping {
		gongcheMap[m.Gongche] = m
	}
}

func (c *GongcheToJianpuConverter) Convert(score *models.MusicScore) *ConversionResult {
	result := &ConversionResult{
		Title:      score.Title,
		Tempo:      c.Tempo,
		Key:        c.Key,
		SourceType: "工尺谱",
		TargetType: "简谱",
	}

	for mIdx, measure := range score.Measures {
		measureNotes := make([]NotePair, 0, len(measure.Notes))

		for _, note := range measure.Notes {
			pair := c.convertNote(note)
			pair.Measure = mIdx + 1
			measureNotes = append(measureNotes, pair)
		}

		result.Measures = append(result.Measures, MeasureNotes{
			MeasureIndex: mIdx + 1,
			Notes:        measureNotes,
		})
	}

	result.Statistics = c.calculateStatistics(result.Measures)

	return result
}

func (c *GongcheToJianpuConverter) convertNote(note models.Note) NotePair {
	gongcheSymbol := c.findGongcheFromNote(note)
	jianpuSymbol := c.findJianpuFromGongche(gongcheSymbol)

	duration := c.formatDuration(note.Duration)

	return NotePair{
		Gongche:     gongcheSymbol,
		Jianpu:      jianpuSymbol,
		Duration:    duration,
		RawDuration: note.Duration,
		Pitch:       note.Pitch,
		Octave:      note.Octave,
		StartTime:   note.StartTime,
		MIDINote:    c.noteToMIDI(note),
	}
}

func (c *GongcheToJianpuConverter) findGongcheFromNote(note models.Note) string {
	targetMIDI := c.noteToMIDI(note)
	for _, m := range gongcheMapping {
		if m.MIDI == targetMIDI {
			return m.Gongche
		}
	}

	minDiff := 100
	bestMatch := "工"
	for _, m := range gongcheMapping {
		diff := abs(m.MIDI - targetMIDI)
		if diff < minDiff {
			minDiff = diff
			bestMatch = m.Gongche
		}
	}
	return bestMatch
}

func (c *GongcheToJianpuConverter) findJianpuFromGongche(gongche string) string {
	if m, ok := gongcheMap[gongche]; ok {
		return m.Jianpu
	}
	return "?"
}

func (c *GongcheToJianpuConverter) noteToMIDI(note models.Note) int {
	pitchMap := map[string]int{
		"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4,
		"F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9,
		"A#": 10, "B": 11,
	}
	pitch, ok := pitchMap[note.Pitch]
	if !ok {
		pitch = 0
	}
	return (note.Octave+1)*12 + pitch
}

func (c *GongcheToJianpuConverter) formatDuration(duration float64) string {
	switch {
	case duration >= 4.0:
		return "全音符"
	case duration >= 2.0:
		return "二分音符"
	case duration >= 1.0:
		return "四分音符"
	case duration >= 0.5:
		return "八分音符"
	case duration >= 0.25:
		return "十六分音符"
	case duration >= 0.125:
		return "三十二分音符"
	default:
		return "四分音符"
	}
}

func (c *GongcheToJianpuConverter) calculateStatistics(measures []MeasureNotes) ConversionStats {
	stats := ConversionStats{}
	stats.TotalMeasures = len(measures)

	for _, measure := range measures {
		stats.TotalNotes += len(measure.Notes)

		for _, note := range measure.Notes {
			stats.TotalDuration += note.RawDuration
			if _, ok := stats.NoteFrequency[note.Gongche]; ok {
				stats.NoteFrequency[note.Gongche]++
			} else {
				stats.NoteFrequency[note.Gongche] = 1
			}
		}
	}

	if stats.TotalNotes > 0 {
		stats.AverageNotesPerMeasure = float64(stats.TotalNotes) / float64(stats.TotalMeasures)
	}

	return stats
}

func (c *GongcheToJianpuConverter) ExportText(result *ConversionResult, outputPath string) error {
	file, err := os.Create(outputPath)
	if err != nil {
		return err
	}
	defer file.Close()

	writer := bufio.NewWriter(file)

	writer.WriteString("========================================\n")
	writer.WriteString("       工尺谱 → 简谱 对照转换表\n")
	writer.WriteString("========================================\n\n")

	if result.Title != "" {
		writer.WriteString(fmt.Sprintf("曲目名称: %s\n", result.Title))
	}
	writer.WriteString(fmt.Sprintf("调号: %s调\n", c.Key))
	writer.WriteString(fmt.Sprintf("速度: 每分钟 %d 拍\n", c.Tempo))
	writer.WriteString(fmt.Sprintf("小节数: %d\n", result.Statistics.TotalMeasures))
	writer.WriteString(fmt.Sprintf("总音符数: %d\n\n", result.Statistics.TotalNotes))

	writer.WriteString("----------------------------------------\n")
	writer.WriteString(" 工尺谱 | 简谱 | 时值 | 音高(MIDI)\n")
	writer.WriteString("----------------------------------------\n")

	for _, measure := range result.Measures {
		writer.WriteString(fmt.Sprintf("\n【第 %d 小节】\n", measure.MeasureIndex))
		for _, note := range measure.Notes {
			line := fmt.Sprintf("  %s    |  %s  | %s | %d (%s%d)\n",
				note.Gongche,
				c.formatJianpuForText(note.Jianpu),
				c.formatDurationShort(note.Duration),
				note.MIDINote,
				note.Pitch,
				note.Octave,
			)
			writer.WriteString(line)
		}
	}

	writer.WriteString("\n----------------------------------------\n")
	writer.WriteString("             转换说明\n")
	writer.WriteString("----------------------------------------\n")
	writer.WriteString("  工尺谱音符对应关系:\n")
	for _, m := range gongcheMapping {
		writer.WriteString(fmt.Sprintf("    %s → %s (MIDI: %d)\n", m.Gongche, m.Jianpu, m.MIDI))
	}
	writer.WriteString("\n  符号说明:\n")
	writer.WriteString("    下划线(_)表示低音点\n")
	writer.WriteString("    句点(.)表示附点\n\n")

	writer.WriteString("========================================\n")
	writer.WriteString("             统计信息\n")
	writer.WriteString("========================================\n")
	writer.WriteString(fmt.Sprintf("总小节数: %d\n", result.Statistics.TotalMeasures))
	writer.WriteString(fmt.Sprintf("总音符数: %d\n", result.Statistics.TotalNotes))
	writer.WriteString(fmt.Sprintf("每小节平均音符数: %.2f\n", result.Statistics.AverageNotesPerMeasure))
	writer.WriteString(fmt.Sprintf("总时值: %.2f 拍\n", result.Statistics.TotalDuration))
	writer.WriteString("\n音符使用频率:\n")
	for gongche, count := range result.Statistics.NoteFrequency {
		writer.WriteString(fmt.Sprintf("  %s: %d 次\n", gongche, count))
	}

	return writer.Flush()
}

func (c *GongcheToJianpuConverter) ExportMarkdown(result *ConversionResult, outputPath string) error {
	file, err := os.Create(outputPath)
	if err != nil {
		return err
	}
	defer file.Close()

	writer := bufio.NewWriter(file)

	writer.WriteString("# 工尺谱 → 简谱 对照转换表\n\n")

	if result.Title != "" {
		writer.WriteString(fmt.Sprintf("## 曲目: %s\n\n", result.Title))
	}

	writer.WriteString("### 基本信息\n\n")
	writer.WriteString("| 项目 | 值 |\n")
	writer.WriteString("|------|----|\n")
	writer.WriteString(fmt.Sprintf("| 调号 | %s调 |\n", c.Key))
	writer.WriteString(fmt.Sprintf("| 速度 | %d BPM |\n", c.Tempo))
	writer.WriteString(fmt.Sprintf("| 小节数 | %d |\n", result.Statistics.TotalMeasures))
	writer.WriteString(fmt.Sprintf("| 总音符数 | %d |\n\n", result.Statistics.TotalNotes))

	writer.WriteString("---\n\n")
	writer.WriteString("## 音符对照表\n\n")

	for _, measure := range result.Measures {
		writer.WriteString(fmt.Sprintf("### 第 %d 小节\n\n", measure.MeasureIndex))
		writer.WriteString("| 工尺谱 | 简谱 | 时值 | MIDI | 音高 |\n")
		writer.WriteString("|--------|------|------|------|------|\n")
		for _, note := range measure.Notes {
			writer.WriteString(fmt.Sprintf("| %s | %s | %s | %d | %s%d |\n",
				note.Gongche,
				c.formatJianpuForText(note.Jianpu),
				c.formatDurationShort(note.Duration),
				note.MIDINote,
				note.Pitch,
				note.Octave,
			))
		}
		writer.WriteString("\n")
	}

	writer.WriteString("---\n\n")
	writer.WriteString("## 转换说明\n\n")
	writer.WriteString("### 工尺谱音符对应关系\n\n")
	writer.WriteString("| 工尺谱 | 简谱 | MIDI |\n")
	writer.WriteString("|--------|------|------|\n")
	for _, m := range gongcheMapping {
		writer.WriteString(fmt.Sprintf("| %s | %s | %d |\n", m.Gongche, m.Jianpu, m.MIDI))
	}
	writer.WriteString("\n")

	writer.WriteString("### 符号说明\n\n")
	writer.WriteString("- 下划线(_)表示低音点\n")
	writer.WriteString("- 句点(.)表示附点\n\n")

	writer.WriteString("---\n\n")
	writer.WriteString("## 统计信息\n\n")
	writer.WriteString(fmt.Sprintf("- **总小节数**: %d\n", result.Statistics.TotalMeasures))
	writer.WriteString(fmt.Sprintf("- **总音符数**: %d\n", result.Statistics.TotalNotes))
	writer.WriteString(fmt.Sprintf("- **每小节平均音符数**: %.2f\n", result.Statistics.AverageNotesPerMeasure))
	writer.WriteString(fmt.Sprintf("- **总时值**: %.2f 拍\n\n", result.Statistics.TotalDuration))

	writer.WriteString("### 音符使用频率\n\n")
	for gongche, count := range result.Statistics.NoteFrequency {
		writer.WriteString(fmt.Sprintf("- **%s**: %d 次\n", gongche, count))
	}

	return writer.Flush()
}

func (c *GongcheToJianpuConverter) ExportCSV(result *ConversionResult, outputPath string) error {
	file, err := os.Create(outputPath)
	if err != nil {
		return err
	}
	defer file.Close()

	writer := bufio.NewWriter(file)

	writer.WriteString("小节,工尺谱,简谱,时值,MIDI,音高,八度,开始时间\n")

	for _, measure := range result.Measures {
		for _, note := range measure.Notes {
			line := fmt.Sprintf("%d,%s,%s,%s,%d,%s,%d,%.2f\n",
				note.Measure,
				note.Gongche,
				c.formatJianpuForText(note.Jianpu),
				c.formatDurationShort(note.Duration),
				note.MIDINote,
				note.Pitch,
				note.Octave,
				note.StartTime,
			)
			writer.WriteString(line)
		}
	}

	return writer.Flush()
}

func (c *GongcheToJianpuConverter) formatJianpuForText(jianpu string) string {
	jianpu = strings.ReplaceAll(jianpu, "̣", ".")
	jianpu = strings.ReplaceAll(jianpu, "̲", "_")
	return jianpu
}

func (c *GongcheToJianpuConverter) formatDurationShort(duration string) string {
	switch duration {
	case "全音符":
		return "全"
	case "二分音符":
		return "二分"
	case "四分音符":
		return "四分"
	case "八分音符":
		return "八分"
	case "十六分音符":
		return "十六"
	case "三十二分音符":
		return "三十二"
	default:
		return "四分"
	}
}

type ConversionResult struct {
	Title      string
	Tempo      int
	Key        string
	SourceType string
	TargetType string
	Measures   []MeasureNotes
	Statistics ConversionStats
}

type MeasureNotes struct {
	MeasureIndex int
	Notes        []NotePair
}

type NotePair struct {
	Measure     int
	Gongche     string
	Jianpu      string
	Duration    string
	RawDuration float64
	Pitch       string
	Octave      int
	StartTime   float64
	MIDINote    int
}

type ConversionStats struct {
	TotalMeasures         int
	TotalNotes            int
	TotalDuration         float64
	AverageNotesPerMeasure float64
	NoteFrequency         map[string]int
}

func ParseTransposeValue(value string) (int, error) {
	if strings.HasSuffix(value, "#") {
		num, err := strconv.Atoi(strings.TrimSuffix(value, "#"))
		if err != nil {
			return 0, err
		}
		return num, nil
	}
	if strings.HasSuffix(value, "b") {
		num, err := strconv.Atoi(strings.TrimSuffix(value, "b"))
		if err != nil {
			return 0, err
		}
		return -num, nil
	}
	return strconv.Atoi(value)
}

func GetOutputPath(inputPath, outputDir, format string) string {
	baseName := filepath.Base(inputPath)
	ext := filepath.Ext(baseName)
	name := baseName[:len(baseName)-len(ext)]
	return filepath.Join(outputDir, fmt.Sprintf("%s_comparison.%s", name, format))
}

func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}

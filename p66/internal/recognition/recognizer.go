package recognition

import (
	"fmt"
	"math"
	"sort"

	"musicscore/pkg/models"
)

type GongcheSymbol string

const (
	GongcheHe  GongcheSymbol = "合"
	GongcheSi  GongcheSymbol = "四"
	GongcheYi  GongcheSymbol = "一"
	GongcheShang GongcheSymbol = "上"
	GongcheChe GongcheSymbol = "尺"
	GongcheGong GongcheSymbol = "工"
	GongcheFan GongcheSymbol = "凡"
	GongcheLiu GongcheSymbol = "六"
	GongcheWu  GongcheSymbol = "五"
	GongcheYi2 GongcheSymbol = "乙"
)

var gongcheToMIDI = map[GongcheSymbol]int{
	GongcheHe:    60,
	GongcheSi:    62,
	GongcheYi:    64,
	GongcheShang: 65,
	GongcheChe:   67,
	GongcheGong:  69,
	GongcheFan:   71,
	GongcheLiu:   72,
	GongcheWu:    74,
	GongcheYi2:   76,
}

type JianziPosition string

const (
	JianziHui1  JianziPosition = "一徽"
	JianziHui2  JianziPosition = "二徽"
	JianziHui3  JianziPosition = "三徽"
	JianziHui4  JianziPosition = "四徽"
	JianziHui5  JianziPosition = "五徽"
	JianziHui6  JianziPosition = "六徽"
	JianziHui7  JianziPosition = "七徽"
	JianziHui8  JianziPosition = "八徽"
	JianziHui9  JianziPosition = "九徽"
	JianziHui10 JianziPosition = "十徽"
	JianziHui11 JianziPosition = "十一徽"
	JianziHui12 JianziPosition = "十二徽"
	JianziHui13 JianziPosition = "十三徽"
)

type SymbolFeatures struct {
	Area        int
	AspectRatio float64
	Width       int
	Height      int
	CenterX     int
	CenterY     int
	Density     float64
	HorizontalProjection []int
	VerticalProjection   []int
	HuMoments   [7]float64
}

type Template struct {
	Symbol   string
	Features SymbolFeatures
	Weight   float64
}

type Config struct {
	MinConfidence    float64
	TemplateMatching bool
	UseProjection    bool
	UseHuMoments     bool
}

func DefaultConfig() Config {
	return Config{
		MinConfidence:    0.7,
		TemplateMatching: true,
		UseProjection:    true,
		UseHuMoments:     true,
	}
}

type Recognizer struct {
	config            Config
	gongcheTemplates  []Template
	jianziTemplates   []Template
}

func NewRecognizer(config Config) *Recognizer {
	r := &Recognizer{config: config}
	r.initTemplates()
	return r
}

func (r *Recognizer) initTemplates() {
	r.gongcheTemplates = []Template{
		{Symbol: string(GongcheHe), Features: SymbolFeatures{AspectRatio: 0.9, Width: 30, Height: 33}, Weight: 1.0},
		{Symbol: string(GongcheSi), Features: SymbolFeatures{AspectRatio: 0.75, Width: 24, Height: 32}, Weight: 1.0},
		{Symbol: string(GongcheYi), Features: SymbolFeatures{AspectRatio: 0.35, Width: 12, Height: 34}, Weight: 1.2},
		{Symbol: string(GongcheShang), Features: SymbolFeatures{AspectRatio: 0.85, Width: 28, Height: 33}, Weight: 1.0},
		{Symbol: string(GongcheChe), Features: SymbolFeatures{AspectRatio: 1.8, Width: 45, Height: 25}, Weight: 1.1},
		{Symbol: string(GongcheGong), Features: SymbolFeatures{AspectRatio: 1.0, Width: 32, Height: 32}, Weight: 1.0},
		{Symbol: string(GongcheFan), Features: SymbolFeatures{AspectRatio: 1.2, Width: 38, Height: 32}, Weight: 1.0},
		{Symbol: string(GongcheLiu), Features: SymbolFeatures{AspectRatio: 0.95, Width: 30, Height: 32}, Weight: 1.0},
		{Symbol: string(GongcheWu), Features: SymbolFeatures{AspectRatio: 0.8, Width: 26, Height: 33}, Weight: 1.0},
		{Symbol: string(GongcheYi2), Features: SymbolFeatures{AspectRatio: 0.45, Width: 15, Height: 33}, Weight: 1.1},
	}

	r.jianziTemplates = []Template{
		{Symbol: string(JianziHui1), Features: SymbolFeatures{AspectRatio: 0.7, Width: 21, Height: 30}, Weight: 1.0},
		{Symbol: string(JianziHui2), Features: SymbolFeatures{AspectRatio: 0.75, Width: 23, Height: 31}, Weight: 1.0},
		{Symbol: string(JianziHui3), Features: SymbolFeatures{AspectRatio: 0.8, Width: 24, Height: 30}, Weight: 1.0},
		{Symbol: string(JianziHui4), Features: SymbolFeatures{AspectRatio: 0.85, Width: 26, Height: 31}, Weight: 1.0},
		{Symbol: string(JianziHui5), Features: SymbolFeatures{AspectRatio: 0.9, Width: 27, Height: 30}, Weight: 1.0},
		{Symbol: string(JianziHui6), Features: SymbolFeatures{AspectRatio: 0.95, Width: 28, Height: 30}, Weight: 1.0},
		{Symbol: string(JianziHui7), Features: SymbolFeatures{AspectRatio: 0.6, Width: 18, Height: 30}, Weight: 1.2},
		{Symbol: string(JianziHui8), Features: SymbolFeatures{AspectRatio: 1.0, Width: 30, Height: 30}, Weight: 1.0},
		{Symbol: string(JianziHui9), Features: SymbolFeatures{AspectRatio: 1.5, Width: 45, Height: 30}, Weight: 1.1},
		{Symbol: string(JianziHui10), Features: SymbolFeatures{AspectRatio: 1.0, Width: 30, Height: 30}, Weight: 1.0},
		{Symbol: string(JianziHui11), Features: SymbolFeatures{AspectRatio: 1.1, Width: 33, Height: 30}, Weight: 1.0},
		{Symbol: string(JianziHui12), Features: SymbolFeatures{AspectRatio: 1.2, Width: 36, Height: 30}, Weight: 1.0},
		{Symbol: string(JianziHui13), Features: SymbolFeatures{AspectRatio: 1.3, Width: 39, Height: 30}, Weight: 1.0},
	}
}

func (r *Recognizer) extractFeatures(symbol models.MusicSymbol) SymbolFeatures {
	area := symbol.Width * symbol.Height
	aspectRatio := float64(symbol.Width) / float64(symbol.Height)
	density := 0.7

	centerX := symbol.PositionX + symbol.Width/2
	centerY := symbol.PositionY + symbol.Height/2

	hProj := make([]int, 10)
	vProj := make([]int, 10)
	for i := 0; i < 10; i++ {
		hProj[i] = int(float64(symbol.Width) * (0.5 + 0.1*float64(i-5)))
		vProj[i] = int(float64(symbol.Height) * (0.5 + 0.1*float64(i-5)))
	}

	var huMoments [7]float64
	huMoments[0] = aspectRatio
	huMoments[1] = float64(area) / 1000.0
	huMoments[2] = density
	huMoments[3] = float64(centerX) / 100.0
	huMoments[4] = float64(centerY) / 100.0
	huMoments[5] = float64(symbol.Width) / 50.0
	huMoments[6] = float64(symbol.Height) / 50.0

	return SymbolFeatures{
		Area:                 area,
		AspectRatio:          aspectRatio,
		Width:                symbol.Width,
		Height:               symbol.Height,
		CenterX:              centerX,
		CenterY:              centerY,
		Density:              density,
		HorizontalProjection: hProj,
		VerticalProjection:   vProj,
		HuMoments:            huMoments,
	}
}

func (r *Recognizer) calculateSimilarity(f1, f2 SymbolFeatures) float64 {
	var score float64 = 0.0
	var totalWeight float64 = 0.0

	arDiff := math.Abs(f1.AspectRatio - f2.AspectRatio)
	arScore := math.Exp(-arDiff * 2.0)
	score += arScore * 0.35
	totalWeight += 0.35

	widthRatio := float64(min(f1.Width, f2.Width)) / float64(max(f1.Width, f2.Width))
	score += widthRatio * 0.15
	totalWeight += 0.15

	heightRatio := float64(min(f1.Height, f2.Height)) / float64(max(f1.Height, f2.Height))
	score += heightRatio * 0.15
	totalWeight += 0.15

	areaRatio := float64(min(f1.Area, f2.Area)) / float64(max(f1.Area, f2.Area))
	score += areaRatio * 0.10
	totalWeight += 0.10

	if r.config.UseHuMoments {
		huDistance := 0.0
		for i := 0; i < 7; i++ {
			huDistance += math.Abs(f1.HuMoments[i] - f2.HuMoments[i])
		}
		huScore := math.Exp(-huDistance * 0.5)
		score += huScore * 0.15
		totalWeight += 0.15
	}

	if r.config.UseProjection {
		hSim := 0.0
		vSim := 0.0
		for i := 0; i < 10; i++ {
			if max(f1.HorizontalProjection[i], f2.HorizontalProjection[i]) > 0 {
				hSim += float64(min(f1.HorizontalProjection[i], f2.HorizontalProjection[i])) /
					float64(max(f1.HorizontalProjection[i], f2.HorizontalProjection[i]))
			}
			if max(f1.VerticalProjection[i], f2.VerticalProjection[i]) > 0 {
				vSim += float64(min(f1.VerticalProjection[i], f2.VerticalProjection[i])) /
					float64(max(f1.VerticalProjection[i], f2.VerticalProjection[i]))
			}
		}
		projScore := (hSim + vSim) / 20.0
		score += projScore * 0.10
		totalWeight += 0.10
	}

	if totalWeight > 0 {
		score = score / totalWeight
	}

	return score
}

func (r *Recognizer) RecognizeSymbols(symbols []models.MusicSymbol, scoreType models.ScoreType) (*models.MusicScore, error) {
	switch scoreType {
	case models.ScoreTypeGongche:
		return r.recognizeGongche(symbols)
	case models.ScoreTypeJianzi:
		return r.recognizeJianzi(symbols)
	default:
		return nil, fmt.Errorf("unsupported score type: %s", scoreType)
	}
}

func (r *Recognizer) recognizeGongche(symbols []models.MusicSymbol) (*models.MusicScore, error) {
	score := &models.MusicScore{
		Type:  models.ScoreTypeGongche,
		Tempo: 60,
		Title: "Gongche Score",
	}

	sortedSymbols := r.sortSymbolsByPosition(symbols)
	groupedSymbols := r.groupByRow(sortedSymbols)

	var measures []models.Measure
	for _, rowSymbols := range groupedSymbols {
		var measure models.Measure
		measure.TimeSig = "4/4"
		measure.KeySig = "C"

		for i, sym := range rowSymbols {
			recognizedSym, confidence := r.classifyGongcheSymbol(sym)
			if confidence >= r.config.MinConfidence {
				recognizedSym.Confidence = confidence
				note := r.convertToNote(recognizedSym)
				note.StartTime = float64(i)
				measure.Notes = append(measure.Notes, note)
			}
		}

		if len(measure.Notes) > 0 {
			measures = append(measures, measure)
		}
	}

	score.Measures = measures
	return score, nil
}

func (r *Recognizer) recognizeJianzi(symbols []models.MusicSymbol) (*models.MusicScore, error) {
	score := &models.MusicScore{
		Type:  models.ScoreTypeJianzi,
		Tempo: 60,
		Title: "Jianzi Score",
	}

	sortedSymbols := r.sortSymbolsByPosition(symbols)
	groupedSymbols := r.groupByRow(sortedSymbols)

	var measures []models.Measure
	for _, rowSymbols := range groupedSymbols {
		var measure models.Measure
		measure.TimeSig = "4/4"
		measure.KeySig = "C"

		for i, sym := range rowSymbols {
			recognizedSym, confidence := r.classifyJianziSymbol(sym)
			if confidence >= r.config.MinConfidence {
				recognizedSym.Confidence = confidence
				note := r.convertJianziToNote(recognizedSym)
				note.StartTime = float64(i)
				measure.Notes = append(measure.Notes, note)
			}
		}

		if len(measure.Notes) > 0 {
			measures = append(measures, measure)
		}
	}

	score.Measures = measures
	return score, nil
}

func (r *Recognizer) groupByRow(symbols []models.MusicSymbol) [][]models.MusicSymbol {
	if len(symbols) == 0 {
		return nil
	}

	rowThreshold := 20
	var rows [][]models.MusicSymbol
	currentRow := []models.MusicSymbol{symbols[0]}
	currentRowY := symbols[0].PositionY

	for i := 1; i < len(symbols); i++ {
		sym := symbols[i]
		if math.Abs(float64(sym.PositionY-currentRowY)) > float64(rowThreshold) {
			rows = append(rows, currentRow)
			currentRow = []models.MusicSymbol{sym}
			currentRowY = sym.PositionY
		} else {
			currentRow = append(currentRow, sym)
			if len(currentRow) > 1 {
				avgY := 0
				for _, s := range currentRow {
					avgY += s.PositionY
				}
				currentRowY = avgY / len(currentRow)
			}
		}
	}

	if len(currentRow) > 0 {
		rows = append(rows, currentRow)
	}

	return rows
}

func (r *Recognizer) sortSymbolsByPosition(symbols []models.MusicSymbol) []models.MusicSymbol {
	sorted := make([]models.MusicSymbol, len(symbols))
	copy(sorted, symbols)

	sort.Slice(sorted, func(i, j int) bool {
		if sorted[i].PositionY != sorted[j].PositionY {
			return sorted[i].PositionY < sorted[j].PositionY
		}
		return sorted[i].PositionX < sorted[j].PositionX
	})

	return sorted
}

func (r *Recognizer) classifyGongcheSymbol(symbol models.MusicSymbol) (models.MusicSymbol, float64) {
	features := r.extractFeatures(symbol)

	bestMatch := ""
	bestScore := 0.0

	for _, template := range r.gongcheTemplates {
		score := r.calculateSimilarity(features, template.Features)
		score *= template.Weight
		if score > bestScore {
			bestScore = score
			bestMatch = template.Symbol
		}
	}

	if bestScore < 0.5 {
		bestMatch = r.classifyByRules(features)
		bestScore = 0.6
	}

	result := models.MusicSymbol{
		PositionX:  symbol.PositionX,
		PositionY:  symbol.PositionY,
		Width:      symbol.Width,
		Height:     symbol.Height,
		Confidence: math.Min(bestScore, 0.95),
		Type:       bestMatch,
		Value:      bestMatch,
	}

	return result, bestScore
}

func (r *Recognizer) classifyByRules(features SymbolFeatures) string {
	switch {
	case features.AspectRatio < 0.4:
		return string(GongcheYi)
	case features.AspectRatio < 0.5:
		return string(GongcheYi2)
	case features.AspectRatio > 1.6:
		return string(GongcheChe)
	case features.AspectRatio > 1.3:
		return string(GongcheFan)
	case features.Area > 1500:
		return string(GongcheHe)
	case features.AspectRatio > 0.9:
		return string(GongcheGong)
	case features.AspectRatio > 0.8:
		return string(GongcheLiu)
	case features.AspectRatio > 0.7:
		return string(GongcheShang)
	default:
		return string(GongcheSi)
	}
}

func (r *Recognizer) classifyJianziSymbol(symbol models.MusicSymbol) (models.MusicSymbol, float64) {
	features := r.extractFeatures(symbol)

	bestMatch := ""
	bestScore := 0.0

	for _, template := range r.jianziTemplates {
		score := r.calculateSimilarity(features, template.Features)
		score *= template.Weight
		if score > bestScore {
			bestScore = score
			bestMatch = template.Symbol
		}
	}

	if bestScore < 0.5 {
		bestMatch = r.classifyJianziByRules(features)
		bestScore = 0.6
	}

	result := models.MusicSymbol{
		PositionX:  symbol.PositionX,
		PositionY:  symbol.PositionY,
		Width:      symbol.Width,
		Height:     symbol.Height,
		Confidence: math.Min(bestScore, 0.95),
		Type:       bestMatch,
		Value:      bestMatch,
	}

	return result, bestScore
}

func (r *Recognizer) classifyJianziByRules(features SymbolFeatures) string {
	switch {
	case features.AspectRatio < 0.55:
		return string(JianziHui7)
	case features.AspectRatio < 0.7:
		return string(JianziHui1)
	case features.AspectRatio > 1.4:
		return string(JianziHui9)
	case features.AspectRatio > 1.2:
		return string(JianziHui13)
	case features.AspectRatio > 1.1:
		return string(JianziHui12)
	case features.AspectRatio > 1.0:
		return string(JianziHui11)
	default:
		return string(JianziHui10)
	}
}

func (r *Recognizer) convertToNote(symbol models.MusicSymbol) models.Note {
	midiNote, ok := gongcheToMIDI[GongcheSymbol(symbol.Value)]
	if !ok {
		midiNote = 60
	}

	pitchNames := []string{"C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"}
	pitch := pitchNames[midiNote%12]
	octave := (midiNote / 12) - 1

	return models.Note{
		Pitch:     pitch,
		Octave:    octave,
		Duration:  1.0,
		StartTime: 0.0,
	}
}

func (r *Recognizer) convertJianziToNote(symbol models.MusicSymbol) models.Note {
	jianziToMIDI := map[string]int{
		string(JianziHui1):  72,
		string(JianziHui2):  71,
		string(JianziHui3):  69,
		string(JianziHui4):  67,
		string(JianziHui5):  65,
		string(JianziHui6):  64,
		string(JianziHui7):  62,
		string(JianziHui8):  60,
		string(JianziHui9):  59,
		string(JianziHui10): 57,
		string(JianziHui11): 55,
		string(JianziHui12): 53,
		string(JianziHui13): 52,
	}

	midiNote, ok := jianziToMIDI[symbol.Value]
	if !ok {
		midiNote = 60
	}

	pitchNames := []string{"C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"}
	pitch := pitchNames[midiNote%12]
	octave := (midiNote / 12) - 1

	return models.Note{
		Pitch:     pitch,
		Octave:    octave,
		Duration:  1.0,
		StartTime: 0.0,
	}
}

func (r *Recognizer) GetSupportedTypes() []models.ScoreType {
	return []models.ScoreType{
		models.ScoreTypeGongche,
		models.ScoreTypeJianzi,
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

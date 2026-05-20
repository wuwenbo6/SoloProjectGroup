package algorithm

import (
	"fmt"
	"strings"
)

const (
	MatchScore      = 1
	MismatchScore  = -1
	GapPenalty     = -2
)

type AlignmentResult struct {
	SequenceA  string        `json:"sequence_a"`
	SequenceB  string        `json:"sequence_b"`
	AlignedA   string        `json:"aligned_a"`
	AlignedB   string        `json:"aligned_b"`
	Score      int           `json:"score"`
	Identity   float64       `json:"identity"`
}

func NeedlemanWunsch(a, b string) *AlignmentResult {
	matrix, _ := GetBuiltinMatrix(MatrixTypeDefault)
	return NeedlemanWunschWithMatrix(a, b, matrix)
}

func NeedlemanWunschWithMatrix(a, b string, matrix *ScoringMatrix) *AlignmentResult {
	m, n := len(a), len(b)
	
	if m > n {
		result := NeedlemanWunschWithMatrix(b, a, matrix)
		result.SequenceA, result.SequenceB = result.SequenceB, result.SequenceA
		result.AlignedA, result.AlignedB = result.AlignedB, result.AlignedA
		return result
	}
	
	gapPenalty := GapPenalty
	if matrix != nil {
		gapPenalty = matrix.GapPenalty
	}
	
	if m == 0 || n == 0 {
		return &AlignmentResult{
			SequenceA: a,
			SequenceB: b,
			AlignedA:  a + string(make([]byte, n)),
			AlignedB:  string(make([]byte, m)) + b,
			Score:     (m + n) * gapPenalty,
			Identity:  0,
		}
	}
	
	prev := make([]int, n+1)
	curr := make([]int, n+1)
	
	for j := 0; j <= n; j++ {
		prev[j] = j * gapPenalty
	}
	
	for i := 1; i <= m; i++ {
		curr[0] = i * gapPenalty
		for j := 1; j <= n; j++ {
			matchScore := scoreWithMatrix(a[i-1], b[j-1], matrix)
			match := prev[j-1] + matchScore
			deleteScore := prev[j] + gapPenalty
			insertScore := curr[j-1] + gapPenalty
			curr[j] = max(match, max(deleteScore, insertScore))
		}
		prev, curr = curr, prev
	}
	
	alignedA, alignedB := backtrackWithMatrix(a, b, matrix)
	
	identity := calculateIdentity(alignedA, alignedB)
	
	return &AlignmentResult{
		SequenceA: a,
		SequenceB: b,
		AlignedA:  alignedA,
		AlignedB:  alignedB,
		Score:      prev[n],
		Identity:   identity,
	}
}

func scoreWithMatrix(a, b byte, matrix *ScoringMatrix) int {
	if matrix == nil {
		return score(a, b)
	}
	return matrix.GetScore(a, b)
}

func backtrack(a, b string) (string, string) {
	return backtrackWithMatrix(a, b, nil)
}

func backtrackWithMatrix(a, b string, matrix *ScoringMatrix) (string, string) {
	m, n := len(a), len(b)
	
	gapPenalty := GapPenalty
	if matrix != nil {
		gapPenalty = matrix.GapPenalty
	}
	
	dp := make([][]int, m+1)
	for i := range dp {
		dp[i] = make([]int, n+1)
		dp[i][0] = i * gapPenalty
	}
	for j := 0; j <= n; j++ {
		dp[0][j] = j * gapPenalty
	}
	
	for i := 1; i <= m; i++ {
		for j := 1; j <= n; j++ {
			match := dp[i-1][j-1] + scoreWithMatrix(a[i-1], b[j-1], matrix)
			deleteScore := dp[i-1][j] + gapPenalty
			insertScore := dp[i][j-1] + gapPenalty
			dp[i][j] = max(match, max(deleteScore, insertScore))
		}
	}
	
	var alignedA, alignedB []byte
	i, j := m, n
	
	for i > 0 || j > 0 {
		if i > 0 && j > 0 && dp[i][j] == dp[i-1][j-1]+scoreWithMatrix(a[i-1], b[j-1], matrix) {
			alignedA = append(alignedA, a[i-1])
			alignedB = append(alignedB, b[j-1])
			i--
			j--
		} else if i > 0 && dp[i][j] == dp[i-1][j]+gapPenalty {
			alignedA = append(alignedA, a[i-1])
			alignedB = append(alignedB, '-')
			i--
		} else {
			alignedA = append(alignedA, '-')
			alignedB = append(alignedB, b[j-1])
			j--
		}
	}
	
	return reverseString(alignedA), reverseString(alignedB)
}

func score(a, b byte) int {
	if a == b {
		return MatchScore
	}
	return MismatchScore
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func reverseString(s []byte) string {
	for i, j := 0, len(s)-1; i < j; i, j = i+1, j-1 {
		s[i], s[j] = s[j], s[i]
	}
	return string(s)
}

func calculateIdentity(a, b string) float64 {
	if len(a) == 0 {
		return 0
	}
	matches := 0
	for i := range a {
		if a[i] == b[i] && a[i] != '-' {
			matches++
		}
	}
	return float64(matches) / float64(len(a))
}

func BatchAlign(sequences []string) []*AlignmentResult {
	return BatchAlignWithMatrix(sequences, nil)
}

func BatchAlignWithMatrix(sequences []string, matrix *ScoringMatrix) []*AlignmentResult {
	results := make([]*AlignmentResult, 0, len(sequences)*(len(sequences)-1)/2)
	
	for i := 0; i < len(sequences); i++ {
		for j := i + 1; j < len(sequences); j++ {
			var result *AlignmentResult
			if matrix != nil {
				result = NeedlemanWunschWithMatrix(sequences[i], sequences[j], matrix)
			} else {
				result = NeedlemanWunsch(sequences[i], sequences[j])
			}
			results = append(results, result)
		}
	}
	
	return results
}

func ParseFasta(data string) []string {
	var sequences []string
	var currentSequence []byte
	var inSequence bool
	
	lines := splitLines(data)
	
	for _, line := range lines {
		if len(line) == 0 {
			continue
		}
		if line[0] == '>' {
			if inSequence && len(currentSequence) > 0 {
				sequences = append(sequences, string(currentSequence))
				currentSequence = currentSequence[:0]
			}
			inSequence = true
			continue
		}
		if inSequence {
			currentSequence = append(currentSequence, []byte(line)...)
		}
	}
	
	if len(currentSequence) > 0 {
		sequences = append(sequences, string(currentSequence))
	}
	
	return sequences
}

func splitLines(s string) []string {
	var lines []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == '\n' {
			if i > start && s[i-1] == '\r' {
				lines = append(lines, s[start:i-1])
			} else {
				lines = append(lines, s[start:i])
			}
			start = i + 1
		}
	}
	if start < len(s) {
		lines = append(lines, s[start:])
	}
	return lines
}

func (r *AlignmentResult) GenerateHeatmap() string {
	var builder strings.Builder
	
	builder.WriteString("╔══════════════════════════════════════════════════════════════════╗\n")
	builder.WriteString("║                    SEQUENCE ALIGNMENT HEATMAP                    ║\n")
	builder.WriteString("╚══════════════════════════════════════════════════════════════════╝\n\n")
	
	stats := r.calculateStats()
	builder.WriteString(r.generateStatsBox(stats))
	builder.WriteString("\n")
	builder.WriteString(r.generateAlignmentView(stats))
	builder.WriteString("\n")
	builder.WriteString(r.generateMatrixHeatmap(stats))
	
	return builder.String()
}

func (r *AlignmentResult) calculateStats() map[string]int {
	stats := make(map[string]int)
	stats["matches"] = 0
	stats["mismatches"] = 0
	stats["gaps"] = 0
	stats["total"] = len(r.AlignedA)
	
	for i := 0; i < len(r.AlignedA) && i < len(r.AlignedB); i++ {
		a := r.AlignedA[i]
		b := r.AlignedB[i]
		
		if a == '-' || b == '-' {
			stats["gaps"]++
		} else if a == b {
			stats["matches"]++
		} else {
			stats["mismatches"]++
		}
	}
	
	return stats
}

func (r *AlignmentResult) generateStatsBox(stats map[string]int) string {
	var builder strings.Builder
	
	builder.WriteString("┌──────────────────────────────────────────────────────────────────┐\n")
	builder.WriteString("│                         ALIGNMENT STATISTICS                     │\n")
	builder.WriteString("├──────────────────────────────────────────────────────────────────┤\n")
	builder.WriteString(fmt.Sprintf("│  Score:    %5d                                                │\n", r.Score))
	builder.WriteString(fmt.Sprintf("│  Identity: %5.1f%%                                              │\n", r.Identity*100))
	builder.WriteString("├──────────────────────────────────────────────────────────────────┤\n")
	builder.WriteString(fmt.Sprintf("│  Matches:    %4d  ████████████████████████████████████         │\n", stats["matches"]))
	builder.WriteString(fmt.Sprintf("│  Mismatches: %4d  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░         │\n", stats["mismatches"]))
	builder.WriteString(fmt.Sprintf("│  Gaps:       %4d  ██▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒         │\n", stats["gaps"]))
	builder.WriteString(fmt.Sprintf("│  Length:     %4d                                                  │\n", stats["total"]))
	builder.WriteString("└──────────────────────────────────────────────────────────────────┘\n")
	
	return builder.String()
}

func (r *AlignmentResult) generateAlignmentView(stats map[string]int) string {
	var builder strings.Builder
	
	builder.WriteString("┌──────────────────────────────────────────────────────────────────┐\n")
	builder.WriteString("│                       ALIGNMENT VISUALIZATION                    │\n")
	builder.WriteString("├──────────────────────────────────────────────────────────────────┤\n")
	builder.WriteString("│  █ = Match  |  ░ = Mismatch  |  ▒ = Gap                         │\n")
	builder.WriteString("└──────────────────────────────────────────────────────────────────┘\n\n")
	
	maxLength := 80
	alignedLen := len(r.AlignedA)
	
	for start := 0; start < alignedLen; start += maxLength {
		end := start + maxLength
		if end > alignedLen {
			end = alignedLen
		}
		
		rangeInfo := fmt.Sprintf("Positions %d-%d", start+1, end)
		builder.WriteString(fmt.Sprintf("%s\n", rangeInfo))
		builder.WriteString(strings.Repeat("─", len(rangeInfo)) + "\n")
		
		builder.WriteString("Seq A:  ")
		for i := start; i < end; i++ {
			if i < len(r.AlignedA) {
				builder.WriteByte(r.AlignedA[i])
			}
		}
		builder.WriteString("\n")
		
		builder.WriteString("        ")
		for i := start; i < end; i++ {
			if i >= len(r.AlignedA) || i >= len(r.AlignedB) {
				builder.WriteString(" ")
			} else if r.AlignedA[i] == '-' || r.AlignedB[i] == '-' {
				builder.WriteString("▒")
			} else if r.AlignedA[i] == r.AlignedB[i] {
				builder.WriteString("█")
			} else {
				builder.WriteString("░")
			}
		}
		builder.WriteString("\n")
		
		builder.WriteString("Seq B:  ")
		for i := start; i < end; i++ {
			if i < len(r.AlignedB) {
				builder.WriteByte(r.AlignedB[i])
			}
		}
		builder.WriteString("\n\n")
	}
	
	return builder.String()
}

func (r *AlignmentResult) generateMatrixHeatmap(stats map[string]int) string {
	var builder strings.Builder
	
	builder.WriteString("┌──────────────────────────────────────────────────────────────────┐\n")
	builder.WriteString("│                    SIMILARITY MATRIX HEATMAP                     │\n")
	builder.WriteString("└──────────────────────────────────────────────────────────────────┘\n\n")
	
	windowSize := 10
	seqA := strings.ReplaceAll(r.AlignedA, "-", "")
	seqB := strings.ReplaceAll(r.AlignedB, "-", "")
	
	if len(seqA) > 50 {
		seqA = seqA[:50]
	}
	if len(seqB) > 50 {
		seqB = seqB[:50]
	}
	
	builder.WriteString("      ")
	for j := 0; j < len(seqB) && j < 50; j += 5 {
		builder.WriteString(fmt.Sprintf("%-5d", j+1))
	}
	builder.WriteString("\n")
	
	builder.WriteString("   ┌" + strings.Repeat("────", min(50, len(seqB))/5) + "┐\n")
	
	for i := 0; i < len(seqA) && i < 50; i++ {
		builder.WriteString(fmt.Sprintf("%3d│", i+1))
		
		for j := 0; j < len(seqB) && j < 50; j++ {
			a := seqA[i]
			b := seqB[j]
			
			if a == b {
				builder.WriteString("█")
			} else if (a == 'A' && b == 'T') || (a == 'T' && b == 'A') ||
				(a == 'G' && b == 'C') || (a == 'C' && b == 'G') {
				builder.WriteString("▓")
			} else {
				builder.WriteString("░")
			}
			
			if (j+1)%5 == 0 {
				builder.WriteString("│")
			}
		}
		
		builder.WriteString("\n")
		
		if (i+1)%5 == 0 && i < len(seqA)-1 {
			builder.WriteString("   ├" + strings.Repeat("────", min(50, len(seqB))/5) + "┤\n")
		}
	}
	
	builder.WriteString("   └" + strings.Repeat("────", min(50, len(seqB))/5) + "┘\n")
	
	builder.WriteString("\nLegend: █=Match  ▓=Compl(A-T|G-C)  ░=Mismatch\n")
	
	return builder.String()
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func GenerateBatchHeatmap(results []*AlignmentResult, taskID string) string {
	var builder strings.Builder
	
	builder.WriteString("╔══════════════════════════════════════════════════════════════════╗\n")
	builder.WriteString("║                  BATCH SEQUENCE ALIGNMENT REPORT                 ║\n")
	builder.WriteString(fmt.Sprintf("║  Task ID: %-53s  ║\n", taskID))
	builder.WriteString("╚══════════════════════════════════════════════════════════════════╝\n\n")
	
	if len(results) == 0 {
		builder.WriteString("No alignment results found.\n")
		return builder.String()
	}
	
	builder.WriteString("┌──────────────────────────────────────────────────────────────────┐\n")
	builder.WriteString("│                        PAIRWISE ALIGNMENTS                        │\n")
	builder.WriteString("├─────────────┬──────────┬──────────┬────────────┬────────────────┤\n")
	builder.WriteString("│  Pair #     │  Score   │  Identity│  Matches   │   Status       │\n")
	builder.WriteString("├─────────────┼──────────┼──────────┼────────────┼────────────────┤\n")
	
	for i, result := range results {
		status := getStatusBar(result.Identity)
		stats := result.calculateStats()
		builder.WriteString(fmt.Sprintf("│  %-11d│  %-8d│  %6.1f%% │  %-10d│  %s  │\n",
			i+1, result.Score, result.Identity*100, stats["matches"], status))
	}
	
	builder.WriteString("└─────────────┴──────────┴──────────┴────────────┴────────────────┘\n\n")
	
	bestIdx := 0
	bestScore := results[0].Score
	for i, result := range results {
		if result.Score > bestScore {
			bestScore = result.Score
			bestIdx = i
		}
	}
	
	builder.WriteString("╔══════════════════════════════════════════════════════════════════╗\n")
	builder.WriteString("║                      BEST ALIGNMENT DETAILS                      ║\n")
	builder.WriteString(fmt.Sprintf("║                       Pair #%d                                   ║\n", bestIdx+1))
	builder.WriteString("╚══════════════════════════════════════════════════════════════════╝\n\n")
	
	builder.WriteString(results[bestIdx].GenerateHeatmap())
	
	return builder.String()
}

func getStatusBar(identity float64) string {
	barWidth := 10
	filled := int(identity * float64(barWidth))
	
	bar := ""
	for i := 0; i < filled; i++ {
		bar += "█"
	}
	for i := filled; i < barWidth; i++ {
		bar += "░"
	}
	
	return bar
}

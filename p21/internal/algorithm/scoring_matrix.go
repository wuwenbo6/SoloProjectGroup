package algorithm

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

type MatrixType string

const (
	MatrixTypeDefault  MatrixType = "default"
	MatrixTypeBLOSUM62 MatrixType = "blosum62"
	MatrixTypePAM250   MatrixType = "pam250"
	MatrixTypeCustom   MatrixType = "custom"
)

type ScoringConfig struct {
	MatrixType MatrixType         `json:"matrix_type"`
	MatrixURL  string             `json:"matrix_url,omitempty"`
	MatrixData *ScoringMatrix     `json:"matrix_data,omitempty"`
	GapOpen    int                `json:"gap_open"`
	GapExtend  int                `json:"gap_extend"`
}

type ScoringMatrix struct {
	Name      string             `json:"name"`
	Order     []byte             `json:"order"`
	Matrix    map[byte]map[byte]int `json:"matrix"`
	GapPenalty int               `json:"gap_penalty"`
}

var (
	matrixCache = make(map[string]*ScoringMatrix)
	cacheMutex  sync.RWMutex
	httpClient  = &http.Client{Timeout: 30 * time.Second}
)

func GetBuiltinMatrix(matrixType MatrixType) (*ScoringMatrix, error) {
	cacheMutex.RLock()
	if m, ok := matrixCache[string(matrixType)]; ok {
		cacheMutex.RUnlock()
		return m, nil
	}
	cacheMutex.RUnlock()

	var matrix *ScoringMatrix
	var err error

	switch matrixType {
	case MatrixTypeBLOSUM62:
		matrix = buildBLOSUM62()
	case MatrixTypePAM250:
		matrix = buildPAM250()
	case MatrixTypeDefault:
		matrix = buildDefaultMatrix()
	default:
		err = fmt.Errorf("unknown matrix type: %s", matrixType)
	}

	if err == nil && matrix != nil {
		cacheMutex.Lock()
		matrixCache[string(matrixType)] = matrix
		cacheMutex.Unlock()
	}

	return matrix, err
}

func LoadMatrixFromURL(url string) (*ScoringMatrix, error) {
	cacheMutex.RLock()
	if m, ok := matrixCache[url]; ok {
		cacheMutex.RUnlock()
		return m, nil
	}
	cacheMutex.RUnlock()

	resp, err := httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch matrix: %w", err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read matrix data: %w", err)
	}

	var matrix *ScoringMatrix
	contentType := resp.Header.Get("Content-Type")

	if strings.Contains(contentType, "application/json") || strings.HasSuffix(url, ".json") {
		matrix, err = parseJSONMatrix(data)
	} else {
		matrix, err = parseTextMatrix(data)
	}

	if err != nil {
		return nil, err
	}

	cacheMutex.Lock()
	matrixCache[url] = matrix
	cacheMutex.Unlock()

	return matrix, nil
}

func parseJSONMatrix(data []byte) (*ScoringMatrix, error) {
	var matrix ScoringMatrix
	if err := json.Unmarshal(data, &matrix); err != nil {
		return nil, err
	}
	return &matrix, nil
}

func parseTextMatrix(data []byte) (*ScoringMatrix, error) {
	scanner := bufio.NewScanner(strings.NewReader(string(data)))
	var lines []string

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		lines = append(lines, line)
	}

	if len(lines) < 2 {
		return nil, fmt.Errorf("invalid matrix format: too few lines")
	}

	header := strings.Fields(lines[0])
	order := make([]byte, len(header))
	for i, aa := range header {
		if len(aa) > 0 {
			order[i] = strings.ToUpper(aa)[0]
		}
	}

	matrix := make(map[byte]map[byte]int)
	for i := 0; i < len(order); i++ {
		matrix[order[i]] = make(map[byte]int)
	}

	for lineIdx := 1; lineIdx < len(lines); lineIdx++ {
		fields := strings.Fields(lines[lineIdx])
		if len(fields) != len(order)+1 {
			continue
		}

		rowAA := strings.ToUpper(fields[0])[0]
		for colIdx := 0; colIdx < len(order); colIdx++ {
			score, err := strconv.Atoi(fields[colIdx+1])
			if err != nil {
				continue
			}
			matrix[rowAA][order[colIdx]] = score
		}
	}

	return &ScoringMatrix{
		Name:   "custom",
		Order:  order,
		Matrix: matrix,
	}, nil
}

func buildDefaultMatrix() *ScoringMatrix {
	aas := []byte{'A', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'K', 'L', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'V', 'W', 'Y'}
	matrix := make(map[byte]map[byte]int)

	for _, a := range aas {
		matrix[a] = make(map[byte]int)
		for _, b := range aas {
			if a == b {
				matrix[a][b] = MatchScore
			} else {
				matrix[a][b] = MismatchScore
			}
		}
	}

	return &ScoringMatrix{
		Name:       "default",
		Order:      aas,
		Matrix:     matrix,
		GapPenalty: GapPenalty,
	}
}

func buildBLOSUM62() *ScoringMatrix {
	aas := []byte{'A', 'R', 'N', 'D', 'C', 'Q', 'E', 'G', 'H', 'I', 'L', 'K', 'M', 'F', 'P', 'S', 'T', 'W', 'Y', 'V', 'B', 'Z', 'X', '*'}
	blosum62 := map[byte]map[byte]int{
		'A': {'A': 4, 'R': -1, 'N': -2, 'D': -2, 'C': 0, 'Q': -1, 'E': -1, 'G': 0, 'H': -2, 'I': -1, 'L': -1, 'K': -1, 'M': -1, 'F': -2, 'P': -1, 'S': 1, 'T': 0, 'W': -3, 'Y': -2, 'V': 0, 'B': -2, 'Z': -1, 'X': 0, '*': -4},
		'R': {'A': -1, 'R': 5, 'N': 0, 'D': -2, 'C': -3, 'Q': 1, 'E': 0, 'G': -2, 'H': 0, 'I': -3, 'L': -2, 'K': 2, 'M': -1, 'F': -3, 'P': -2, 'S': -1, 'T': -1, 'W': -3, 'Y': -2, 'V': -3, 'B': -1, 'Z': 0, 'X': -1, '*': -4},
		'N': {'A': -2, 'R': 0, 'N': 6, 'D': 1, 'C': -3, 'Q': 0, 'E': 0, 'G': 0, 'H': 1, 'I': -3, 'L': -3, 'K': 0, 'M': -2, 'F': -3, 'P': -2, 'S': 1, 'T': 0, 'W': -4, 'Y': -2, 'V': -3, 'B': 3, 'Z': 0, 'X': -1, '*': -4},
		'D': {'A': -2, 'R': -2, 'N': 1, 'D': 6, 'C': -3, 'Q': 0, 'E': 2, 'G': -1, 'H': -1, 'I': -3, 'L': -4, 'K': -1, 'M': -3, 'F': -3, 'P': -1, 'S': 0, 'T': -1, 'W': -4, 'Y': -3, 'V': -3, 'B': 4, 'Z': 1, 'X': -1, '*': -4},
		'C': {'A': 0, 'R': -3, 'N': -3, 'D': -3, 'C': 9, 'Q': -3, 'E': -4, 'G': -3, 'H': -3, 'I': -1, 'L': -1, 'K': -3, 'M': -1, 'F': -2, 'P': -3, 'S': -1, 'T': -1, 'W': -2, 'Y': -2, 'V': -1, 'B': -3, 'Z': -3, 'X': -2, '*': -4},
		'Q': {'A': -1, 'R': 1, 'N': 0, 'D': 0, 'C': -3, 'Q': 5, 'E': 2, 'G': -2, 'H': 0, 'I': -3, 'L': -2, 'K': 1, 'M': 0, 'F': -3, 'P': -1, 'S': 0, 'T': -1, 'W': -2, 'Y': -1, 'V': -2, 'B': 0, 'Z': 3, 'X': -1, '*': -4},
		'E': {'A': -1, 'R': 0, 'N': 0, 'D': 2, 'C': -4, 'Q': 2, 'E': 5, 'G': -2, 'H': 0, 'I': -3, 'L': -3, 'K': 1, 'M': -2, 'F': -3, 'P': -1, 'S': 0, 'T': -1, 'W': -3, 'Y': -2, 'V': -2, 'B': 1, 'Z': 4, 'X': -1, '*': -4},
		'G': {'A': 0, 'R': -2, 'N': 0, 'D': -1, 'C': -3, 'Q': -2, 'E': -2, 'G': 6, 'H': -2, 'I': -4, 'L': -4, 'K': -2, 'M': -3, 'F': -3, 'P': -2, 'S': 0, 'T': -2, 'W': -2, 'Y': -3, 'V': -3, 'B': -1, 'Z': -2, 'X': -1, '*': -4},
		'H': {'A': -2, 'R': 0, 'N': 1, 'D': -1, 'C': -3, 'Q': 0, 'E': 0, 'G': -2, 'H': 8, 'I': -3, 'L': -3, 'K': -1, 'M': -2, 'F': -1, 'P': -2, 'S': -1, 'T': -2, 'W': -2, 'Y': 2, 'V': -3, 'B': 0, 'Z': 0, 'X': -1, '*': -4},
		'I': {'A': -1, 'R': -3, 'N': -3, 'D': -3, 'C': -1, 'Q': -3, 'E': -3, 'G': -4, 'H': -3, 'I': 4, 'L': 2, 'K': -3, 'M': 1, 'F': 0, 'P': -3, 'S': -2, 'T': -1, 'W': -3, 'Y': -1, 'V': 3, 'B': -3, 'Z': -3, 'X': -1, '*': -4},
		'L': {'A': -1, 'R': -2, 'N': -3, 'D': -4, 'C': -1, 'Q': -2, 'E': -3, 'G': -4, 'H': -3, 'I': 2, 'L': 4, 'K': -2, 'M': 2, 'F': 0, 'P': -3, 'S': -2, 'T': -1, 'W': -2, 'Y': -1, 'V': 1, 'B': -4, 'Z': -3, 'X': -1, '*': -4},
		'K': {'A': -1, 'R': 2, 'N': 0, 'D': -1, 'C': -3, 'Q': 1, 'E': 1, 'G': -2, 'H': -1, 'I': -3, 'L': -2, 'K': 5, 'M': -1, 'F': -3, 'P': -1, 'S': 0, 'T': -1, 'W': -3, 'Y': -2, 'V': -2, 'B': 0, 'Z': 1, 'X': -1, '*': -4},
		'M': {'A': -1, 'R': -1, 'N': -2, 'D': -3, 'C': -1, 'Q': 0, 'E': -2, 'G': -3, 'H': -2, 'I': 1, 'L': 2, 'K': -1, 'M': 5, 'F': 0, 'P': -2, 'S': -1, 'T': -1, 'W': -1, 'Y': -1, 'V': 1, 'B': -3, 'Z': -1, 'X': -1, '*': -4},
		'F': {'A': -2, 'R': -3, 'N': -3, 'D': -3, 'C': -2, 'Q': -3, 'E': -3, 'G': -3, 'H': -1, 'I': 0, 'L': 0, 'K': -3, 'M': 0, 'F': 6, 'P': -4, 'S': -2, 'T': -2, 'W': 1, 'Y': 3, 'V': -1, 'B': -3, 'Z': -3, 'X': -1, '*': -4},
		'P': {'A': -1, 'R': -2, 'N': -2, 'D': -1, 'C': -3, 'Q': -1, 'E': -1, 'G': -2, 'H': -2, 'I': -3, 'L': -3, 'K': -1, 'M': -2, 'F': -4, 'P': 7, 'S': -1, 'T': -1, 'W': -4, 'Y': -3, 'V': -2, 'B': -2, 'Z': -1, 'X': -2, '*': -4},
		'S': {'A': 1, 'R': -1, 'N': 1, 'D': 0, 'C': -1, 'Q': 0, 'E': 0, 'G': 0, 'H': -1, 'I': -2, 'L': -2, 'K': 0, 'M': -1, 'F': -2, 'P': -1, 'S': 4, 'T': 1, 'W': -3, 'Y': -2, 'V': -2, 'B': 0, 'Z': 0, 'X': 0, '*': -4},
		'T': {'A': 0, 'R': -1, 'N': 0, 'D': -1, 'C': -1, 'Q': -1, 'E': -1, 'G': -2, 'H': -2, 'I': -1, 'L': -1, 'K': -1, 'M': -1, 'F': -2, 'P': -1, 'S': 1, 'T': 5, 'W': -2, 'Y': -2, 'V': 0, 'B': -1, 'Z': -1, 'X': 0, '*': -4},
		'W': {'A': -3, 'R': -3, 'N': -4, 'D': -4, 'C': -2, 'Q': -2, 'E': -3, 'G': -2, 'H': -2, 'I': -3, 'L': -2, 'K': -3, 'M': -1, 'F': 1, 'P': -4, 'S': -3, 'T': -2, 'W': 11, 'Y': 2, 'V': -3, 'B': -4, 'Z': -2, 'X': -2, '*': -4},
		'Y': {'A': -2, 'R': -2, 'N': -2, 'D': -3, 'C': -2, 'Q': -1, 'E': -2, 'G': -3, 'H': 2, 'I': -1, 'L': -1, 'K': -2, 'M': -1, 'F': 3, 'P': -3, 'S': -2, 'T': -2, 'W': 2, 'Y': 7, 'V': -1, 'B': -3, 'Z': -2, 'X': -1, '*': -4},
		'V': {'A': 0, 'R': -3, 'N': -3, 'D': -3, 'C': -1, 'Q': -2, 'E': -2, 'G': -3, 'H': -3, 'I': 3, 'L': 1, 'K': -2, 'M': 1, 'F': -1, 'P': -2, 'S': -2, 'T': 0, 'W': -3, 'Y': -1, 'V': 4, 'B': -3, 'Z': -2, 'X': -1, '*': -4},
		'B': {'A': -2, 'R': -1, 'N': 3, 'D': 4, 'C': -3, 'Q': 0, 'E': 1, 'G': -1, 'H': 0, 'I': -3, 'L': -4, 'K': 0, 'M': -3, 'F': -3, 'P': -2, 'S': 0, 'T': -1, 'W': -4, 'Y': -3, 'V': -3, 'B': 4, 'Z': 1, 'X': -1, '*': -4},
		'Z': {'A': -1, 'R': 0, 'N': 0, 'D': 1, 'C': -3, 'Q': 3, 'E': 4, 'G': -2, 'H': 0, 'I': -3, 'L': -3, 'K': 1, 'M': -1, 'F': -3, 'P': -1, 'S': 0, 'T': -1, 'W': -2, 'Y': -2, 'V': -2, 'B': 1, 'Z': 4, 'X': -1, '*': -4},
		'X': {'A': 0, 'R': -1, 'N': -1, 'D': -1, 'C': -2, 'Q': -1, 'E': -1, 'G': -1, 'H': -1, 'I': -1, 'L': -1, 'K': -1, 'M': -1, 'F': -1, 'P': -2, 'S': 0, 'T': 0, 'W': -2, 'Y': -1, 'V': -1, 'B': -1, 'Z': -1, 'X': -1, '*': -4},
		'*': {'A': -4, 'R': -4, 'N': -4, 'D': -4, 'C': -4, 'Q': -4, 'E': -4, 'G': -4, 'H': -4, 'I': -4, 'L': -4, 'K': -4, 'M': -4, 'F': -4, 'P': -4, 'S': -4, 'T': -4, 'W': -4, 'Y': -4, 'V': -4, 'B': -4, 'Z': -4, 'X': -4, '*': 1},
	}

	return &ScoringMatrix{
		Name:       "BLOSUM62",
		Order:      aas,
		Matrix:     blosum62,
		GapPenalty: -1,
	}
}

func buildPAM250() *ScoringMatrix {
	aas := []byte{'A', 'R', 'N', 'D', 'C', 'Q', 'E', 'G', 'H', 'I', 'L', 'K', 'M', 'F', 'P', 'S', 'T', 'W', 'Y', 'V'}
	pam250 := map[byte]map[byte]int{
		'A': {'A': 2, 'R': -2, 'N': 0, 'D': 0, 'C': -2, 'Q': 0, 'E': 0, 'G': 1, 'H': -1, 'I': -1, 'L': -2, 'K': -1, 'M': -1, 'F': -3, 'P': 1, 'S': 1, 'T': 1, 'W': -6, 'Y': -3, 'V': 0},
		'R': {'A': -2, 'R': 6, 'N': 0, 'D': -1, 'C': -4, 'Q': 1, 'E': -1, 'G': -3, 'H': 2, 'I': -2, 'L': -3, 'K': 3, 'M': 0, 'F': -4, 'P': 0, 'S': 0, 'T': -1, 'W': 2, 'Y': -4, 'V': -2},
		'N': {'A': 0, 'R': 0, 'N': 2, 'D': 2, 'C': -4, 'Q': 1, 'E': 1, 'G': 0, 'H': 2, 'I': -2, 'L': -3, 'K': 1, 'M': -2, 'F': -3, 'P': 0, 'S': 1, 'T': 0, 'W': -4, 'Y': -2, 'V': -2},
		'D': {'A': 0, 'R': -1, 'N': 2, 'D': 4, 'C': -5, 'Q': 2, 'E': 3, 'G': 1, 'H': 1, 'I': -2, 'L': -4, 'K': 0, 'M': -3, 'F': -5, 'P': -1, 'S': 0, 'T': 0, 'W': -7, 'Y': -4, 'V': -2},
		'C': {'A': -2, 'R': -4, 'N': -4, 'D': -5, 'C': 12, 'Q': -5, 'E': -5, 'G': -3, 'H': -3, 'I': -2, 'L': -6, 'K': -5, 'M': -5, 'F': -4, 'P': -3, 'S': 0, 'T': -2, 'W': -8, 'Y': 0, 'V': -2},
		'Q': {'A': 0, 'R': 1, 'N': 1, 'D': 2, 'C': -5, 'Q': 4, 'E': 2, 'G': -1, 'H': 3, 'I': -2, 'L': -2, 'K': 1, 'M': -1, 'F': -5, 'P': 0, 'S': -1, 'T': -1, 'W': -5, 'Y': -4, 'V': -2},
		'E': {'A': 0, 'R': -1, 'N': 1, 'D': 3, 'C': -5, 'Q': 2, 'E': 4, 'G': 0, 'H': 1, 'I': -2, 'L': -3, 'K': 0, 'M': -2, 'F': -5, 'P': -1, 'S': 0, 'T': 0, 'W': -7, 'Y': -4, 'V': -2},
		'G': {'A': 1, 'R': -3, 'N': 0, 'D': 1, 'C': -3, 'Q': -1, 'E': 0, 'G': 5, 'H': -2, 'I': -3, 'L': -4, 'K': -2, 'M': -3, 'F': -5, 'P': 0, 'S': 1, 'T': 0, 'W': -7, 'Y': -5, 'V': -1},
		'H': {'A': -1, 'R': 2, 'N': 2, 'D': 1, 'C': -3, 'Q': 3, 'E': 1, 'G': -2, 'H': 6, 'I': -2, 'L': -2, 'K': 0, 'M': -2, 'F': 0, 'P': 0, 'S': -1, 'T': -1, 'W': -3, 'Y': 0, 'V': -2},
		'I': {'A': -1, 'R': -2, 'N': -2, 'D': -2, 'C': -2, 'Q': -2, 'E': -2, 'G': -3, 'H': -2, 'I': 5, 'L': 2, 'K': -2, 'M': 2, 'F': 1, 'P': -2, 'S': -1, 'T': 0, 'W': -5, 'Y': -1, 'V': 4},
		'L': {'A': -2, 'R': -3, 'N': -3, 'D': -4, 'C': -6, 'Q': -2, 'E': -3, 'G': -4, 'H': -2, 'I': 2, 'L': 6, 'K': -3, 'M': 4, 'F': 2, 'P': -3, 'S': -3, 'T': -2, 'W': -2, 'Y': -1, 'V': 2},
		'K': {'A': -1, 'R': 3, 'N': 1, 'D': 0, 'C': -5, 'Q': 1, 'E': 0, 'G': -2, 'H': 0, 'I': -2, 'L': -3, 'K': 5, 'M': 0, 'F': -5, 'P': -1, 'S': 0, 'T': 0, 'W': -3, 'Y': -4, 'V': -2},
		'M': {'A': -1, 'R': 0, 'N': -2, 'D': -3, 'C': -5, 'Q': -1, 'E': -2, 'G': -3, 'H': -2, 'I': 2, 'L': 4, 'K': 0, 'M': 6, 'F': 0, 'P': -2, 'S': -2, 'T': -1, 'W': -4, 'Y': -2, 'V': 2},
		'F': {'A': -3, 'R': -4, 'N': -3, 'D': -5, 'C': -4, 'Q': -5, 'E': -5, 'G': -5, 'H': 0, 'I': 1, 'L': 2, 'K': -5, 'M': 0, 'F': 9, 'P': -5, 'S': -3, 'T': -3, 'W': 0, 'Y': 7, 'V': -1},
		'P': {'A': 1, 'R': 0, 'N': 0, 'D': -1, 'C': -3, 'Q': 0, 'E': -1, 'G': 0, 'H': 0, 'I': -2, 'L': -3, 'K': -1, 'M': -2, 'F': -5, 'P': 6, 'S': 1, 'T': 0, 'W': -6, 'Y': -5, 'V': -1},
		'S': {'A': 1, 'R': 0, 'N': 1, 'D': 0, 'C': 0, 'Q': -1, 'E': 0, 'G': 1, 'H': -1, 'I': -1, 'L': -3, 'K': 0, 'M': -2, 'F': -3, 'P': 1, 'S': 2, 'T': 1, 'W': -2, 'Y': -3, 'V': -1},
		'T': {'A': 1, 'R': -1, 'N': 0, 'D': 0, 'C': -2, 'Q': -1, 'E': 0, 'G': 0, 'H': -1, 'I': 0, 'L': -2, 'K': 0, 'M': -1, 'F': -3, 'P': 0, 'S': 1, 'T': 3, 'W': -5, 'Y': -3, 'V': 0},
		'W': {'A': -6, 'R': 2, 'N': -4, 'D': -7, 'C': -8, 'Q': -5, 'E': -7, 'G': -7, 'H': -3, 'I': -5, 'L': -2, 'K': -3, 'M': -4, 'F': 0, 'P': -6, 'S': -2, 'T': -5, 'W': 17, 'Y': 0, 'V': -6},
		'Y': {'A': -3, 'R': -4, 'N': -2, 'D': -4, 'C': 0, 'Q': -4, 'E': -4, 'G': -5, 'H': 0, 'I': -1, 'L': -1, 'K': -4, 'M': -2, 'F': 7, 'P': -5, 'S': -3, 'T': -3, 'W': 0, 'Y': 10, 'V': -2},
		'V': {'A': 0, 'R': -2, 'N': -2, 'D': -2, 'C': -2, 'Q': -2, 'E': -2, 'G': -1, 'H': -2, 'I': 4, 'L': 2, 'K': -2, 'M': 2, 'F': -1, 'P': -1, 'S': -1, 'T': 0, 'W': -6, 'Y': -2, 'V': 4},
	}

	return &ScoringMatrix{
		Name:       "PAM250",
		Order:      aas,
		Matrix:     pam250,
		GapPenalty: -2,
	}
}

func (m *ScoringMatrix) GetScore(a, b byte) int {
	aUpper := toUpper(a)
	bUpper := toUpper(b)

	if row, ok := m.Matrix[aUpper]; ok {
		if score, ok := row[bUpper]; ok {
			return score
		}
	}

	if aUpper == bUpper {
		return 1
	}
	return -1
}

func toUpper(c byte) byte {
	if c >= 'a' && c <= 'z' {
		return c - 32
	}
	return c
}

func GetAvailableMatrices() []string {
	return []string{
		string(MatrixTypeDefault),
		string(MatrixTypeBLOSUM62),
		string(MatrixTypePAM250),
		"custom (URL)",
	}
}

func ClearMatrixCache() {
	cacheMutex.Lock()
	defer cacheMutex.Unlock()
	matrixCache = make(map[string]*ScoringMatrix)
}

package storage

import (
	"bufio"
	"bytes"
	"container/heap"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/genomics/alignment/pkg/models"
	"github.com/genomics/alignment/pkg/utils"
)

const (
	ChunkSize = 100 * 1024 * 1024 
)

type Storage struct {
	basePath string
	mu       sync.RWMutex
}

func NewStorage(basePath string) *Storage {
	utils.EnsureDir(basePath)
	return &Storage{
		basePath: basePath,
	}
}

func (s *Storage) SaveFile(taskID string, data []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	taskPath := filepath.Join(s.basePath, taskID)
	utils.EnsureDir(taskPath)

	filePath := filepath.Join(taskPath, "input.fasta")
	return os.WriteFile(filePath, data, 0644)
}

func (s *Storage) AppendChunk(taskID string, chunkIndex int64, data []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	taskPath := filepath.Join(s.basePath, taskID)
	utils.EnsureDir(taskPath)

	filePath := filepath.Join(taskPath, "input.fasta")
	
	flag := os.O_CREATE | os.O_WRONLY
	if chunkIndex > 0 {
		flag |= os.O_APPEND
	}

	f, err := os.OpenFile(filePath, flag, 0644)
	if err != nil {
		return err
	}
	defer f.Close()

	_, err = f.Write(data)
	return err
}

func (s *Storage) GetFile(taskID string) ([]byte, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	filePath := filepath.Join(s.basePath, taskID, "input.fasta")
	return os.ReadFile(filePath)
}

func (s *Storage) SplitIntoChunks(taskID string, sequences []string, scoringConfig *models.ScoringConfig) ([]*models.ChunkTask, error) {
	var chunks []*models.ChunkTask
	var currentSequences []string
	var currentSize int

	for i, seq := range sequences {
		seqSize := len(seq)
		
		if currentSize+seqSize > ChunkSize && len(currentSequences) > 0 {
			chunks = append(chunks, &models.ChunkTask{
				TaskID:       taskID,
				ChunkID:      len(chunks),
				Sequences:    currentSequences,
				ScoringConfig: scoringConfig,
			})
			currentSequences = []string{seq}
			currentSize = seqSize
		} else {
			currentSequences = append(currentSequences, seq)
			currentSize += seqSize
		}

		if i == len(sequences)-1 && len(currentSequences) > 0 {
			chunks = append(chunks, &models.ChunkTask{
				TaskID:       taskID,
				ChunkID:      len(chunks),
				Sequences:    currentSequences,
				ScoringConfig: scoringConfig,
			})
		}
	}

	return chunks, nil
}

func (s *Storage) ReadFastaSequences(taskID string) ([]string, error) {
	data, err := s.GetFile(taskID)
	if err != nil {
		return nil, err
	}

	var sequences []string
	var currentSequence []byte
	var inSequence bool

	scanner := bufio.NewScanner(bytes.NewReader(data))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
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

	return sequences, scanner.Err()
}

func (s *Storage) SaveResult(taskID string, result *models.TaskResult) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	taskPath := filepath.Join(s.basePath, taskID)
	utils.EnsureDir(taskPath)

	resultPath := filepath.Join(taskPath, "result.json")
	data := utils.ToJSON(result)
	return os.WriteFile(resultPath, []byte(data), 0644)
}

func (s *Storage) GetResult(taskID string) (*models.TaskResult, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	resultPath := filepath.Join(s.basePath, taskID, "result.json")
	data, err := os.ReadFile(resultPath)
	if err != nil {
		return nil, err
	}

	var result models.TaskResult
	if err := utils.FromJSON(string(data), &result); err != nil {
		return nil, err
	}

	return &result, nil
}

func (s *Storage) DeleteTask(taskID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	taskPath := filepath.Join(s.basePath, taskID)
	return os.RemoveAll(taskPath)
}

type resultItem struct {
	Result  models.AlignmentResult
	ReaderIndex int
}

type resultHeap []resultItem

func (h resultHeap) Len() int           { return len(h) }
func (h resultHeap) Less(i, j int) bool { return h[i].Result.Score > h[j].Result.Score }
func (h resultHeap) Swap(i, j int)      { h[i], h[j] = h[j], h[i] }

func (h *resultHeap) Push(x interface{}) {
	*h = append(*h, x.(resultItem))
}

func (h *resultHeap) Pop() interface{} {
	old := *h
	n := len(old)
	x := old[n-1]
	*h = old[:n-1]
	return x
}

type chunkFileReader struct {
	scanner *bufio.Scanner
	file    *os.File
}

func (s *Storage) SaveChunkTempFile(taskID string, chunkID int, results []models.AlignmentResult) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	taskPath := filepath.Join(s.basePath, taskID, "temp")
	utils.EnsureDir(taskPath)

	sort.Slice(results, func(i, j int) bool {
		return results[i].Score > results[j].Score
	})

	filePath := filepath.Join(taskPath, fmt.Sprintf("chunk_%d.jsonl", chunkID))
	file, err := os.Create(filePath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	writer := bufio.NewWriter(file)
	for _, result := range results {
		data, err := json.Marshal(result)
		if err != nil {
			return "", err
		}
		if _, err := writer.Write(data); err != nil {
			return "", err
		}
		if err := writer.WriteByte('\n'); err != nil {
			return "", err
		}
	}

	if err := writer.Flush(); err != nil {
		return "", err
	}

	return filePath, nil
}

func (s *Storage) MergeSortedChunks(taskID string, totalChunks int, outputLimit int) (*models.TaskResult, error) {
	s.mu.RLock()

	taskPath := filepath.Join(s.basePath, taskID, "temp")
	var readers []chunkFileReader
	var tempFiles []string

	defer func() {
		for _, r := range readers {
			r.file.Close()
		}
		s.mu.RUnlock()
	}()

	for i := 0; i < totalChunks; i++ {
		filePath := filepath.Join(taskPath, fmt.Sprintf("chunk_%d.jsonl", i))
		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			continue
		}

		file, err := os.Open(filePath)
		if err != nil {
			return nil, err
		}
		tempFiles = append(tempFiles, filePath)

		scanner := bufio.NewScanner(file)
		scanner.Buffer(make([]byte, 1024*1024), 10*1024*1024)
		readers = append(readers, chunkFileReader{scanner: scanner, file: file})
	}

	if len(readers) == 0 {
		return &models.TaskResult{
			TaskID:    taskID,
			Results:   []models.AlignmentResult{},
			CreatedAt: time.Now(),
		}, nil
	}

	h := &resultHeap{}
	heap.Init(h)

	for i, reader := range readers {
		if reader.scanner.Scan() {
			var result models.AlignmentResult
			if err := json.Unmarshal(reader.scanner.Bytes(), &result); err != nil {
				continue
			}
			heap.Push(h, resultItem{Result: result, ReaderIndex: i})
		}
	}

	var mergedResults []models.AlignmentResult
	bufferSize := 1000

	for h.Len() > 0 {
		item := heap.Pop(h).(resultItem)
		mergedResults = append(mergedResults, item.Result)

		if outputLimit > 0 && len(mergedResults) >= outputLimit {
			break
		}

		if readers[item.ReaderIndex].scanner.Scan() {
			var result models.AlignmentResult
			if err := json.Unmarshal(readers[item.ReaderIndex].scanner.Bytes(), &result); err != nil {
				continue
			}
			heap.Push(h, resultItem{Result: result, ReaderIndex: item.ReaderIndex})
		}
	}

	return &models.TaskResult{
		TaskID:    taskID,
		Results:   mergedResults,
		CreatedAt: time.Now(),
	}, nil
}

func (s *Storage) CleanupTempFiles(taskID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	taskPath := filepath.Join(s.basePath, taskID, "temp")
	if _, err := os.Stat(taskPath); os.IsNotExist(err) {
		return nil
	}

	return os.RemoveAll(taskPath)
}

func (s *Storage) StreamResults(taskID string, callback func(models.AlignmentResult) bool) error {
	result, err := s.GetResult(taskID)
	if err != nil {
		return err
	}

	for _, r := range result.Results {
		if !callback(r) {
			break
		}
	}
	return nil
}

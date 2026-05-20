package main

import (
	"bufio"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"time"
)

const (
	defaultMaxFileSize = 100 * 1024 * 1024
	defaultMaxFiles   = 10
	readBufferSize    = 64 * 1024
	writeBufferSize   = 64 * 1024
	syncInterval      = 500 * time.Millisecond
)

var (
	ErrQueueFull      = errors.New("disk queue is full")
	ErrQueueEmpty     = errors.New("disk queue is empty")
	ErrQueueClosed    = errors.New("disk queue is closed")
	ErrCorruptedData  = errors.New("corrupted data detected")
)

type DiskQueue struct {
	dataDir      string
	maxFileSize  int64
	maxFiles     int
	maxBytes     int64

	writeFile    *os.File
	writeBuf     *bufio.Writer
	writeOffset  int64
	writeFileNum int

	readFile     *os.File
	readBuf      *bufio.Reader
	readOffset   int64
	readFileNum  int

	totalBytes   int64
	messageCount int64

	closeChan    chan struct{}
	writeChan    chan []byte
	readChan     chan []byte
	errorChan    chan error

	wg           sync.WaitGroup
	mu           sync.RWMutex
	closed       bool

	metrics      *DiskQueueMetrics
}

type DiskQueueMetrics struct {
	MessagesWritten     int64
	MessagesRead        int64
	BytesWritten        int64
	BytesRead           int64
	FileRotations       int64
	DiskFullEvents      int64
	ReadErrors          int64
	WriteErrors         int64
	AvgWriteLatency     int64
	mu                  sync.Mutex
}

type queueMeta struct {
	WriteFileNum int   `json:"write_file_num"`
	WriteOffset  int64 `json:"write_offset"`
	ReadFileNum  int   `json:"read_file_num"`
	ReadOffset   int64 `json:"read_offset"`
	MessageCount int64 `json:"message_count"`
	TotalBytes   int64 `json:"total_bytes"`
}

func NewDiskQueue(dataDir string) (*DiskQueue, error) {
	return NewDiskQueueWithConfig(dataDir, defaultMaxFileSize, defaultMaxFiles)
}

func NewDiskQueueWithConfig(dataDir string, maxFileSize int64, maxFiles int) (*DiskQueue, error) {
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create data dir: %w", err)
	}

	dq := &DiskQueue{
		dataDir:     dataDir,
		maxFileSize: maxFileSize,
		maxFiles:    maxFiles,
		maxBytes:    maxFileSize * int64(maxFiles),
		closeChan:   make(chan struct{}),
		writeChan:   make(chan []byte, 10000),
		readChan:    make(chan []byte, 10000),
		errorChan:   make(chan error, 100),
		metrics:     &DiskQueueMetrics{},
	}

	if err := dq.loadMeta(); err != nil {
		if !os.IsNotExist(err) {
			return nil, fmt.Errorf("failed to load meta: %w", err)
		}
	}

	if err := dq.openWriteFile(); err != nil {
		return nil, fmt.Errorf("failed to open write file: %w", err)
	}

	if err := dq.openReadFile(); err != nil {
		return nil, fmt.Errorf("failed to open read file: %w", err)
	}

	dq.wg.Add(3)
	go dq.writeLoop()
	go dq.readLoop()
	go dq.syncLoop()

	return dq, nil
}

func (dq *DiskQueue) Push(data []byte) error {
	dq.mu.RLock()
	if dq.closed {
		dq.mu.RUnlock()
		return ErrQueueClosed
	}
	dq.mu.RUnlock()

	select {
	case dq.writeChan <- data:
		return nil
	default:
		return ErrQueueFull
	}
}

func (dq *DiskQueue) PushWithTimeout(data []byte, timeout time.Duration) error {
	dq.mu.RLock()
	if dq.closed {
		dq.mu.RUnlock()
		return ErrQueueClosed
	}
	dq.mu.RUnlock()

	select {
	case dq.writeChan <- data:
		return nil
	case <-time.After(timeout):
		return ErrQueueFull
	}
}

func (dq *DiskQueue) Pop() ([]byte, error) {
	dq.mu.RLock()
	if dq.closed {
		dq.mu.RUnlock()
		return nil, ErrQueueClosed
	}
	dq.mu.RUnlock()

	select {
	case data := <-dq.readChan:
		return data, nil
	default:
		return nil, ErrQueueEmpty
	}
}

func (dq *DiskQueue) PopWithTimeout(timeout time.Duration) ([]byte, error) {
	dq.mu.RLock()
	if dq.closed {
		dq.mu.RUnlock()
		return nil, ErrQueueClosed
	}
	dq.mu.RUnlock()

	select {
	case data := <-dq.readChan:
		return data, nil
	case <-time.After(timeout):
		return nil, ErrQueueEmpty
	}
}

func (dq *DiskQueue) PopChan() <-chan []byte {
	return dq.readChan
}

func (dq *DiskQueue) ErrorChan() <-chan error {
	return dq.errorChan
}

func (dq *DiskQueue) writeLoop() {
	defer dq.wg.Done()

	for {
		select {
		case <-dq.closeChan:
			return
		case data := <-dq.writeChan:
			start := time.Now()
			if err := dq.writeMessage(data); err != nil {
				dq.handleError(fmt.Errorf("write failed: %w", err))
			}
			latency := time.Since(start).Microseconds()
			dq.updateWriteMetrics(int64(len(data)), latency)
		}
	}
}

func (dq *DiskQueue) writeMessage(data []byte) error {
	dq.mu.Lock()
	defer dq.mu.Unlock()

	if dq.writeOffset+int64(len(data))+4 > dq.maxFileSize {
		if err := dq.rotateWriteFile(); err != nil {
			return err
		}
	}

	sizeBuf := make([]byte, 4)
	binary.BigEndian.PutUint32(sizeBuf, uint32(len(data)))

	if _, err := dq.writeBuf.Write(sizeBuf); err != nil {
		return err
	}
	if _, err := dq.writeBuf.Write(data); err != nil {
		return err
	}

	dq.writeOffset += int64(len(data)) + 4
	dq.totalBytes += int64(len(data)) + 4
	dq.messageCount++

	return nil
}

func (dq *DiskQueue) rotateWriteFile() error {
	if err := dq.writeBuf.Flush(); err != nil {
		return err
	}
	if err := dq.writeFile.Sync(); err != nil {
		return err
	}
	if err := dq.writeFile.Close(); err != nil {
		return err
	}

	dq.writeFileNum++
	dq.writeOffset = 0

	if dq.writeFileNum - dq.readFileNum >= dq.maxFiles {
		dq.metrics.mu.Lock()
		dq.metrics.DiskFullEvents++
		dq.metrics.mu.Unlock()
		return fmt.Errorf("max files reached: %d", dq.maxFiles)
	}

	if err := dq.openWriteFile(); err != nil {
		return err
	}

	dq.metrics.mu.Lock()
	dq.metrics.FileRotations++
	dq.metrics.mu.Unlock()

	if err := dq.saveMeta(); err != nil {
		return err
	}

	return nil
}

func (dq *DiskQueue) openWriteFile() error {
	filename := filepath.Join(dq.dataDir, fmt.Sprintf("queue_%06d.dat", dq.writeFileNum))
	file, err := os.OpenFile(filename, os.O_WRONLY|os.O_CREATE|os.O_APPEND, 0644)
	if err != nil {
		return err
	}

	if dq.writeFile != nil {
		dq.writeFile.Close()
	}

	dq.writeFile = file
	dq.writeBuf = bufio.NewWriterSize(dq.writeFile, writeBufferSize)

	stat, err := file.Stat()
	if err != nil {
		return err
	}
	dq.writeOffset = stat.Size()

	return nil
}

func (dq *DiskQueue) readLoop() {
	defer dq.wg.Done()

	for {
		select {
		case <-dq.closeChan:
			return
		default:
			data, err := dq.readMessage()
			if err != nil {
				if err == ErrQueueEmpty {
					time.Sleep(10 * time.Millisecond)
					continue
				}
				dq.handleError(err)
				time.Sleep(10 * time.Millisecond)
				continue
			}

			select {
			case dq.readChan <- data:
				dq.metrics.mu.Lock()
				dq.metrics.MessagesRead++
				dq.metrics.BytesRead += int64(len(data))
				dq.metrics.mu.Unlock()
			case <-dq.closeChan:
				return
			}
		}
	}
}

func (dq *DiskQueue) readMessage() ([]byte, error) {
	dq.mu.Lock()
	defer dq.mu.Unlock()

	if dq.readFileNum == dq.writeFileNum && dq.readOffset >= dq.writeOffset {
		return nil, ErrQueueEmpty
	}

	if dq.readOffset >= dq.maxFileSize {
		if err := dq.rotateReadFile(); err != nil {
			return nil, err
		}
	}

	sizeBuf := make([]byte, 4)
	if _, err := io.ReadFull(dq.readBuf, sizeBuf); err != nil {
		if err == io.EOF {
			if err := dq.rotateReadFile(); err != nil {
				return nil, err
			}
			if _, err := io.ReadFull(dq.readBuf, sizeBuf); err != nil {
				return nil, err
			}
		} else {
			return nil, err
		}
	}

	size := binary.BigEndian.Uint32(sizeBuf)
	if size > 10*1024*1024 {
		dq.metrics.mu.Lock()
		dq.metrics.ReadErrors++
		dq.metrics.mu.Unlock()
		return nil, ErrCorruptedData
	}

	data := make([]byte, size)
	if _, err := io.ReadFull(dq.readBuf, data); err != nil {
		return nil, err
	}

	dq.readOffset += int64(size) + 4
	dq.totalBytes -= int64(size) + 4
	dq.messageCount--

	return data, nil
}

func (dq *DiskQueue) rotateReadFile() error {
	filename := filepath.Join(dq.dataDir, fmt.Sprintf("queue_%06d.dat", dq.readFileNum))
	if err := os.Remove(filename); err != nil && !os.IsNotExist(err) {
		return err
	}

	dq.readFileNum++
	dq.readOffset = 0

	if err := dq.openReadFile(); err != nil {
		return err
	}

	return dq.saveMeta()
}

func (dq *DiskQueue) openReadFile() error {
	filename := filepath.Join(dq.dataDir, fmt.Sprintf("queue_%06d.dat", dq.readFileNum))
	file, err := os.OpenFile(filename, os.O_RDONLY, 0644)
	if err != nil {
		return err
	}

	if dq.readFile != nil {
		dq.readFile.Close()
	}

	dq.readFile = file
	dq.readBuf = bufio.NewReaderSize(dq.readFile, readBufferSize)

	if dq.readOffset > 0 {
		if _, err := file.Seek(dq.readOffset, io.SeekStart); err != nil {
			return err
		}
		dq.readBuf = bufio.NewReaderSize(file, readBufferSize)
	}

	return nil
}

func (dq *DiskQueue) syncLoop() {
	defer dq.wg.Done()

	ticker := time.NewTicker(syncInterval)
	defer ticker.Stop()

	for {
		select {
		case <-dq.closeChan:
			return
		case <-ticker.C:
			dq.mu.Lock()
			if dq.writeBuf != nil {
				dq.writeBuf.Flush()
			}
			if dq.writeFile != nil {
				dq.writeFile.Sync()
			}
			dq.saveMeta()
			dq.mu.Unlock()
		}
	}
}

func (dq *DiskQueue) saveMeta() error {
	meta := queueMeta{
		WriteFileNum: dq.writeFileNum,
		WriteOffset:  dq.writeOffset,
		ReadFileNum:  dq.readFileNum,
		ReadOffset:   dq.readOffset,
		MessageCount: dq.messageCount,
		TotalBytes:   dq.totalBytes,
	}

	data, err := json.Marshal(meta)
	if err != nil {
		return err
	}

	metaFile := filepath.Join(dq.dataDir, "meta.json")
	return os.WriteFile(metaFile, data, 0644)
}

func (dq *DiskQueue) loadMeta() error {
	metaFile := filepath.Join(dq.dataDir, "meta.json")
	data, err := os.ReadFile(metaFile)
	if err != nil {
		return err
	}

	var meta queueMeta
	if err := json.Unmarshal(data, &meta); err != nil {
		return err
	}

	dq.writeFileNum = meta.WriteFileNum
	dq.writeOffset = meta.WriteOffset
	dq.readFileNum = meta.ReadFileNum
	dq.readOffset = meta.ReadOffset
	dq.messageCount = meta.MessageCount
	dq.totalBytes = meta.TotalBytes

	return nil
}

func (dq *DiskQueue) handleError(err error) {
	select {
	case dq.errorChan <- err:
	default:
	}
}

func (dq *DiskQueue) updateWriteMetrics(bytes int64, latency int64) {
	dq.metrics.mu.Lock()
	defer dq.metrics.mu.Unlock()

	dq.metrics.MessagesWritten++
	dq.metrics.BytesWritten += bytes
	if dq.metrics.AvgWriteLatency == 0 {
		dq.metrics.AvgWriteLatency = latency
	} else {
		dq.metrics.AvgWriteLatency = (dq.metrics.AvgWriteLatency*99 + latency) / 100
	}
}

func (dq *DiskQueue) Len() int64 {
	dq.mu.RLock()
	defer dq.mu.RUnlock()
	return dq.messageCount
}

func (dq *DiskQueue) SizeBytes() int64 {
	dq.mu.RLock()
	defer dq.mu.RUnlock()
	return dq.totalBytes
}

func (dq *DiskQueue) GetMetrics() DiskQueueMetrics {
	dq.metrics.mu.Lock()
	defer dq.metrics.mu.Unlock()
	return *dq.metrics
}

func (dq *DiskQueue) GetStats() map[string]interface{} {
	dq.mu.RLock()
	defer dq.mu.RUnlock()

	metrics := dq.GetMetrics()
	return map[string]interface{}{
		"message_count":       dq.messageCount,
		"total_bytes":         dq.totalBytes,
		"total_mb":            float64(dq.totalBytes) / 1024 / 1024,
		"write_file_num":      dq.writeFileNum,
		"read_file_num":       dq.readFileNum,
		"write_offset":        dq.writeOffset,
		"read_offset":         dq.readOffset,
		"messages_written":    metrics.MessagesWritten,
		"messages_read":       metrics.MessagesRead,
		"bytes_written_mb":    float64(metrics.BytesWritten) / 1024 / 1024,
		"bytes_read_mb":       float64(metrics.BytesRead) / 1024 / 1024,
		"file_rotations":      metrics.FileRotations,
		"disk_full_events":    metrics.DiskFullEvents,
		"read_errors":         metrics.ReadErrors,
		"write_errors":        metrics.WriteErrors,
		"avg_write_latency_us": metrics.AvgWriteLatency,
	}
}

func (dq *DiskQueue) Close() error {
	dq.mu.Lock()
	if dq.closed {
		dq.mu.Unlock()
		return nil
	}
	dq.closed = true
	dq.mu.Unlock()

	close(dq.closeChan)
	dq.wg.Wait()

	dq.mu.Lock()
	defer dq.mu.Unlock()

	if dq.writeBuf != nil {
		dq.writeBuf.Flush()
	}
	if dq.writeFile != nil {
		dq.writeFile.Sync()
		dq.writeFile.Close()
	}
	if dq.readFile != nil {
		dq.readFile.Close()
	}

	if err := dq.saveMeta(); err != nil {
		return err
	}

	close(dq.readChan)
	close(dq.writeChan)
	close(dq.errorChan)

	return nil
}

func (dq *DiskQueue) IsClosed() bool {
	dq.mu.RLock()
	defer dq.mu.RUnlock()
	return dq.closed
}

func (dq *DiskQueue) IsEmpty() bool {
	return dq.Len() == 0
}

func (dq *DiskQueue) IsFull() bool {
	dq.mu.RLock()
	defer dq.mu.RUnlock()
	return dq.totalBytes >= dq.maxBytes
}

type BufferedProcessor struct {
	diskQueue    *DiskQueue
	processor    func([]byte) error
	concurrency  int
	semaphore    chan struct{}
	wg           sync.WaitGroup
	closeChan    chan struct{}
	closed       bool
	mu           sync.Mutex
}

func NewBufferedProcessor(dataDir string, concurrency int, processor func([]byte) error) (*BufferedProcessor, error) {
	dq, err := NewDiskQueue(dataDir)
	if err != nil {
		return nil, err
	}

	bp := &BufferedProcessor{
		diskQueue:   dq,
		processor:   processor,
		concurrency: concurrency,
		semaphore:   make(chan struct{}, concurrency),
		closeChan:   make(chan struct{}),
	}

	for i := 0; i < concurrency; i++ {
		bp.wg.Add(1)
		go bp.processLoop()
	}

	return bp, nil
}

func (bp *BufferedProcessor) Push(data []byte) error {
	return bp.diskQueue.Push(data)
}

func (bp *BufferedProcessor) PushWithTimeout(data []byte, timeout time.Duration) error {
	return bp.diskQueue.PushWithTimeout(data, timeout)
}

func (bp *BufferedProcessor) processLoop() {
	defer bp.wg.Done()

	for {
		select {
		case <-bp.closeChan:
			return
		case data := <-bp.diskQueue.PopChan():
			bp.semaphore <- struct{}{}
			go func(d []byte) {
				defer func() { <-bp.semaphore }()
				if err := bp.processor(d); err != nil {
					select {
					case <-bp.closeChan:
						return
					default:
					}
				}
			}(data)
		}
	}
}

func (bp *BufferedProcessor) GetStats() map[string]interface{} {
	stats := bp.diskQueue.GetStats()
	stats["concurrency"] = bp.concurrency
	return stats
}

func (bp *BufferedProcessor) Close() error {
	bp.mu.Lock()
	if bp.closed {
		bp.mu.Unlock()
		return nil
	}
	bp.closed = true
	bp.mu.Unlock()

	close(bp.closeChan)
	bp.wg.Wait()

	return bp.diskQueue.Close()
}

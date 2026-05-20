package can

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"sync"
	"time"

	"edge-gateway/models"
)

type ReplayStatus string

const (
	StatusIdle     ReplayStatus = "idle"
	StatusPlaying  ReplayStatus = "playing"
	StatusPaused   ReplayStatus = "paused"
	StatusStopped  ReplayStatus = "stopped"
	StatusError    ReplayStatus = "error"
)

type ReplayProgress struct {
	CurrentIndex  int         `json:"current_index"`
	TotalMessages int         `json:"total_messages"`
	Percent       float64     `json:"percent"`
	CurrentTime   time.Time   `json:"current_time"`
	ElapsedTime   time.Duration `json:"elapsed_time"`
	Status        ReplayStatus `json:"status"`
}

type CANReplay struct {
	logFile    *models.CANLogFile
	config     *models.ReplayConfig
	status     ReplayStatus
	progress   ReplayProgress
	stopChan   chan struct{}
	pauseChan  chan bool
	resumeChan chan bool
	mu         sync.RWMutex
	msgChan    chan *models.CANMessage
	callback   func(*models.CANMessage) error
}

func NewCANReplay() *CANReplay {
	return &CANReplay{
		status:     StatusIdle,
		stopChan:   make(chan struct{}),
		pauseChan:  make(chan bool),
		resumeChan: make(chan bool),
		msgChan:    make(chan *models.CANMessage, 1000),
	}
}

func (r *CANReplay) LoadLogFile(filename string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	data, err := os.ReadFile(filename)
	if err != nil {
		r.status = StatusError
		return fmt.Errorf("failed to read file: %w", err)
	}

	var logFile models.CANLogFile
	if err := json.Unmarshal(data, &logFile); err != nil {
		r.status = StatusError
		return fmt.Errorf("failed to parse JSON: %w", err)
	}

	if len(logFile.Messages) == 0 {
		r.status = StatusError
		return fmt.Errorf("no messages in log file")
	}

	r.logFile = &logFile
	r.progress = ReplayProgress{
		CurrentIndex:  0,
		TotalMessages: len(logFile.Messages),
		Percent:       0,
		Status:        StatusIdle,
	}
	r.status = StatusIdle

	log.Printf("Loaded CAN log: %s, %d messages", filename, len(logFile.Messages))
	return nil
}

func (r *CANReplay) SetMessageCallback(callback func(*models.CANMessage) error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.callback = callback
}

func (r *CANReplay) SetConfig(config *models.ReplayConfig) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.config = config
}

func (r *CANReplay) Start(config *models.ReplayConfig) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.logFile == nil {
		return fmt.Errorf("no log file loaded")
	}

	if r.status == StatusPlaying {
		return fmt.Errorf("already playing")
	}

	if config != nil {
		r.config = config
	}

	if r.config == nil {
		r.config = &models.ReplayConfig{
			SpeedFactor: 1.0,
			LoopCount:   1,
		}
	}

	r.status = StatusPlaying
	r.progress.Status = StatusPlaying

	go r.replayLoop()

	log.Printf("CAN replay started, speed: %.2fx, loops: %d",
		r.config.SpeedFactor, r.config.LoopCount)
	return nil
}

func (r *CANReplay) replayLoop() {
	startTime := time.Now()

	for loop := 0; loop < r.config.LoopCount || r.config.LoopCount == 0; loop++ {
		if r.config.LoopCount > 0 {
			log.Printf("Starting loop %d/%d", loop+1, r.config.LoopCount)
		} else {
			log.Printf("Starting loop %d (infinite)", loop+1)
		}

		if err := r.playSingleLoop(startTime); err != nil {
			if err.Error() == "stopped" {
				break
			}
			log.Printf("Replay error: %v", err)
			r.mu.Lock()
			r.status = StatusError
			r.progress.Status = StatusError
			r.mu.Unlock()
			return
		}

		select {
		case <-r.stopChan:
			return
		default:
		}
	}

	r.mu.Lock()
	r.status = StatusStopped
	r.progress.Status = StatusStopped
	r.mu.Unlock()
	log.Println("CAN replay completed successfully")
}

func (r *CANReplay) playSingleLoop(globalStartTime time.Time) error {
	messages := r.getFilteredMessages()
	if len(messages) == 0 {
		return fmt.Errorf("no messages after filtering")
	}

	loopStart := time.Now()
	firstMsgTime := messages[0].Timestamp

	for i, msg := range messages {
		select {
		case <-r.stopChan:
			return fmt.Errorf("stopped")
		case <-r.pauseChan:
			<-r.resumeChan
			loopStart = time.Now()
		default:
		}

		relativeTime := msg.Timestamp.Sub(firstMsgTime)
		adjustedDelay := time.Duration(float64(relativeTime) / r.config.SpeedFactor)

		elapsed := time.Since(loopStart)
		if adjustedDelay > elapsed {
			sleepTime := adjustedDelay - elapsed
			time.Sleep(sleepTime)
		}

		if err := r.sendMessage(&msg, i); err != nil {
			log.Printf("Failed to send message %d: %v", i, err)
		}

		r.mu.Lock()
		r.progress.CurrentIndex = i
		r.progress.Percent = float64(i+1) / float64(len(messages)) * 100
		r.progress.CurrentTime = msg.Timestamp
		r.progress.ElapsedTime = time.Since(globalStartTime)
		r.mu.Unlock()
	}

	return nil
}

func (r *CANReplay) getFilteredMessages() []models.CANMessage {
	if r.config == nil || (len(r.config.FilterIDs) == 0 && len(r.config.BusFilter) == 0 &&
		r.config.StartOffsetMs == 0 && r.config.EndOffsetMs == 0) {
		return r.logFile.Messages
	}

	var filtered []models.CANMessage
	firstTime := r.logFile.Messages[0].Timestamp
	lastTime := r.logFile.Messages[len(r.logFile.Messages)-1].Timestamp

	startTime := firstTime.Add(time.Duration(r.config.StartOffsetMs) * time.Millisecond)
	endTime := lastTime
	if r.config.EndOffsetMs > 0 {
		endTime = firstTime.Add(time.Duration(r.config.EndOffsetMs) * time.Millisecond)
	}

	idFilter := make(map[uint32]bool)
	for _, id := range r.config.FilterIDs {
		idFilter[id] = true
	}
	busFilter := make(map[uint8]bool)
	for _, bus := range r.config.BusFilter {
		busFilter[bus] = true
	}

	for _, msg := range r.logFile.Messages {
		if msg.Timestamp.Before(startTime) || (r.config.EndOffsetMs > 0 && msg.Timestamp.After(endTime)) {
			continue
		}

		if len(idFilter) > 0 && !idFilter[msg.ID] {
			continue
		}

		if len(busFilter) > 0 && !busFilter[msg.Bus] {
			continue
		}

		filtered = append(filtered, msg)
	}

	return filtered
}

func (r *CANReplay) sendMessage(msg *models.CANMessage, index int) error {
	select {
	case r.msgChan <- msg:
	default:
	}

	if r.callback != nil {
		return r.callback(msg)
	}

	return nil
}

func (r *CANReplay) Pause() error {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if r.status != StatusPlaying {
		return fmt.Errorf("not playing")
	}

	r.pauseChan <- true
	r.status = StatusPaused
	r.progress.Status = StatusPaused
	log.Println("CAN replay paused")
	return nil
}

func (r *CANReplay) Resume() error {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if r.status != StatusPaused {
		return fmt.Errorf("not paused")
	}

	r.resumeChan <- true
	r.status = StatusPlaying
	r.progress.Status = StatusPlaying
	log.Println("CAN replay resumed")
	return nil
}

func (r *CANReplay) Stop() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.status == StatusStopped || r.status == StatusIdle {
		return fmt.Errorf("not playing or paused")
	}

	close(r.stopChan)
	r.status = StatusStopped
	r.progress.Status = StatusStopped
	r.stopChan = make(chan struct{})

	log.Println("CAN replay stopped")
	return nil
}

func (r *CANReplay) GetStatus() ReplayStatus {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.status
}

func (r *CANReplay) GetProgress() ReplayProgress {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.progress
}

func (r *CANReplay) GetMessageChannel() <-chan *models.CANMessage {
	return r.msgChan
}

func ParseASCFile(filename string) (*models.CANLogFile, error) {
	data, err := os.ReadFile(filename)
	if err != nil {
		return nil, err
	}

	content := string(data)
	var messages []models.CANMessage

	lines := splitLines(content)
	for _, line := range lines {
		if msg, ok := parseASCLine(line); ok {
			messages = append(messages, *msg)
		}
	}

	return &models.CANLogFile{
		Filename: filename,
		Messages: messages,
		CreatedAt: time.Now(),
		Version:  "1.0",
	}, nil
}

func splitLines(content string) []string {
	var lines []string
	start := 0
	for i := 0; i < len(content); i++ {
		if content[i] == '\n' {
			if i > start && content[i-1] == '\r' {
				lines = append(lines, content[start:i-1])
			} else {
				lines = append(lines, content[start:i])
			}
			start = i + 1
		}
	}
	if start < len(content) {
		lines = append(lines, content[start:])
	}
	return lines
}

func parseASCLine(line string) (*models.CANMessage, bool) {
	if len(line) == 0 || line[0] == '#' || line[0] == '%' {
		return nil, false
	}

	var timestamp float64
	var bus uint
	var idHex string
	var isTx bool
	var dlc uint
	var dataBytes []byte

	_, err := fmt.Sscanf(line, "%f %d %s %t %d",
		&timestamp, &bus, &idHex, &isTx, &dlc)
	if err != nil {
		return nil, false
	}

	dataStart := len(fmt.Sprintf("%f %d %s %t %d",
		timestamp, bus, idHex, isTx, dlc))
	if dataStart < len(line) {
		dataPart := line[dataStart:]
		dataBytes = parseDataBytes(dataPart)
	}

	var id uint32
	fmt.Sscanf(idHex, "%x", &id)

	return &models.CANMessage{
		Timestamp:  time.Unix(0, int64(timestamp*float64(time.Second))),
		ID:         id,
		IsExtended: len(idHex) > 3,
		Data:       dataBytes,
		DLC:        uint8(dlc),
		Bus:        uint8(bus),
	}, true
}

func parseDataBytes(dataStr string) []byte {
	var bytes []byte
	for i := 0; i+1 < len(dataStr); i += 3 {
		if i+1 < len(dataStr) {
			var b byte
			fmt.Sscanf(dataStr[i:i+2], "%x", &b)
			bytes = append(bytes, b)
		}
	}
	return bytes
}

func GenerateSampleLogFile(filename string, numMessages int, intervalMs int) error {
	var messages []models.CANMessage
	startTime := time.Now()

	for i := 0; i < numMessages; i++ {
		msg := models.CANMessage{
			Timestamp:  startTime.Add(time.Duration(i*intervalMs) * time.Millisecond),
			ID:         uint32(0x100 + (i % 50)),
			IsExtended: false,
			Data:       []byte{byte(i % 256), byte(i >> 8)},
			DLC:        8,
		}
		messages = append(messages, msg)
	}

	logFile := models.CANLogFile{
		Filename:  filename,
		Messages:  messages,
		CreatedAt: time.Now(),
		Version:   "1.0",
	}

	data, err := json.MarshalIndent(logFile, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(filename, data, 0644)
}

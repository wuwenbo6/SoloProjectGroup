package scheduler

import (
	"encoding/json"
	"log"
	"strconv"
	"sync"
	"time"

	"github.com/streadway/amqp"

	"github.com/genomics/alignment/internal/algorithm"
	"github.com/genomics/alignment/internal/cache"
	"github.com/genomics/alignment/internal/storage"
	"github.com/genomics/alignment/pkg/models"
	"github.com/genomics/alignment/pkg/utils"
)

const (
	TaskQueue        = "alignment_tasks"
	ResultQueue      = "alignment_results"
	DLXExchange      = "alignment_dlx"
	DLQueue          = "alignment_deadletter"
	MaxRetries       = 3
	MessageTTL       = 30 * 60 * 1000 
	TaskTimeout      = 25 * 60 * 1000 
)

type Scheduler struct {
	conn         *amqp.Connection
	channel      *amqp.Channel
	cache        *cache.Cache
	storage      *storage.Storage
	resultChan   chan *models.ChunkResult
	workerPool   map[string]bool
	mu           sync.RWMutex
	shutdownChan chan struct{}
}

func NewScheduler(amqpURL string, cache *cache.Cache, storage *storage.Storage) (*Scheduler, error) {
	conn, err := amqp.Dial(amqpURL)
	if err != nil {
		return nil, err
	}

	ch, err := conn.Channel()
	if err != nil {
		conn.Close()
		return nil, err
	}

	err = ch.ExchangeDeclare(
		DLXExchange,
		"direct",
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		ch.Close()
		conn.Close()
		return nil, err
	}

	_, err = ch.QueueDeclare(
		DLQueue,
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		ch.Close()
		conn.Close()
		return nil, err
	}

	err = ch.QueueBind(
		DLQueue,
		"",
		DLXExchange,
		false,
		nil,
	)
	if err != nil {
		ch.Close()
		conn.Close()
		return nil, err
	}

	_, err = ch.QueueDeclare(
		TaskQueue,
		true,
		false,
		false,
		false,
		amqp.Table{
			"x-dead-letter-exchange": DLXExchange,
			"x-message-ttl":          int32(MessageTTL),
		},
	)
	if err != nil {
		ch.Close()
		conn.Close()
		return nil, err
	}

	_, err = ch.QueueDeclare(
		ResultQueue,
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		ch.Close()
		conn.Close()
		return nil, err
	}

	err = ch.Qos(1, 0, false)
	if err != nil {
		ch.Close()
		conn.Close()
		return nil, err
	}

	s := &Scheduler{
		conn:         conn,
		channel:      ch,
		cache:        cache,
		storage:      storage,
		resultChan:   make(chan *models.ChunkResult, 100),
		workerPool:   make(map[string]bool),
		shutdownChan: make(chan struct{}),
	}

	go s.consumeResults()
	go s.consumeDeadLetter()

	return s, nil
}

func (s *Scheduler) SubmitTask(task *models.Task) error {
	if err := s.cache.SaveTask(task); err != nil {
		return err
	}

	task.Status = models.TaskStatusProcessing
	s.cache.SaveTask(task)

	sequences, err := s.storage.ReadFastaSequences(task.ID)
	if err != nil {
		return err
	}

	chunks, err := s.storage.SplitIntoChunks(task.ID, sequences, task.ScoringConfig)
	if err != nil {
		return err
	}

	task.TotalChunks = len(chunks)
	s.cache.SaveTask(task)

	for _, chunk := range chunks {
		if err := s.sendChunkTask(chunk); err != nil {
			log.Printf("Failed to send chunk %d: %v", chunk.ChunkID, err)
		}
	}

	return nil
}

func (s *Scheduler) sendChunkTask(chunk *models.ChunkTask) error {
	body, err := json.Marshal(chunk)
	if err != nil {
		return err
	}

	remainingTTL := MessageTTL
	if chunk.RetryCount > 0 {
		remainingTTL = MessageTTL / (chunk.RetryCount + 1)
	}

	return s.channel.Publish(
		"",
		TaskQueue,
		false,
		false,
		amqp.Publishing{
			DeliveryMode: amqp.Persistent,
			ContentType:  "application/json",
			Body:         body,
			Expiration:   strconv.Itoa(remainingTTL),
			Headers: amqp.Table{
				"retry_count":  chunk.RetryCount,
				"submitted_at": time.Now().Unix(),
			},
		},
	)
}

func (s *Scheduler) consumeResults() {
	msgs, err := s.channel.Consume(
		ResultQueue,
		"",
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		log.Fatalf("Failed to consume results: %v", err)
	}

	for {
		select {
		case <-s.shutdownChan:
			return
		case msg := <-msgs:
			var result models.ChunkResult
			if err := json.Unmarshal(msg.Body, &result); err != nil {
				log.Printf("Failed to unmarshal result: %v", err)
				continue
			}

			if !result.Success && result.RetryCount < MaxRetries {
				result.RetryCount++
				log.Printf("Retrying chunk %d (attempt %d)", result.ChunkID, result.RetryCount)
				chunk := &models.ChunkTask{
					TaskID:     result.TaskID,
					ChunkID:    result.ChunkID,
					RetryCount: result.RetryCount,
				}
				if err := s.sendChunkTask(chunk); err != nil {
					log.Printf("Failed to retry chunk: %v", err)
				}
				continue
			}

			s.resultChan <- &result
			go s.processResult(&result)
		}
	}
}

func (s *Scheduler) processResult(result *models.ChunkResult) {
	if result.Success {
		if _, err := s.storage.SaveChunkTempFile(result.TaskID, result.ChunkID, result.Results); err != nil {
			log.Printf("Failed to save chunk temp file: %v", err)
		}
	}

	if err := s.cache.SaveChunkResult(result); err != nil {
		log.Printf("Failed to save chunk result metadata: %v", err)
	}

	task, err := s.cache.GetTask(result.TaskID)
	if err != nil {
		log.Printf("Failed to get task: %v", err)
		return
	}

	task.CompletedChunks++
	task.Progress = int(float64(task.CompletedChunks) / float64(task.TotalChunks) * 100)

	if !result.Success && result.RetryCount >= MaxRetries {
		task.Status = models.TaskStatusFailed
		task.Message = "Some chunks failed after maximum retries"
		task.UpdatedAt = time.Now()
		s.cache.SaveTask(task)
		return
	}

	if task.CompletedChunks >= task.TotalChunks {
		task.Status = models.TaskStatusMerging
	}

	task.UpdatedAt = time.Now()
	s.cache.SaveTask(task)

	if task.CompletedChunks >= task.TotalChunks && task.Status != models.TaskStatusFailed {
		go s.mergeResults(task)
	}
}

func (s *Scheduler) mergeResults(task *models.Task) {
	log.Printf("Merging results for task %s using external merge sort", task.ID)

	const (
		heatmapLimit  = 1000
		resultLimit   = 100000
	)

	mergedResult, err := s.storage.MergeSortedChunks(task.ID, task.TotalChunks, resultLimit)
	if err != nil {
		log.Printf("Failed to merge sorted chunks: %v", err)
		s.cache.UpdateTaskStatus(task.ID, models.TaskStatusFailed, err.Error())
		return
	}

	heatmapCount := min(heatmapLimit, len(mergedResult.Results))
	var algResults []*algorithm.AlignmentResult
	for i := 0; i < heatmapCount; i++ {
		r := mergedResult.Results[i]
		algResult := &algorithm.AlignmentResult{
			SequenceA: r.SequenceA,
			SequenceB: r.SequenceB,
			AlignedA:  r.AlignedA,
			AlignedB:  r.AlignedB,
			Score:      r.Score,
			Identity:   r.Identity,
		}
		algResults = append(algResults, algResult)
	}

	batchHeatmap := algorithm.GenerateBatchHeatmap(algResults, task.ID)
	mergedResult.BatchHeatmap = batchHeatmap

	for i := 0; i < heatmapCount; i++ {
		if i < len(algResults) {
			mergedResult.Results[i].Heatmap = algResults[i].GenerateHeatmap()
		}
	}

	if err := s.storage.SaveResult(task.ID, mergedResult); err != nil {
		log.Printf("Failed to save task result: %v", err)
		s.cache.UpdateTaskStatus(task.ID, models.TaskStatusFailed, err.Error())
		return
	}

	go func() {
		if err := s.storage.CleanupTempFiles(task.ID); err != nil {
			log.Printf("Warning: failed to cleanup temp files for task %s: %v", task.ID, err)
		}
	}()

	task.Status = models.TaskStatusCompleted
	task.Progress = 100
	task.UpdatedAt = time.Now()
	s.cache.SaveTask(task)

	log.Printf("Task %s completed successfully with %d results (memory-efficient merge)", task.ID, len(mergedResult.Results))
}

func (s *Scheduler) consumeDeadLetter() {
	msgs, err := s.channel.Consume(
		DLQueue,
		"",
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		log.Printf("Failed to consume dead letter queue: %v", err)
		return
	}

	log.Println("Dead letter consumer started")

	for {
		select {
		case <-s.shutdownChan:
			return
		case msg := <-msgs:
			go s.handleDeadLetter(msg)
		}
	}
}

func (s *Scheduler) handleDeadLetter(msg amqp.Delivery) {
	var chunkTask models.ChunkTask
	if err := json.Unmarshal(msg.Body, &chunkTask); err != nil {
		log.Printf("Failed to unmarshal dead letter task: %v", err)
		return
	}

	deathReason := "unknown"
	if headers, ok := msg.Headers["x-death"].([]interface{}); ok && len(headers) > 0 {
		if deathInfo, ok := headers[0].(amqp.Table); ok {
			if reason, ok := deathInfo["reason"].(string); ok {
				deathReason = reason
			}
		}
	}

	log.Printf("Chunk task %d of task %s entered dead letter queue. Reason: %s, Retry count: %d",
		chunkTask.ChunkID, chunkTask.TaskID, deathReason, chunkTask.RetryCount)

	if deathReason == "expired" || deathReason == "rejected" {
		if chunkTask.RetryCount < MaxRetries {
			chunkTask.RetryCount++
			log.Printf("Retrying chunk %d (attempt %d)", chunkTask.ChunkID, chunkTask.RetryCount)
			if err := s.sendChunkTask(&chunkTask); err != nil {
				log.Printf("Failed to retry chunk %d: %v", chunkTask.ChunkID, err)
			}
			return
		}
	}

	result := &models.ChunkResult{
		TaskID:    chunkTask.TaskID,
		ChunkID:   chunkTask.ChunkID,
		Success:   false,
		Error:     "Task timed out or failed after max retries",
		RetryCount: chunkTask.RetryCount,
	}

	s.resultChan <- result
	go s.processResult(result)

	task, err := s.cache.GetTask(chunkTask.TaskID)
	if err == nil && task.Status != models.TaskStatusFailed {
		task.Message = "Some chunks timed out. Please try again with smaller files."
		task.UpdatedAt = time.Now()
		s.cache.SaveTask(task)
	}
}

func (s *Scheduler) GetResultChan() <-chan *models.ChunkResult {
	return s.resultChan
}

func (s *Scheduler) Close() error {
	close(s.shutdownChan)
	close(s.resultChan)
	if err := s.channel.Close(); err != nil {
		return err
	}
	return s.conn.Close()
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

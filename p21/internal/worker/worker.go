package worker

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"time"

	"github.com/streadway/amqp"

	"github.com/genomics/alignment/internal/algorithm"
	"github.com/genomics/alignment/internal/cache"
	"github.com/genomics/alignment/internal/scheduler"
	"github.com/genomics/alignment/pkg/models"
	"github.com/genomics/alignment/pkg/utils"
)

type Worker struct {
	id           string
	conn         *amqp.Connection
	channel      *amqp.Channel
	cache        *cache.Cache
	shutdownChan chan struct{}
}

func NewWorker(amqpURL string, cache *cache.Cache) (*Worker, error) {
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
		scheduler.DLXExchange,
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
		scheduler.DLQueue,
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
		scheduler.DLQueue,
		"",
		scheduler.DLXExchange,
		false,
		nil,
	)
	if err != nil {
		ch.Close()
		conn.Close()
		return nil, err
	}

	_, err = ch.QueueDeclare(
		scheduler.TaskQueue,
		true,
		false,
		false,
		false,
		amqp.Table{
			"x-dead-letter-exchange": scheduler.DLXExchange,
			"x-message-ttl":          int32(scheduler.MessageTTL),
		},
	)
	if err != nil {
		ch.Close()
		conn.Close()
		return nil, err
	}

	_, err = ch.QueueDeclare(
		scheduler.ResultQueue,
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

	hostname, _ := os.Hostname()
	workerID := utils.GenerateWorkerID()

	worker := &Worker{
		id:           workerID,
		conn:         conn,
		channel:      ch,
		cache:        cache,
		shutdownChan: make(chan struct{}),
	}

	info := &models.WorkerInfo{
		ID:        workerID,
		Hostname:  hostname,
		PID:       os.Getpid(),
		StartedAt: time.Now(),
		LastSeenAt: time.Now(),
		IsHealthy:  true,
	}
	cache.RegisterWorker(info)

	return worker, nil
}

func (w *Worker) Start() error {
	msgs, err := w.channel.Consume(
		scheduler.TaskQueue,
		"",
		false,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return err
	}

	log.Printf("Worker %s started, waiting for tasks...", w.id)

	go w.heartbeat()

	for {
		select {
		case <-w.shutdownChan:
			return nil
		case msg := <-msgs:
			go w.processMessage(msg)
		}
	}
}

func (w *Worker) heartbeat() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-w.shutdownChan:
			return
		case <-ticker.C:
			info := &models.WorkerInfo{
				ID:         w.id,
				StartedAt:  time.Now(),
				LastSeenAt: time.Now(),
				IsHealthy:  true,
			}
			w.cache.RegisterWorker(info)
		}
	}
}

func (w *Worker) processMessage(msg amqp.Delivery) {
	startTime := time.Now()

	var chunkTask models.ChunkTask
	if err := json.Unmarshal(msg.Body, &chunkTask); err != nil {
		log.Printf("Failed to unmarshal task: %v", err)
		msg.Nack(false, false)
		return
	}

	log.Printf("Worker %s processing chunk %d of task %s", w.id, chunkTask.ChunkID, chunkTask.TaskID)

	result := &models.ChunkResult{
		TaskID:     chunkTask.TaskID,
		ChunkID:    chunkTask.ChunkID,
		WorkerID:   w.id,
		RetryCount: chunkTask.RetryCount,
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(scheduler.TaskTimeout)*time.Millisecond)
	defer cancel()

	resultChan := make(chan []models.AlignmentResult, 1)
	errChan := make(chan error, 1)

	go func() {
		results, err := w.alignSequences(chunkTask.Sequences, chunkTask.ScoringConfig)
		if err != nil {
			errChan <- err
			return
		}
		resultChan <- results
	}()

	select {
	case <-ctx.Done():
		result.Success = false
		result.Error = "Task execution timeout"
		log.Printf("Chunk %d of task %s timed out after %d ms", chunkTask.ChunkID, chunkTask.TaskID, scheduler.TaskTimeout)
		
		if err := w.sendResult(result); err != nil {
			log.Printf("Failed to send timeout result: %v", err)
		}
		
		msg.Nack(false, false)
		return
		
	case err := <-errChan:
		result.Success = false
		result.Error = err.Error()
		log.Printf("Alignment failed: %v", err)
		
	case results := <-resultChan:
		result.Success = true
		result.Results = results
	}

	result.DurationMs = time.Since(startTime).Milliseconds()

	if err := w.sendResult(result); err != nil {
		log.Printf("Failed to send result: %v", err)
		msg.Nack(false, true)
		return
	}

	msg.Ack(false)
	log.Printf("Worker %s completed chunk %d in %d ms", w.id, chunkTask.ChunkID, result.DurationMs)
}

func (w *Worker) alignSequences(sequences []string, scoringConfig *models.ScoringConfig) ([]models.AlignmentResult, error) {
	var results []models.AlignmentResult
	var matrix *algorithm.ScoringMatrix

	if scoringConfig != nil {
		var err error
		if scoringConfig.MatrixURL != "" {
			matrix, err = algorithm.LoadMatrixFromURL(scoringConfig.MatrixURL)
			if err != nil {
				log.Printf("Failed to load custom matrix from URL %s: %v, using default", scoringConfig.MatrixURL, err)
			}
		} else if scoringConfig.MatrixType != "" {
			matrix, err = algorithm.GetBuiltinMatrix(algorithm.MatrixType(scoringConfig.MatrixType))
			if err != nil {
				log.Printf("Failed to load builtin matrix %s: %v, using default", scoringConfig.MatrixType, err)
			}
		}
	}

	for i := 0; i < len(sequences); i++ {
		for j := i + 1; j < len(sequences); j++ {
			hash := utils.HashSequence(sequences[i] + "|" + sequences[j])
			if scoringConfig != nil {
				hash += "|" + scoringConfig.MatrixType + scoringConfig.MatrixURL
			}
			
			cached, err := w.cache.GetCachedAlignment(hash)
			if err == nil && cached != nil {
				results = append(results, *cached)
				continue
			}

			var algResult *algorithm.AlignmentResult
			if matrix != nil {
				algResult = algorithm.NeedlemanWunschWithMatrix(sequences[i], sequences[j], matrix)
			} else {
				algResult = algorithm.NeedlemanWunsch(sequences[i], sequences[j])
			}
			
			alignResult := models.AlignmentResult{
				SequenceA: algResult.SequenceA,
				SequenceB: algResult.SequenceB,
				AlignedA:  algResult.AlignedA,
				AlignedB:  algResult.AlignedB,
				Score:     algResult.Score,
				Identity:  algResult.Identity,
			}
			
			w.cache.CacheAlignmentResult(hash, &alignResult)
			results = append(results, alignResult)
		}
	}

	return results, nil
}

func (w *Worker) sendResult(result *models.ChunkResult) error {
	body, err := json.Marshal(result)
	if err != nil {
		return err
	}

	return w.channel.Publish(
		"",
		scheduler.ResultQueue,
		false,
		false,
		amqp.Publishing{
			DeliveryMode: amqp.Persistent,
			ContentType:  "application/json",
			Body:         body,
		},
	)
}

func (w *Worker) Stop() error {
	close(w.shutdownChan)
	if err := w.channel.Close(); err != nil {
		return err
	}
	return w.conn.Close()
}

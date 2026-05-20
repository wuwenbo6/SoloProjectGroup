package service

import (
	"context"
	"io"
	"time"

	"github.com/genomics/alignment/internal/cache"
	"github.com/genomics/alignment/internal/scheduler"
	"github.com/genomics/alignment/internal/storage"
	"github.com/genomics/alignment/pkg/models"
	"github.com/genomics/alignment/pkg/utils"
)

type AlignmentService struct {
	cache     *cache.Cache
	storage   *storage.Storage
	scheduler *scheduler.Scheduler
}

func NewAlignmentService(cache *cache.Cache, storage *storage.Storage, scheduler *scheduler.Scheduler) *AlignmentService {
	return &AlignmentService{
		cache:     cache,
		storage:   storage,
		scheduler: scheduler,
	}
}

func (s *AlignmentService) UploadFasta(stream interface{ Recv() (interface{}, error) }) (string, error) {
	taskID := utils.GenerateTaskID()
	var totalSize int64

	task := &models.Task{
		ID:         taskID,
		Status:     models.TaskStatusUploading,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}
	s.cache.SaveTask(task)

	for {
		req, err := stream.Recv()
		if err == io.EOF {
			break
		}
		if err != nil {
			return "", err
		}

		chunkData, ok := req.([]byte)
		if !ok {
			continue
		}

		if err := s.storage.AppendChunk(taskID, 0, chunkData); err != nil {
			return "", err
		}
		totalSize += int64(len(chunkData))
	}

	task.FileSize = totalSize
	task.UpdatedAt = time.Now()
	s.cache.SaveTask(task)

	if err := s.scheduler.SubmitTask(task); err != nil {
		return "", err
	}

	return taskID, nil
}

func (s *AlignmentService) GetTaskStatus(ctx context.Context, taskID string) (*models.Task, error) {
	task, err := s.cache.GetTask(taskID)
	if err != nil {
		return nil, err
	}
	return task, nil
}

func (s *AlignmentService) DownloadResult(ctx context.Context, taskID string) (*models.TaskResult, error) {
	result, err := s.storage.GetResult(taskID)
	if err != nil {
		return nil, err
	}
	return result, nil
}

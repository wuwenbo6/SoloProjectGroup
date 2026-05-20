package processor

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/video-transcoder/internal/config"
	"github.com/video-transcoder/internal/database"
	"github.com/video-transcoder/internal/models"
	"github.com/video-transcoder/internal/mq"
	"github.com/video-transcoder/internal/storage"
)

type VideoProcessor struct {
	cfg         *config.Config
	minioClient *storage.MinIOClient
	mqClient    *mq.RabbitMQClient
	workDir     string
}

func NewVideoProcessor(cfg *config.Config, minioClient *storage.MinIOClient, mqClient *mq.RabbitMQClient) *VideoProcessor {
	workDir := filepath.Join(os.TempDir(), "video-transcoder")
	os.MkdirAll(workDir, 0755)

	return &VideoProcessor{
		cfg:         cfg,
		minioClient: minioClient,
		mqClient:    mqClient,
		workDir:     workDir,
	}
}

func (vp *VideoProcessor) GetVideoDuration(ctx context.Context, inputPath string) (float64, error) {
	cmd := exec.CommandContext(ctx, vp.cfg.FFmpegPath,
		"-i", inputPath,
		"-show_entries", "format=duration",
		"-v", "quiet",
		"-of", "csv=p=0",
	)

	output, err := cmd.Output()
	if err != nil {
		return 0, fmt.Errorf("failed to get duration: %w", err)
	}

	durationStr := strings.TrimSpace(string(output))
	duration, err := strconv.ParseFloat(durationStr, 64)
	if err != nil {
		return 0, fmt.Errorf("failed to parse duration: %w", err)
	}

	return duration, nil
}

func (vp *VideoProcessor) SplitVideo(ctx context.Context, taskID uuid.UUID) error {
	var task models.Task
	if err := database.DB.First(&task, "id = ?", taskID).Error; err != nil {
		return fmt.Errorf("task not found: %w", err)
	}

	taskDir := filepath.Join(vp.workDir, taskID.String())
	os.MkdirAll(taskDir, 0755)
	defer os.RemoveAll(taskDir)

	ext := filepath.Ext(task.Filename)
	inputObjectName := taskID.String() + ext

	inputPath := filepath.Join(taskDir, "input"+ext)
	if err := vp.downloadFromMinIO(ctx, vp.minioClient.GetInputBucket(), inputObjectName, inputPath); err != nil {
		return fmt.Errorf("failed to download input: %w", err)
	}

	duration, err := vp.GetVideoDuration(ctx, inputPath)
	if err != nil {
		return fmt.Errorf("failed to get video duration: %w", err)
	}

	task.Duration = duration
	database.DB.Save(&task)

	segmentDuration := float64(vp.cfg.SegmentDuration)
	segmentCount := int(duration / segmentDuration)
	if duration-float64(segmentCount)*segmentDuration > 0 {
		segmentCount++
	}

	task.SegmentCount = segmentCount
	database.DB.Save(&task)

	for i := 0; i < segmentCount; i++ {
		startTime := float64(i) * segmentDuration
		segDuration := segmentDuration
		if startTime+segDuration > duration {
			segDuration = duration - startTime
		}

		segment := &models.Segment{
			ID:        uuid.New(),
			TaskID:    taskID,
			SegmentID: i,
			StartTime: startTime,
			Duration:  segDuration,
			Status:    models.StatusPending,
		}

		inputSegPath := fmt.Sprintf("%s/segment_%d_input%s", taskDir, i, ext)
		outputSegPath := fmt.Sprintf("%s/segment_%d_output.mp4", taskDir, i)

		segment.InputPath = fmt.Sprintf("%s/segment_%d_input%s", taskID, i, ext)
		segment.OutputPath = fmt.Sprintf("%s/segment_%d_output.mp4", taskID, i)

		if err := vp.splitSegment(ctx, inputPath, inputSegPath, startTime, segDuration, i, segmentCount); err != nil {
			log.Printf("Failed to split segment %d: %v", i, err)
			segment.Status = models.StatusFailed
			segment.ErrorMsg = err.Error()
		} else {
			file, err := os.Open(inputSegPath)
			if err == nil {
				stat, _ := file.Stat()
				vp.minioClient.UploadSegment(ctx, segment.InputPath, file, stat.Size())
				file.Close()
			}
			segment.Status = models.StatusQueued
		}

		database.DB.Create(segment)

		if segment.Status == models.StatusQueued {
			vp.mqClient.PublishTranscodeTask(ctx, mq.TranscodeMessage{
				TaskID:     taskID.String(),
				SegmentID:  i,
				InputPath:  segment.InputPath,
				OutputPath: segment.OutputPath,
				Codec:      string(task.Codec),
				Duration:   segDuration,
				StartTime:  startTime,
			})
		}
	}

	task.Status = models.StatusProcessing
	database.DB.Save(&task)

	return nil
}

func (vp *VideoProcessor) splitSegment(ctx context.Context, inputPath, outputPath string, startTime, duration float64, segmentIndex int, totalSegments int) error {
	args := []string{
		"-ss", fmt.Sprintf("%.3f", startTime),
		"-i", inputPath,
		"-t", fmt.Sprintf("%.3f", duration),
		"-c:v", "libx264",
		"-c:a", "aac",
		"-g", "30",
		"-keyint_min", "30",
		"-sc_threshold", "0",
		"-b:v", "5000k",
		"-b:a", "128k",
		"-avoid_negative_ts", "make_zero",
		"-movflags", "+faststart",
		"-y",
		outputPath,
	}

	cmd := exec.CommandContext(ctx, vp.cfg.FFmpegPath, args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("ffmpeg split failed: %w, output: %s", err, string(output))
	}

	return nil
}

const MaxRetryCount = 3
const SegmentTimeout = 10 * time.Minute
const MergeTimeout = 30 * time.Minute
const MaxPriority = 5

func (vp *VideoProcessor) TranscodeSegment(ctx context.Context, msg mq.TranscodeMessage, workerID string) error {
	taskID, _ := uuid.Parse(msg.TaskID)

	var segment models.Segment
	if err := database.DB.Where("task_id = ? AND segment_id = ?", taskID, msg.SegmentID).First(&segment).Error; err != nil {
		return err
	}

	if segment.Status == models.StatusCompleted {
		log.Printf("Segment %d of task %s already completed, skipping", msg.SegmentID, msg.TaskID)
		return nil
	}

	now := time.Now()
	segment.Status = models.StatusProcessing
	segment.WorkerID = workerID
	segment.LastProcessAt = &now
	database.DB.Save(&segment)

	taskDir := filepath.Join(vp.workDir, msg.TaskID)
	os.MkdirAll(taskDir, 0755)
	defer os.RemoveAll(taskDir)

	inputPath := filepath.Join(taskDir, fmt.Sprintf("segment_%d_input", msg.SegmentID)+filepath.Ext(msg.InputPath))
	outputPath := filepath.Join(taskDir, fmt.Sprintf("segment_%d_output.mp4", msg.SegmentID))

	if err := vp.downloadFromMinIO(ctx, vp.minioClient.GetSegmentsBucket(), msg.InputPath, inputPath); err != nil {
		return err
	}

	watermark, err := ParseWatermarkConfig(msg.WatermarkJSON)
	if err != nil {
		log.Printf("Failed to parse watermark config: %v", err)
	}
	crop, err := ParseCropConfig(msg.CropJSON)
	if err != nil {
		log.Printf("Failed to parse crop config: %v", err)
	}

	if (watermark != nil && watermark.Enabled) || (crop != nil && crop.Enabled) {
		tempPath := filepath.Join(taskDir, fmt.Sprintf("segment_%d_temp.mp4", msg.SegmentID))
		processor := NewAdvancedProcessor(vp.cfg.FFmpegPath, vp.workDir, vp.minioClient)
		if err := processor.ApplyWatermarkAndCrop(ctx, inputPath, tempPath, watermark, crop); err != nil {
			log.Printf("Warning: watermark/crop failed, proceeding without: %v", err)
		} else {
			inputPath = tempPath
		}
	}

	var codecArgs []string
	switch msg.Codec {
	case "h265":
		codecArgs = []string{
			"-c:v", "libx265",
			"-crf", "28",
			"-preset", "medium",
		}
	case "av1":
		codecArgs = []string{
			"-c:v", "libaom-av1",
			"-crf", "30",
			"-b:v", "0",
		}
	default:
		codecArgs = []string{"-c:v", "libx264"}
	}

	if msg.TargetBitrate != "" {
		codecArgs = append(codecArgs, "-b:v", msg.TargetBitrate)
		if msg.MaxBitrate != "" {
			codecArgs = append(codecArgs, "-maxrate", msg.MaxBitrate, "-bufsize", msg.TargetBitrate)
		}
	}

	args := append([]string{
		"-i", inputPath,
	}, codecArgs...)

	args = append(args,
		"-c:a", "aac",
		"-b:a", "128k",
		"-movflags", "+faststart",
		"-y",
		outputPath,
	)

	cmd := exec.CommandContext(ctx, vp.cfg.FFmpegPath, args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		segment.Status = models.StatusFailed
		segment.ErrorMsg = fmt.Sprintf("Transcode failed: %v, output: %s", err, string(output))
		database.DB.Save(&segment)
		return fmt.Errorf(segment.ErrorMsg)
	}

	file, err := os.Open(outputPath)
	if err != nil {
		segment.Status = models.StatusFailed
		segment.ErrorMsg = err.Error()
		database.DB.Save(&segment)
		return err
	}
	defer file.Close()

	stat, _ := file.Stat()
	if err := vp.minioClient.UploadSegment(ctx, msg.OutputPath, file, stat.Size()); err != nil {
		segment.Status = models.StatusFailed
		segment.ErrorMsg = err.Error()
		database.DB.Save(&segment)
		return err
	}

	segment.Status = models.StatusCompleted
	database.DB.Save(&segment)

	vp.updateTaskProgress(taskID)

	return nil
}

func (vp *VideoProcessor) updateTaskProgress(taskID uuid.UUID) {
	var task models.Task
	if err := database.DB.First(&task, "id = ?", taskID).Error; err != nil {
		return
	}

	var completedCount int64
	database.DB.Model(&models.Segment{}).Where("task_id = ? AND status = ?", taskID, models.StatusCompleted).Count(&completedCount)

	task.SegmentsDone = int(completedCount)

	if task.SegmentCount > 0 {
		task.Progress = int(float64(completedCount) / float64(task.SegmentCount) * 100)
	}

	if completedCount == int64(task.SegmentCount) {
		task.Status = models.StatusMerging
		database.DB.Save(&task)

		vp.mqClient.PublishMergeTask(context.Background(), mq.MergeMessage{
			TaskID:       taskID.String(),
			SegmentCount: task.SegmentCount,
			Codec:        string(task.Codec),
			Duration:     task.Duration,
		})
	} else {
		database.DB.Save(&task)
	}
}

func (vp *VideoProcessor) MergeSegments(ctx context.Context, msg mq.MergeMessage) error {
	taskID, _ := uuid.Parse(msg.TaskID)

	var task models.Task
	if err := database.DB.First(&task, "id = ?", taskID).Error; err != nil {
		return err
	}

	if task.Status == models.StatusCompleted {
		log.Printf("Merge task %s already completed, skipping", taskID)
		return nil
	}

	task.Status = models.StatusMerging
	database.DB.Save(&task)

	taskDir := filepath.Join(vp.workDir, msg.TaskID)
	os.MkdirAll(taskDir, 0755)
	defer os.RemoveAll(taskDir)

	listFile := filepath.Join(taskDir, "segments.txt")
	f, err := os.Create(listFile)
	if err != nil {
		return err
	}
	defer f.Close()

	for i := 0; i < msg.SegmentCount; i++ {
		segPath := filepath.Join(taskDir, fmt.Sprintf("segment_%d_output.mp4", i))
		objectName := fmt.Sprintf("%s/segment_%d_output.mp4", msg.TaskID, i)

		if err := vp.downloadFromMinIO(ctx, vp.minioClient.GetSegmentsBucket(), objectName, segPath); err != nil {
			return err
		}

		f.WriteString(fmt.Sprintf("file '%s'\n", segPath))
	}
	f.Close()

	outputPath := filepath.Join(taskDir, "final_output.mp4")
	args := []string{
		"-f", "concat",
		"-safe", "0",
		"-i", listFile,
		"-c", "copy",
		"-movflags", "+faststart",
		"-y",
		outputPath,
	}

	cmd := exec.CommandContext(ctx, vp.cfg.FFmpegPath, args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		task.Status = models.StatusFailed
		task.ErrorMsg = fmt.Sprintf("Merge failed: %v, output: %s", err, string(output))
		database.DB.Save(&task)
		return fmt.Errorf(task.ErrorMsg)
	}

	taskConfig := task.GetConfig()
	processor := NewAdvancedProcessor(vp.cfg.FFmpegPath, vp.workDir, vp.minioClient)

	if task.OutputFormat == models.FormatHLS && taskConfig.HLS.Enabled {
		task.Status = models.StatusPackaging
		database.DB.Save(&task)

		hlsDir := filepath.Join(taskDir, "hls")
		if err := processor.PackageHLS(ctx, outputPath, hlsDir, taskConfig.HLS); err != nil {
			log.Printf("HLS packaging failed, falling back to MP4: %v", err)
		} else {
			playlistPath, err := processor.UploadStreamToStorage(ctx, hlsDir, msg.TaskID, "hls")
			if err == nil {
				task.OutputURL = playlistPath
			}
		}
	}

	if task.OutputFormat == models.FormatDASH && taskConfig.DASH.Enabled {
		task.Status = models.StatusPackaging
		database.DB.Save(&task)

		dashDir := filepath.Join(taskDir, "dash")
		if err := processor.PackageDASH(ctx, outputPath, dashDir, taskConfig.DASH); err != nil {
			log.Printf("DASH packaging failed, falling back to MP4: %v", err)
		} else {
			manifestPath, err := processor.UploadStreamToStorage(ctx, dashDir, msg.TaskID, "dash")
			if err == nil {
				task.OutputURL = manifestPath
			}
		}
	}

	if task.OutputURL == "" {
		file, err := os.Open(outputPath)
		if err != nil {
			task.Status = models.StatusFailed
			task.ErrorMsg = err.Error()
			database.DB.Save(&task)
			return err
		}
		defer file.Close()

		stat, _ := file.Stat()
		outputObjectName := fmt.Sprintf("%s_output.mp4", taskID)
		if err := vp.minioClient.UploadOutput(ctx, outputObjectName, file, stat.Size()); err != nil {
			task.Status = models.StatusFailed
			task.ErrorMsg = err.Error()
			database.DB.Save(&task)
			return err
		}
		task.OutputURL = outputObjectName
		task.OutputSize = stat.Size()
	}

	task.Status = models.StatusCompleted
	task.Progress = 100
	now := time.Now()
	task.CompletedAt = &now
	database.DB.Save(&task)

	return nil
}

func (vp *VideoProcessor) downloadFromMinIO(ctx context.Context, bucket, objectName, localPath string) error {
	obj, err := vp.minioClient.GetSegment(ctx, objectName)
	if err != nil {
		if bucket == vp.minioClient.GetInputBucket() {
			obj, err = vp.minioClient.GetInput(ctx, objectName)
		} else if bucket == vp.minioClient.GetOutputBucket() {
			obj, err = vp.minioClient.GetOutput(ctx, objectName)
		}
	}
	if err != nil {
		return err
	}
	defer obj.Close()

	file, err := os.Create(localPath)
	if err != nil {
		return err
	}
	defer file.Close()

	_, err = io.Copy(file, obj)
	return err
}

func (vp *VideoProcessor) StartSplitWatcher() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		var tasks []models.Task
		database.DB.Where("status = ?", models.StatusSplitting).Find(&tasks)

		for _, task := range tasks {
			go func(t models.Task) {
				ctx := context.Background()
				if err := vp.SplitVideo(ctx, t.ID); err != nil {
					log.Printf("Failed to split video for task %s: %v", t.ID, err)
					t.Status = models.StatusFailed
					t.ErrorMsg = err.Error()
					database.DB.Save(&t)
				}
			}(task)
		}
	}
}

func (vp *VideoProcessor) StartDLQReProcessor() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	log.Println("DLQ reprocessor started")

	for range ticker.C {
		vp.processDLQMessages()
	}
}

func (vp *VideoProcessor) processDLQMessages() {
	ctx := context.Background()

	transcodeDLQ := mq.QueueTranscode + "_dlq"
	for {
		msg, ok, err := vp.mqClient.GetMessage(ctx, transcodeDLQ)
		if err != nil {
			log.Printf("Failed to get message from transcode DLQ: %v", err)
			break
		}
		if !ok {
			break
		}

		var transcodeMsg mq.TranscodeMessage
		if err := json.Unmarshal(msg, &transcodeMsg); err != nil {
			log.Printf("Failed to unmarshal DLQ message: %v", err)
			continue
		}

		log.Printf("Recovered transcode task from DLQ: task=%s, segment=%d",
			transcodeMsg.TaskID, transcodeMsg.SegmentID)

		segmentID, _ := uuid.Parse(transcodeMsg.TaskID)
		var segment models.Segment
		if err := database.DB.Where("task_id = ? AND segment_id = ?",
			segmentID, transcodeMsg.SegmentID).First(&segment).Error; err == nil {
			if segment.RetryCount < MaxRetryCount {
				segment.RetryCount++
				segment.Status = models.StatusQueued
				segment.WorkerID = ""
				segment.LastProcessAt = nil
				database.DB.Save(&segment)

				priority := uint8(MaxPriority) - uint8(segment.RetryCount)
				vp.mqClient.PublishTranscodeTaskWithPriority(ctx, transcodeMsg, priority)
			}
		}
	}

	mergeDLQ := mq.QueueMerge + "_dlq"
	for {
		msg, ok, err := vp.mqClient.GetMessage(ctx, mergeDLQ)
		if err != nil {
			log.Printf("Failed to get message from merge DLQ: %v", err)
			break
		}
		if !ok {
			break
		}

		var mergeMsg mq.MergeMessage
		if err := json.Unmarshal(msg, &mergeMsg); err != nil {
			log.Printf("Failed to unmarshal DLQ merge message: %v", err)
			continue
		}

		log.Printf("Recovered merge task from DLQ: task=%s", mergeMsg.TaskID)
		vp.mqClient.PublishMergeTask(ctx, mergeMsg)
	}
}

func (vp *VideoProcessor) StartTimeoutWatcher() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	log.Println("Timeout watcher started")

	for range ticker.C {
		vp.checkStaleSegments()
		vp.checkStaleMergeTasks()
	}
}

func (vp *VideoProcessor) checkStaleSegments() {
	var segments []models.Segment
	now := time.Now()

	database.DB.Where("status = ?", models.StatusProcessing).Find(&segments)

	for _, segment := range segments {
		if segment.LastProcessAt == nil {
			continue
		}

		elapsed := now.Sub(*segment.LastProcessAt)
		if elapsed > SegmentTimeout {
			log.Printf("Segment %d of task %s timed out after %v, retry count: %d",
				segment.SegmentID, segment.TaskID, elapsed, segment.RetryCount)

			if segment.RetryCount >= MaxRetryCount {
				log.Printf("Segment %d exceeded max retry count %d, marking as failed",
					segment.SegmentID, MaxRetryCount)
				segment.Status = models.StatusFailed
				segment.ErrorMsg = fmt.Sprintf("Exceeded max retry count (%d)", MaxRetryCount)
				database.DB.Save(&segment)
				continue
			}

			segment.RetryCount++
			segment.Status = models.StatusQueued
			segment.WorkerID = ""
			segment.LastProcessAt = nil
			database.DB.Save(&segment)

			ctx := context.Background()
			msg := mq.TranscodeMessage{
				TaskID:     segment.TaskID.String(),
				SegmentID:  segment.SegmentID,
				InputPath:  segment.InputPath,
				OutputPath: segment.OutputPath,
				Duration:   segment.Duration,
				StartTime:  segment.StartTime,
			}

			var task models.Task
			if err := database.DB.First(&task, "id = ?", segment.TaskID).Error; err == nil {
				msg.Codec = string(task.Codec)
			}

			priority := uint8(MaxPriority) - uint8(segment.RetryCount)
			if err := vp.mqClient.PublishTranscodeTaskWithPriority(ctx, msg, priority); err != nil {
				log.Printf("Failed to requeue segment %d: %v", segment.SegmentID, err)
			}
		}
	}
}

func (vp *VideoProcessor) checkStaleMergeTasks() {
	var tasks []models.Task
	now := time.Now()

	database.DB.Where("status = ?", models.StatusMerging).Find(&tasks)

	for _, task := range tasks {
		if task.UpdatedAt.IsZero() {
			continue
		}

		elapsed := now.Sub(task.UpdatedAt)
		if elapsed > MergeTimeout {
			log.Printf("Merge task %s timed out after %v, requeuing", task.ID, elapsed)
			task.Status = models.StatusProcessing
			database.DB.Save(&task)

			ctx := context.Background()
			vp.mqClient.PublishMergeTask(ctx, mq.MergeMessage{
				TaskID:       task.ID.String(),
				SegmentCount: task.SegmentCount,
				Codec:        string(task.Codec),
				Duration:     task.Duration,
			})
		}
	}
}

func (vp *VideoProcessor) StartWorker(workerID string) {
	log.Printf("Starting worker %s", workerID)

	go func() {
		vp.mqClient.ConsumeTranscodeTasks(func(msg mq.TranscodeMessage) error {
			ctx, cancel := context.WithTimeout(context.Background(), SegmentTimeout)
			defer cancel()
			log.Printf("Worker %s processing segment %d for task %s", workerID, msg.SegmentID, msg.TaskID)
			return vp.TranscodeSegment(ctx, msg, workerID)
		})
	}()

	go func() {
		vp.mqClient.ConsumeMergeTasks(func(msg mq.MergeMessage) error {
			ctx, cancel := context.WithTimeout(context.Background(), MergeTimeout)
			defer cancel()
			log.Printf("Processing merge for task %s", msg.TaskID)
			return vp.MergeSegments(ctx, msg)
		})
	}()
}

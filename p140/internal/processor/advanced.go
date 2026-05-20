package processor

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/video-transcoder/internal/database"
	"github.com/video-transcoder/internal/models"
	"github.com/video-transcoder/internal/mq"
	"github.com/video-transcoder/internal/storage"
)

type AdvancedProcessor struct {
	ffmpegPath string
	ffprobePath string
	workDir    string
	storage    *storage.MinIOClient
}

func NewAdvancedProcessor(ffmpegPath, workDir string, storage *storage.MinIOClient) *AdvancedProcessor {
	return &AdvancedProcessor{
		ffmpegPath:  ffmpegPath,
		ffprobePath: "ffprobe",
		workDir:     workDir,
		storage:     storage,
	}
}

func (ap *AdvancedProcessor) AnalyzeVideoComplexity(ctx context.Context, inputPath string, segmentCount int) ([]models.SceneAnalysis, error) {
	log.Printf("Analyzing video complexity: %s", inputPath)

	analysis := make([]models.SceneAnalysis, segmentCount)
	segmentDuration, err := ap.getVideoDuration(inputPath)
	if err != nil {
		return nil, err
	}
	segmentDuration = segmentDuration / float64(segmentCount)

	for i := 0; i < segmentCount; i++ {
		startTime := float64(i) * segmentDuration
		complexity, motion, err := ap.analyzeSegmentComplexity(inputPath, startTime, segmentDuration)
		if err != nil {
			log.Printf("Failed to analyze segment %d: %v", i, err)
			complexity = 0.5
			motion = 0.5
		}

		bitrate := ap.calculateOptimalBitrate(complexity, motion)

		analysis[i] = models.SceneAnalysis{
			SegmentID:  i,
			Complexity: complexity,
			Motion:     motion,
			Bitrate:    bitrate,
		}

		log.Printf("Segment %d: complexity=%.2f, motion=%.2f, bitrate=%s", i, complexity, motion, bitrate)
	}

	return analysis, nil
}

func (ap *AdvancedProcessor) analyzeSegmentComplexity(inputPath string, startTime, duration float64) (float64, float64, error) {
	tempDir, err := os.MkdirTemp(ap.workDir, "analyze")
	if err != nil {
		return 0.5, 0.5, err
	}
	defer os.RemoveAll(tempDir)

	framesPath := filepath.Join(tempDir, "frames")
	os.MkdirAll(framesPath, 0755)

	args := []string{
		"-ss", fmt.Sprintf("%.3f", startTime),
		"-t", fmt.Sprintf("%.3f", duration),
		"-i", inputPath,
		"-vf", "select='eq(pict_type,PICT_TYPE_I)'",
		"-vsync", "vfr",
		"-frames:v", "10",
		filepath.Join(framesPath, "frame_%03d.tiff"),
	}

	cmd := exec.Command(ap.ffmpegPath, args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return 0.5, 0.5, fmt.Errorf("frame extraction failed: %w, output: %s", err, string(output))
	}

	files, err := filepath.Glob(filepath.Join(framesPath, "*.tiff"))
	if err != nil || len(files) == 0 {
		return 0.5, 0.5, nil
	}

	totalSize := int64(0)
	for _, f := range files {
		if fi, err := os.Stat(f); err == nil {
			totalSize += fi.Size()
		}
	}

	avgSize := float64(totalSize) / float64(len(files))
	complexity := ap.normalizeComplexity(avgSize)

	motion, err := ap.estimateMotion(inputPath, startTime, duration)
	if err != nil {
		motion = 0.5
	}

	return complexity, motion, nil
}

func (ap *AdvancedProcessor) normalizeComplexity(avgFrameSize float64) float64 {
	baseSize := 500000.0
	complexity := avgFrameSize / baseSize
	if complexity < 0.1 {
		complexity = 0.1
	}
	if complexity > 1.0 {
		complexity = 1.0
	}
	return complexity
}

func (ap *AdvancedProcessor) estimateMotion(inputPath string, startTime, duration float64) (float64, error) {
	args := []string{
		"-ss", fmt.Sprintf("%.3f", startTime),
		"-t", fmt.Sprintf("%.3f", duration),
		"-i", inputPath,
		"-filter:v", "tblend=all_mode=difference,signalstats",
		"-f", "null",
		"-",
	}

	cmd := exec.Command(ap.ffmpegPath, args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return 0.5, nil
	}

	outputStr := string(output)
	if strings.Contains(outputStr, "avg") {
		if idx := strings.Index(outputStr, "avg="); idx != -1 {
			remaining := outputStr[idx+4:]
			if end := strings.IndexAny(remaining, " \n\t"); end != -1 {
				avgStr := remaining[:end]
				if avg, err := strconv.ParseFloat(avgStr, 64); err == nil {
					motion := avg / 100.0
					if motion < 0 {
						motion = 0
					}
					if motion > 1 {
						motion = 1
					}
					return motion, nil
				}
			}
		}
	}

	return 0.5, nil
}

func (ap *AdvancedProcessor) calculateOptimalBitrate(complexity, motion float64) string {
	baseBitrate := 2000000.0

	factor := 0.5 + complexity*0.3 + motion*0.2

	bitrate := baseBitrate * factor

	if bitrate < 500000 {
		bitrate = 500000
	}
	if bitrate > 10000000 {
		bitrate = 10000000
	}

	return fmt.Sprintf("%.0f", bitrate)
}

func (ap *AdvancedProcessor) getVideoDuration(inputPath string) (float64, error) {
	cmd := exec.Command(ap.ffprobePath,
		"-v", "error",
		"-show_entries", "format=duration",
		"-of", "csv=p=0",
		inputPath,
	)

	output, err := cmd.Output()
	if err != nil {
		return 0, err
	}

	durationStr := strings.TrimSpace(string(output))
	return strconv.ParseFloat(durationStr, 64)
}

func (ap *AdvancedProcessor) ApplyWatermarkAndCrop(ctx context.Context, inputPath, outputPath string, watermark *models.WatermarkConfig, crop *models.CropConfig) error {
	var filters []string
	var filterStrings []string

	if crop != nil && crop.Enabled {
		filter := fmt.Sprintf("crop=%d:%d:%d:%d", crop.Width, crop.Height, crop.X, crop.Y)
		filterStrings = append(filterStrings, filter)
	}

	if watermark != nil && watermark.Enabled {
		if watermark.ImageURL != "" {
			watermarkPath := filepath.Join(ap.workDir, "watermark.png")
			if err := ap.downloadWatermarkImage(ctx, watermark.ImageURL, watermarkPath); err != nil {
				return err
			}
			defer os.Remove(watermarkPath)

			overlayX, overlayY := ap.getWatermarkPosition(watermark.Position, watermark.PaddingX, watermark.PaddingY)
			overlay := fmt.Sprintf("[1:v]scale=iw*%f:-1[wm];[0:v][wm]overlay=%s:%s:alpha=%f",
				watermark.Scale, overlayX, overlayY, watermark.Opacity)
			filterStrings = append(filterStrings, overlay)
			filters = append(filters, "-i", watermarkPath)
		} else if watermark.Text != "" {
			textFilter := fmt.Sprintf("drawtext=text='%s':x=%s:y=%s:fontsize=%d:fontcolor=%s:alpha=%f",
				watermark.Text,
				ap.getTextPositionX(watermark.Position, watermark.PaddingX),
				ap.getTextPositionY(watermark.Position, watermark.PaddingY),
				watermark.FontSize, watermark.FontColor, watermark.Opacity)
			filterStrings = append(filterStrings, textFilter)
		}
	}

	args := []string{"-i", inputPath}
	args = append(args, filters...)
	if len(filterStrings) > 0 {
		args = append(args, "-filter_complex", strings.Join(filterStrings, ","))
	}
	args = append(args, "-c:a", "copy", "-y", outputPath)

	cmd := exec.CommandContext(ctx, ap.ffmpegPath, args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("watermark/crop failed: %w, output: %s", err, string(output))
	}

	return nil
}

func (ap *AdvancedProcessor) downloadWatermarkImage(ctx context.Context, url, localPath string) error {
	if strings.HasPrefix(url, "http") {
		cmd := exec.Command("curl", "-o", localPath, url)
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("failed to download watermark: %w", err)
		}
	} else {
		src, err := os.Open(url)
		if err != nil {
			return err
		}
		defer src.Close()

		dst, err := os.Create(localPath)
		if err != nil {
			return err
		}
		defer dst.Close()

		_, err = io.Copy(dst, src)
		return err
	}
	return nil
}

func (ap *AdvancedProcessor) getWatermarkPosition(position models.WatermarkPosition, paddingX, paddingY int) (string, string) {
	xPad := fmt.Sprintf("%d", paddingX)
	yPad := fmt.Sprintf("%d", paddingY)

	switch position {
	case models.WatermarkTopLeft:
		return xPad, yPad
	case models.WatermarkTopRight:
		return fmt.Sprintf("W-w-%s", xPad), yPad
	case models.WatermarkBottomLeft:
		return xPad, fmt.Sprintf("H-h-%s", yPad)
	case models.WatermarkBottomRight:
		return fmt.Sprintf("W-w-%s", xPad), fmt.Sprintf("H-h-%s", yPad)
	case models.WatermarkCenter:
		return "(W-w)/2", "(H-h)/2"
	default:
		return xPad, yPad
	}
}

func (ap *AdvancedProcessor) getTextPositionX(position models.WatermarkPosition, padding int) string {
	pad := fmt.Sprintf("%d", padding)
	switch position {
	case models.WatermarkTopRight, models.WatermarkBottomRight:
		return fmt.Sprintf("W-tw-%s", pad)
	case models.WatermarkCenter:
		return "(W-tw)/2"
	default:
		return pad
	}
}

func (ap *AdvancedProcessor) getTextPositionY(position models.WatermarkPosition, padding int) string {
	pad := fmt.Sprintf("%d", padding)
	switch position {
	case models.WatermarkBottomLeft, models.WatermarkBottomRight:
		return fmt.Sprintf("H-th-%s", pad)
	case models.WatermarkCenter:
		return "(H-th)/2"
	default:
		return pad
	}
}

func (ap *AdvancedProcessor) PackageHLS(ctx context.Context, inputPath, outputDir string, config models.HLSConfig) error {
	log.Printf("Packaging HLS output to: %s", outputDir)
	os.MkdirAll(outputDir, 0755)

	playlistPath := filepath.Join(outputDir, "playlist.m3u8")
	segmentPattern := filepath.Join(outputDir, "segment_%03d.ts")

	args := []string{
		"-i", inputPath,
		"-c:v", "libx264",
		"-c:a", "aac",
		"-b:a", "128k",
		"-hls_time", fmt.Sprintf("%d", config.SegmentDuration),
		"-hls_list_size", "0",
		"-hls_segment_filename", segmentPattern,
	}

	if config.PlaylistType != "" {
		args = append(args, "-hls_playlist_type", config.PlaylistType)
	}

	if config.Encrypted {
		keyInfoPath := filepath.Join(outputDir, "key_info.txt")
		keyPath := filepath.Join(outputDir, "encryption.key")
		keyURL := config.KeyURL
		if keyURL == "" {
			keyURL = "encryption.key"
		}

		cmd := exec.Command("openssl", "rand", "16", "-out", keyPath)
		if err := cmd.Run(); err != nil {
			log.Printf("Failed to generate encryption key: %v", err)
		} else {
			keyInfo := fmt.Sprintf("%s\n%s\n", keyURL, keyPath)
			os.WriteFile(keyInfoPath, []byte(keyInfo), 0644)
			args = append(args, "-hls_key_info_file", keyInfoPath)
		}
	}

	args = append(args, "-y", playlistPath)

	cmd := exec.CommandContext(ctx, ap.ffmpegPath, args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("HLS packaging failed: %w, output: %s", err, string(output))
	}

	return nil
}

func (ap *AdvancedProcessor) PackageDASH(ctx context.Context, inputPath, outputDir string, config models.DASHConfig) error {
	log.Printf("Packaging DASH output to: %s", outputDir)
	os.MkdirAll(outputDir, 0755)

	mpdPath := filepath.Join(outputDir, "manifest.mpd")

	args := []string{
		"-i", inputPath,
		"-c:v", "libx264",
		"-c:a", "aac",
		"-b:a", "128k",
		"-f", "dash",
		"-seg_duration", fmt.Sprintf("%d", config.SegmentDuration),
		"-use_timeline", "1",
		"-use_template", "1",
		"-init_seg_name", "init_$RepresentationID$.$ext$",
		"-media_seg_name", "chunk_$RepresentationID$_$Number%05d$.$ext$",
	}

	if config.AdaptationSets {
		args = append(args, "-adaptation_sets", "id=0,streams=v id=1,streams=a")
	}

	args = append(args, "-y", mpdPath)

	cmd := exec.CommandContext(ctx, ap.ffmpegPath, args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("DASH packaging failed: %w, output: %s", err, string(output))
	}

	return nil
}

func (vp *VideoProcessor) AnalyzeSceneComplexity(ctx context.Context, taskID string) error {
	var task models.Task
	if err := database.DB.Where("id = ?", taskID).First(&task).Error; err != nil {
		return err
	}

	task.Status = models.StatusAnalyzing
	database.DB.Save(&task)

	taskDir := filepath.Join(vp.workDir, taskID)
	os.MkdirAll(taskDir, 0755)
	defer os.RemoveAll(taskDir)

	ext := filepath.Ext(task.Filename)
	inputObjectName := taskID + ext
	inputPath := filepath.Join(taskDir, "input"+ext)

	if err := vp.downloadFromMinIO(ctx, vp.minioClient.GetInputBucket(), inputObjectName, inputPath); err != nil {
		return fmt.Errorf("failed to download input: %w", err)
	}

	processor := NewAdvancedProcessor(vp.cfg.FFmpegPath, vp.workDir, vp.minioClient)
	analysis, err := processor.AnalyzeVideoComplexity(ctx, inputPath, task.SegmentCount)
	if err != nil {
		log.Printf("Scene analysis failed, using default bitrates: %v", err)
		return nil
	}

	task.SetSceneAnalysis(analysis)
	task.Status = models.StatusUploaded
	database.DB.Save(&task)

	log.Printf("Scene analysis completed for task %s", taskID)
	return nil
}

func (ap *AdvancedProcessor) UploadStreamToStorage(ctx context.Context, localDir, taskID, streamType string) (string, error) {
	files, err := filepath.Glob(filepath.Join(localDir, "*"))
	if err != nil {
		return "", err
	}

	basePath := fmt.Sprintf("streams/%s/%s/", taskID, streamType)

	for _, file := range files {
		fi, err := os.Stat(file)
		if err != nil || fi.IsDir() {
			continue
		}

		objectName := basePath + filepath.Base(file)
		f, err := os.Open(file)
		if err != nil {
			continue
		}
		defer f.Close()

		err = ap.storage.UploadSegment(ctx, objectName, f, fi.Size())
		if err != nil {
			log.Printf("Failed to upload stream file %s: %v", objectName, err)
		}
	}

	return basePath + "playlist.m3u8", nil
}

func ParseWatermarkConfig(jsonStr string) (*models.WatermarkConfig, error) {
	if jsonStr == "" {
		return nil, nil
	}
	var cfg models.WatermarkConfig
	err := json.Unmarshal([]byte(jsonStr), &cfg)
	return &cfg, err
}

func ParseCropConfig(jsonStr string) (*models.CropConfig, error) {
	if jsonStr == "" {
		return nil, nil
	}
	var cfg models.CropConfig
	err := json.Unmarshal([]byte(jsonStr), &cfg)
	return &cfg, err
}

func StartSceneAnalysisWatcher(mqClient *mq.RabbitMQClient, cfg *config.Config, minioClient *storage.MinIOClient) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	log.Println("Scene analysis watcher started")

	vp := NewVideoProcessor(cfg, minioClient, mqClient)

	for range ticker.C {
		var tasks []models.Task
		database.DB.Where("status = ? AND output_format = ?", models.StatusSplitting, models.FormatHLS).
			Or("status = ? AND output_format = ?", models.StatusSplitting, models.FormatDASH).
			Find(&tasks)

		for _, task := range tasks {
			go func(t models.Task) {
				ctx := context.Background()
				if err := vp.AnalyzeSceneComplexity(ctx, t.ID.String()); err != nil {
					log.Printf("Scene analysis failed for task %s: %v", t.ID, err)
				}
			}(task)
		}
	}
}

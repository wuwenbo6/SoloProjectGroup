package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"musicscore/internal/batch"
	"musicscore/internal/converter"
	"musicscore/internal/image"
	"musicscore/internal/recognition"
	"musicscore/internal/rhythm"
	"musicscore/internal/storage"
	"musicscore/internal/export"
	"musicscore/pkg/models"
)

const (
	Version = "2.0.0"
)

type Config struct {
	InputPath      string
	OutputDir      string
	ScoreType      models.ScoreType
	DBPath         string
	DenoiseLevel   int
	ThresholdValue int
	Verbose        bool
	EnableBackup   bool
	BackupRepo     string

	EnableRhythmCorrection bool
	TimeSignature         string
	Tempo                 int

	BatchInput     string
	BatchOutput    string
	BatchFormats   []string
	Transpose      int
	ChangeOctave   int
	SetDuration    float64

	CompareFormat  string
	Key            string
}

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	command := os.Args[1]

	switch command {
	case "recognize", "r":
		handleRecognize()
	case "batch", "b":
		handleBatchProcess()
	case "compare", "c":
		handleCompare()
	case "history", "h":
		handleHistory()
	case "delete", "d":
		handleDelete()
	case "backup":
		handleBackup()
	case "version", "v":
		printVersion()
	case "help", "-h", "--help":
		printUsage()
	default:
		printError("未知命令: %s", command)
		printUsage()
		os.Exit(1)
	}
}

func handleRecognize() {
	config := parseRecognizeArgs()

	if config.InputPath == "" {
		printError("必须指定输入文件路径")
		fmt.Println("\n使用 -i 或 --input 参数指定输入图像文件")
		os.Exit(1)
	}

	resolvedInput, err := resolvePath(config.InputPath)
	if err != nil {
		printError("输入路径无效: %v", err)
		os.Exit(1)
	}
	config.InputPath = resolvedInput

	if _, err := os.Stat(config.InputPath); os.IsNotExist(err) {
		printError("输入文件不存在: %s", config.InputPath)
		os.Exit(1)
	}

	if config.OutputDir == "" {
		config.OutputDir = filepath.Dir(config.InputPath)
	} else {
		resolvedOutput, err := resolvePath(config.OutputDir)
		if err != nil {
			printWarning("输出路径无效，使用输入文件所在目录: %v", err)
			config.OutputDir = filepath.Dir(config.InputPath)
		} else {
			config.OutputDir = resolvedOutput
		}
	}

	if err := os.MkdirAll(config.OutputDir, 0755); err != nil {
		printError("无法创建输出目录: %v", err)
		os.Exit(1)
	}

	if config.DBPath == "" {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			printWarning("无法获取用户主目录，使用当前目录作为数据库位置")
			config.DBPath = "./musicscore_history.db"
		} else {
			config.DBPath = filepath.Join(homeDir, ".musicscore", "history.db")
		}
	} else {
		resolvedDB, err := resolvePath(config.DBPath)
		if err == nil {
			config.DBPath = resolvedDB
		}
	}

	if err := os.MkdirAll(filepath.Dir(config.DBPath), 0755); err != nil {
		printWarning("无法创建数据库目录: %v", err)
	}

	store, err := storage.New(config.DBPath)
	if err != nil {
		printError("无法初始化存储: %v", err)
		os.Exit(1)
	}
	defer store.Close()

	history := &models.RecognitionHistory{
		InputPath: config.InputPath,
		ScoreType: config.ScoreType,
		CreatedAt: time.Now(),
		Status:    "processing",
	}
	if err := store.CreateHistory(history); err != nil {
		printWarning("无法创建历史记录: %v", err)
	}

	if config.Verbose {
		printSuccess("开始处理...")
		fmt.Printf("  输入文件: %s\n", config.InputPath)
		fmt.Printf("  输出目录: %s\n", config.OutputDir)
		fmt.Printf("  乐谱类型: %s\n", config.ScoreType)
		fmt.Printf("  降噪级别: %d\n", config.DenoiseLevel)
		fmt.Printf("  阈值: %d\n", config.ThresholdValue)
		if config.EnableRhythmCorrection {
			fmt.Printf("  节奏校正: 启用 (拍号: %s, 速度: %d BPM)\n", config.TimeSignature, config.Tempo)
		}
	}

	imgConfig := image.DefaultConfig()
	if config.DenoiseLevel > 0 {
		imgConfig.DenoiseLevel = config.DenoiseLevel
	}
	if config.ThresholdValue > 0 {
		imgConfig.ThresholdValue = config.ThresholdValue
	}

	processor := image.NewProcessor(imgConfig)
	imageResult, err := processor.ProcessImage(config.InputPath, config.ScoreType)
	if err != nil {
		updateHistoryError(store, history, fmt.Sprintf("图像处理失败: %v", err))
		printError("图像处理失败: %v", err)
		os.Exit(1)
	}

	if config.Verbose {
		printSuccess("检测到 %d 个符号", len(imageResult.Symbols))
		fmt.Printf("  处理后图像: %s\n", imageResult.ProcessedPath)
	}

	recogConfig := recognition.DefaultConfig()
	recognizer := recognition.NewRecognizer(recogConfig)
	score, err := recognizer.RecognizeSymbols(imageResult.Symbols, config.ScoreType)
	if err != nil {
		updateHistoryError(store, history, fmt.Sprintf("识别失败: %v", err))
		printError("符号识别失败: %v", err)
		os.Exit(1)
	}

	totalNotes := 0
	for _, m := range score.Measures {
		totalNotes += len(m.Notes)
	}
	if config.Verbose {
		printSuccess("识别到 %d 个音符，分布在 %d 小节中", totalNotes, len(score.Measures))
	}

	if config.EnableRhythmCorrection {
		if config.Verbose {
			fmt.Println("\n正在执行节奏校正...")
		}
		corrector := rhythm.NewCorrector(config.Tempo, config.TimeSignature)
		correctedScore, err := corrector.CorrectScore(score)
		if err != nil {
			printWarning("节奏校正失败，使用原始结果: %v", err)
		} else {
			score = correctedScore
			printSuccess("节奏校正完成")
		}
	}

	exporter := export.NewExporter()
	midiPath := filepath.Join(config.OutputDir, "output.mid")
	xmlPath := filepath.Join(config.OutputDir, "output.xml")

	if err := exporter.ExportMIDI(score, midiPath); err != nil {
		updateHistoryError(store, history, fmt.Sprintf("MIDI导出失败: %v", err))
		printError("MIDI导出失败: %v", err)
		os.Exit(1)
	}

	if err := exporter.ExportMusicXML(score, xmlPath); err != nil {
		updateHistoryError(store, history, fmt.Sprintf("MusicXML导出失败: %v", err))
		printError("MusicXML导出失败: %v", err)
		os.Exit(1)
	}

	jsonPath := filepath.Join(config.OutputDir, "output.json")
	jsonData, _ := json.MarshalIndent(score, "", "  ")
	os.WriteFile(jsonPath, jsonData, 0644)

	now := time.Now()
	history.OutputMIDI = midiPath
	history.OutputXML = xmlPath
	history.CompletedAt = &now
	history.Status = "completed"
	if err := store.UpdateHistory(history); err != nil {
		printWarning("无法更新历史记录: %v", err)
	}

	printSuccess("识别完成!")
	fmt.Println("\n输出文件:")
	fmt.Printf("  🎵 MIDI 文件:    %s\n", midiPath)
	fmt.Printf("  📄 MusicXML:    %s\n", xmlPath)
	fmt.Printf("  📋 JSON 数据:   %s\n", jsonPath)
	fmt.Printf("  🖼️  处理后图像: %s\n", imageResult.ProcessedPath)

	if config.EnableBackup {
		fmt.Println("\n正在执行备份...")
		if err := performBackup(config.BackupRepo, config.OutputDir); err != nil {
			printWarning("备份失败: %v", err)
		} else {
			printSuccess("备份完成!")
		}
	}
}

func handleBatchProcess() {
	config := parseBatchArgs()

	if config.BatchInput == "" {
		printError("必须指定批量处理输入目录 (-i 或 --input)")
		os.Exit(1)
	}

	resolvedInput, err := resolvePath(config.BatchInput)
	if err != nil {
		printError("输入目录无效: %v", err)
		os.Exit(1)
	}
	config.BatchInput = resolvedInput

	if _, err := os.Stat(config.BatchInput); os.IsNotExist(err) {
		printError("输入目录不存在: %s", config.BatchInput)
		os.Exit(1)
	}

	if config.BatchOutput == "" {
		config.BatchOutput = filepath.Join(config.BatchInput, "output")
	} else {
		resolvedOutput, err := resolvePath(config.BatchOutput)
		if err == nil {
			config.BatchOutput = resolvedOutput
		}
	}

	if err := os.MkdirAll(config.BatchOutput, 0755); err != nil {
		printError("无法创建输出目录: %v", err)
		os.Exit(1)
	}

	var operations []batch.BatchOperation
	if config.Transpose != 0 {
		operations = append(operations, batch.BatchOperation{
			Type:  batch.OpTranspose,
			Value: float64(config.Transpose),
		})
		printSuccess("添加移调操作: %+d 半音", config.Transpose)
	}
	if config.ChangeOctave != 0 {
		operations = append(operations, batch.BatchOperation{
			Type:  batch.OpChangeOctave,
			Value: float64(config.ChangeOctave),
		})
		printSuccess("添加八度变更操作: %+d", config.ChangeOctave)
	}
	if config.SetDuration > 0 {
		operations = append(operations, batch.BatchOperation{
			Type:  batch.OpSetDuration,
			Value: config.SetDuration,
		})
		printSuccess("设置统一时值: %.2f 拍", config.SetDuration)
	}

	if len(operations) == 0 {
		printWarning("未指定任何处理操作，仅执行格式转换")
	}

	if len(config.BatchFormats) == 0 {
		config.BatchFormats = []string{"json", "csv"}
	}
	fmt.Printf("输出格式: %v\n", config.BatchFormats)

	batchConfig := batch.BatchConfig{
		InputDir:   config.BatchInput,
		OutputDir:  config.BatchOutput,
		Operations: operations,
		Formats:    config.BatchFormats,
		Recursive:  false,
	}

	processor := batch.NewProcessor(batchConfig)
	result, err := processor.Process()
	if err != nil {
		printError("批量处理失败: %v", err)
		os.Exit(1)
	}

	result.PrintSummary()
}

func handleCompare() {
	config := parseCompareArgs()

	if config.InputPath == "" {
		printError("必须指定输入文件 (-i 或 --input)")
		os.Exit(1)
	}

	resolvedInput, err := resolvePath(config.InputPath)
	if err != nil {
		printError("输入路径无效: %v", err)
		os.Exit(1)
	}
	config.InputPath = resolvedInput

	if _, err := os.Stat(config.InputPath); os.IsNotExist(err) {
		printError("输入文件不存在: %s", config.InputPath)
		os.Exit(1)
	}

	data, err := os.ReadFile(config.InputPath)
	if err != nil {
		printError("无法读取输入文件: %v", err)
		os.Exit(1)
	}

	var score models.MusicScore
	if err := json.Unmarshal(data, &score); err != nil {
		printError("无法解析乐谱文件: %v", err)
		os.Exit(1)
	}

	converter := converter.NewGongcheToJianpuConverter()
	converter.Key = config.Key
	converter.Tempo = config.Tempo

	result := converter.Convert(&score)
	outputDir := filepath.Dir(config.InputPath)

	var outputPath string
	switch strings.ToLower(config.CompareFormat) {
	case "md", "markdown":
		outputPath = filepath.Join(outputDir, "comparison.md")
		if err := converter.ExportMarkdown(result, outputPath); err != nil {
			printError("导出 Markdown 失败: %v", err)
			os.Exit(1)
		}
	case "csv":
		outputPath = filepath.Join(outputDir, "comparison.csv")
		if err := converter.ExportCSV(result, outputPath); err != nil {
			printError("导出 CSV 失败: %v", err)
			os.Exit(1)
		}
	default:
		outputPath = filepath.Join(outputDir, "comparison.txt")
		if err := converter.ExportText(result, outputPath); err != nil {
			printError("导出文本失败: %v", err)
			os.Exit(1)
		}
	}

	printSuccess("工尺谱-简谱对照转换完成!")
	fmt.Printf("输出文件: %s\n", outputPath)
	fmt.Printf("\n统计信息:\n")
	fmt.Printf("  总小节数: %d\n", result.Statistics.TotalMeasures)
	fmt.Printf("  总音符数: %d\n", result.Statistics.TotalNotes)
	fmt.Printf("  每小节平均音符数: %.2f\n", result.Statistics.AverageNotesPerMeasure)
}

func handleHistory() {
	dbPath := parseDBPath()

	store, err := storage.New(dbPath)
	if err != nil {
		printError("无法初始化存储: %v", err)
		os.Exit(1)
	}
	defer store.Close()

	histories, err := store.ListHistory(50)
	if err != nil {
		printError("无法获取历史记录: %v", err)
		os.Exit(1)
	}

	if len(histories) == 0 {
		fmt.Println("暂无历史记录")
		return
	}

	fmt.Println("\n📋 识别历史记录")
	fmt.Println(strings.Repeat("=", 80))
	for _, h := range histories {
		statusIcon := "✅"
		if h.Status == "failed" {
			statusIcon = "❌"
		} else if h.Status == "processing" {
			statusIcon = "⏳"
		}

		fmt.Printf("\n%s ID: %d\n", statusIcon, h.ID)
		fmt.Printf("  输入文件: %s\n", h.InputPath)
		fmt.Printf("  乐谱类型: %s\n", h.ScoreType)
		fmt.Printf("  状态: %s\n", h.Status)
		fmt.Printf("  创建时间: %s\n", h.CreatedAt.Format("2006-01-02 15:04:05"))
		if h.CompletedAt != nil {
			fmt.Printf("  完成时间: %s\n", h.CompletedAt.Format("2006-01-02 15:04:05"))
		}
		if h.Error != nil {
			fmt.Printf("  错误: %s\n", *h.Error)
		}
	}
	fmt.Println()
}

func handleDelete() {
	if len(os.Args) < 3 {
		printError("必须指定要删除的历史记录 ID")
		fmt.Println("\n用法: musicscore delete <id>")
		os.Exit(1)
	}

	idStr := os.Args[2]
	var id int64
	_, err := fmt.Sscanf(idStr, "%d", &id)
	if err != nil {
		printError("无效的 ID: %s", idStr)
		os.Exit(1)
	}

	dbPath := parseDBPath()
	store, err := storage.New(dbPath)
	if err != nil {
		printError("无法初始化存储: %v", err)
		os.Exit(1)
	}
	defer store.Close()

	if err := store.DeleteHistory(id); err != nil {
		printError("删除失败: %v", err)
		os.Exit(1)
	}

	printSuccess("成功删除历史记录 ID: %d", id)
}

func handleBackup() {
	config := parseBackupArgs()

	if config.BackupRepo == "" {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			printError("无法获取用户主目录: %v", err)
			os.Exit(1)
		}
		config.BackupRepo = filepath.Join(homeDir, ".musicscore", "backup")
	}

	resolvedRepo, err := resolvePath(config.BackupRepo)
	if err == nil {
		config.BackupRepo = resolvedRepo
	}

	if config.OutputDir == "" {
		homeDir, _ := os.UserHomeDir()
		config.OutputDir = filepath.Join(homeDir, "Musicscore_Output")
	}

	resolvedOutput, err := resolvePath(config.OutputDir)
	if err == nil {
		config.OutputDir = resolvedOutput
	}

	fmt.Printf("备份仓库: %s\n", config.BackupRepo)
	fmt.Printf("源目录: %s\n", config.OutputDir)

	if err := performBackup(config.BackupRepo, config.OutputDir); err != nil {
		printError("备份失败: %v", err)
		os.Exit(1)
	}

	printSuccess("备份完成!")
}

func resolvePath(path string) (string, error) {
	if path == "" {
		return "", fmt.Errorf("路径为空")
	}

	path = os.ExpandEnv(path)

	if strings.HasPrefix(path, "~") {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return "", fmt.Errorf("无法获取用户主目录: %w", err)
		}
		path = filepath.Join(homeDir, path[1:])
	}

	absPath, err := filepath.Abs(path)
	if err != nil {
		return "", fmt.Errorf("无法获取绝对路径: %w", err)
	}

	return filepath.Clean(absPath), nil
}

func updateHistoryError(store *storage.Storage, history *models.RecognitionHistory, errMsg string) {
	now := time.Now()
	history.Status = "failed"
	history.Error = &errMsg
	history.CompletedAt = &now
	store.UpdateHistory(history)
}

func performBackup(repoPath, sourceDir string) error {
	if err := os.MkdirAll(repoPath, 0755); err != nil {
		return fmt.Errorf("无法创建备份目录: %w", err)
	}

	if err := checkGitRepo(repoPath); err != nil {
		fmt.Println("初始化 Git 仓库...")
		if err := initGitRepo(repoPath); err != nil {
			return fmt.Errorf("无法初始化 Git 仓库: %w", err)
		}
	}

	if _, err := os.Stat(sourceDir); os.IsNotExist(err) {
		printWarning("源目录不存在，跳过文件同步: %s", sourceDir)
		return nil
	}

	if err := syncFiles(sourceDir, repoPath); err != nil {
		return fmt.Errorf("文件同步失败: %w", err)
	}

	if err := gitCommit(repoPath); err != nil {
		return fmt.Errorf("Git 提交失败: %w", err)
	}

	return nil
}

func checkGitRepo(path string) error {
	gitDir := filepath.Join(path, ".git")
	if _, err := os.Stat(gitDir); os.IsNotExist(err) {
		return fmt.Errorf("不是 Git 仓库")
	}
	return nil
}

func initGitRepo(path string) error {
	if err := runGitCommand(path, "init"); err != nil {
		return err
	}
	if err := runGitCommand(path, "config", "user.name", "musicscore"); err != nil {
		return err
	}
	return runGitCommand(path, "config", "user.email", "musicscore@local")
}

func syncFiles(sourceDir, destDir string) error {
	return filepath.Walk(sourceDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		ext := strings.ToLower(filepath.Ext(path))
		if ext != ".mid" && ext != ".xml" && ext != ".png" && ext != ".jpg" &&
			ext != ".jpeg" && ext != ".json" && ext != ".csv" && ext != ".txt" && ext != ".md" {
			return nil
		}
		relPath, err := filepath.Rel(sourceDir, path)
		if err != nil {
			return err
		}
		destPath := filepath.Join(destDir, relPath)
		if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
			return err
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		return os.WriteFile(destPath, data, 0644)
	})
}

func gitCommit(repoPath string) error {
	if err := runGitCommand(repoPath, "add", "-A"); err != nil {
		return err
	}
	statusCmd := exec.Command("git", "status", "--porcelain")
	statusCmd.Dir = repoPath
	output, err := statusCmd.Output()
	if err != nil {
		return nil
	}
	if len(output) == 0 {
		fmt.Println("没有需要提交的更改")
		return nil
	}
	timestamp := time.Now().Format("2006-01-02 15:04:05")
	message := fmt.Sprintf("Backup %s", timestamp)
	if err := runGitCommand(repoPath, "commit", "-m", message); err != nil {
		return err
	}
	fmt.Printf("已提交: %s\n", message)
	return nil
}

func runGitCommand(dir string, args ...string) error {
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	if runtime.GOOS == "darwin" {
		cmd.Env = append(os.Environ(),
			"GIT_CONFIG_NOSYSTEM=1",
			"HOME="+os.Getenv("HOME"),
			"PATH="+os.Getenv("PATH"),
		)
	}
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git %v 失败: %w\n输出: %s", args, err, string(output))
	}
	return nil
}

func parseRecognizeArgs() *Config {
	config := &Config{
		ScoreType:              models.ScoreTypeGongche,
		EnableRhythmCorrection: false,
		TimeSignature:          "4/4",
		Tempo:                  60,
	}
	args := os.Args[2:]
	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "-i", "--input":
			if i+1 < len(args) {
				config.InputPath = args[i+1]
				i++
			} else {
				printError("-i/--input 参数需要指定文件路径")
			}
		case "-o", "--output":
			if i+1 < len(args) {
				config.OutputDir = args[i+1]
				i++
			}
		case "-t", "--type":
			if i+1 < len(args) {
				scoreType := strings.ToLower(args[i+1])
				switch scoreType {
				case "gongche", "g", "工尺谱":
					config.ScoreType = models.ScoreTypeGongche
				case "jianzi", "j", "减字谱":
					config.ScoreType = models.ScoreTypeJianzi
				default:
					printWarning("未知的乐谱类型 '%s'，使用默认的工尺谱", scoreType)
				}
				i++
			}
		case "--db":
			if i+1 < len(args) {
				config.DBPath = args[i+1]
				i++
			}
		case "--denoise":
			if i+1 < len(args) {
				var level int
				_, err := fmt.Sscanf(args[i+1], "%d", &level)
				if err != nil {
					printWarning("无效的降噪级别 '%s'，使用默认值", args[i+1])
				} else {
					config.DenoiseLevel = level
				}
				i++
			}
		case "--threshold":
			if i+1 < len(args) {
				var value int
				_, err := fmt.Sscanf(args[i+1], "%d", &value)
				if err != nil {
					printWarning("无效的阈值 '%s'，使用默认值", args[i+1])
				} else {
					config.ThresholdValue = value
				}
				i++
			}
		case "-v", "--verbose":
			config.Verbose = true
		case "--backup":
			config.EnableBackup = true
			if i+1 < len(args) && !strings.HasPrefix(args[i+1], "-") {
				config.BackupRepo = args[i+1]
				i++
			}
		case "--correct-rhythm":
			config.EnableRhythmCorrection = true
		case "--time-signature":
			if i+1 < len(args) {
				config.TimeSignature = args[i+1]
				i++
			}
		case "--tempo":
			if i+1 < len(args) {
				var tempo int
				fmt.Sscanf(args[i+1], "%d", &tempo)
				config.Tempo = tempo
				i++
			}
		default:
			if config.InputPath == "" && !isFlag(args[i]) {
				config.InputPath = args[i]
			} else if isFlag(args[i]) {
				printWarning("未知参数: %s", args[i])
			}
		}
	}
	return config
}

func parseBatchArgs() *Config {
	config := &Config{
		BatchFormats: []string{"json", "csv"},
	}
	args := os.Args[2:]
	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "-i", "--input":
			if i+1 < len(args) {
				config.BatchInput = args[i+1]
				i++
			}
		case "-o", "--output":
			if i+1 < len(args) {
				config.BatchOutput = args[i+1]
				i++
			}
		case "-f", "--format":
			if i+1 < len(args) {
				formats := strings.Split(args[i+1], ",")
				config.BatchFormats = formats
				i++
			}
		case "--transpose":
			if i+1 < len(args) {
				val, err := converter.ParseTransposeValue(args[i+1])
				if err != nil {
					printWarning("无效的移调值 '%s'，已忽略", args[i+1])
				} else {
					config.Transpose = val
				}
				i++
			}
		case "--octave":
			if i+1 < len(args) {
				var val int
				fmt.Sscanf(args[i+1], "%d", &val)
				config.ChangeOctave = val
				i++
			}
		case "--duration":
			if i+1 < len(args) {
				var val float64
				fmt.Sscanf(args[i+1], "%f", &val)
				config.SetDuration = val
				i++
			}
		}
	}
	return config
}

func parseCompareArgs() *Config {
	config := &Config{
		CompareFormat: "txt",
		Key:           "C",
		Tempo:         60,
	}
	args := os.Args[2:]
	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "-i", "--input":
			if i+1 < len(args) {
				config.InputPath = args[i+1]
				i++
			}
		case "-f", "--format":
			if i+1 < len(args) {
				config.CompareFormat = args[i+1]
				i++
			}
		case "-k", "--key":
			if i+1 < len(args) {
				config.Key = args[i+1]
				i++
			}
		case "--tempo":
			if i+1 < len(args) {
				fmt.Sscanf(args[i+1], "%d", &config.Tempo)
				i++
			}
		}
	}
	return config
}

func parseDBPath() string {
	args := os.Args[2:]
	for i := 0; i < len(args); i++ {
		if args[i] == "--db" && i+1 < len(args) {
			resolved, err := resolvePath(args[i+1])
			if err == nil {
				return resolved
			}
			return args[i+1]
		}
	}
	homeDir, _ := os.UserHomeDir()
	return filepath.Join(homeDir, ".musicscore", "history.db")
}

func parseBackupArgs() *Config {
	config := &Config{}
	args := os.Args[2:]
	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "--repo":
			if i+1 < len(args) {
				config.BackupRepo = args[i+1]
				i++
			}
		case "--source":
			if i+1 < len(args) {
				config.OutputDir = args[i+1]
				i++
			}
		}
	}
	return config
}

func isFlag(arg string) bool {
	return len(arg) > 0 && arg[0] == '-'
}

func printError(format string, args ...interface{}) {
	fmt.Printf("❌ 错误: ")
	fmt.Printf(format+"\n", args...)
}

func printWarning(format string, args ...interface{}) {
	fmt.Printf("⚠️  警告: ")
	fmt.Printf(format+"\n", args...)
}

func printSuccess(format string, args ...interface{}) {
	fmt.Printf("✅ ")
	fmt.Printf(format+"\n", args...)
}

func printVersion() {
	fmt.Printf("🎵 musicscore v%s\n", Version)
	fmt.Println("传统乐谱识别工具 - 工尺谱/减字谱 → MIDI/MusicXML")
}

func printUsage() {
	fmt.Println("")
	printVersion()
	fmt.Println("")
	fmt.Println("📖 用法:")
	fmt.Println("")
	fmt.Println("  1. 识别乐谱:")
	fmt.Println("     musicscore recognize|r [选项] <输入图像>")
	fmt.Println("")
	fmt.Println("  2. 批量处理:")
	fmt.Println("     musicscore batch|b [选项]")
	fmt.Println("")
	fmt.Println("  3. 工尺谱-简谱对照:")
	fmt.Println("     musicscore compare|c [选项]")
	fmt.Println("")
	fmt.Println("  4. 查看历史:")
	fmt.Println("     musicscore history|h [选项]")
	fmt.Println("")
	fmt.Println("  5. 删除历史:")
	fmt.Println("     musicscore delete|d <id>")
	fmt.Println("")
	fmt.Println("  6. 备份数据:")
	fmt.Println("     musicscore backup [选项]")
	fmt.Println("")

	fmt.Println("🔧 识别选项:")
	fmt.Println("  -i, --input <路径>         输入图像文件 (PNG/JPG)")
	fmt.Println("  -o, --output <目录>        输出目录 (默认: 与输入文件同目录)")
	fmt.Println("  -t, --type <类型>          乐谱类型: gongche|g|工尺谱, jianzi|j|减字谱 (默认: gongche)")
	fmt.Println("  --db <路径>                数据库路径")
	fmt.Println("  --denoise <级别>           降噪级别 (默认: 3)")
	fmt.Println("  --threshold <值>          二值化阈值 (默认: 127)")
	fmt.Println("  -v, --verbose              显示详细处理信息")
	fmt.Println("  --backup [仓库路径]        启用 Git 备份")
	fmt.Println("  --correct-rhythm          启用节奏自动校正")
	fmt.Println("  --time-signature <拍号>    拍号设置 (默认: 4/4)")
	fmt.Println("  --tempo <速度>            速度设置 BPM (默认: 60)")
	fmt.Println("")

	fmt.Println("📦 批量处理选项:")
	fmt.Println("  -i, --input <目录>        输入目录")
	fmt.Println("  -o, --output <目录>       输出目录")
	fmt.Println("  -f, --format <格式>       输出格式: json,csv (逗号分隔)")
	fmt.Println("  --transpose <半音数>      移调 (如: 2=#2, -3=b3)")
	fmt.Println("  --octave <变化数>         八度调整")
	fmt.Println("  --duration <时值>         统一设置音符时值 (拍)")
	fmt.Println("")

	fmt.Println("📊 对照转换选项:")
	fmt.Println("  -i, --input <文件>        输入 JSON 乐谱文件")
	fmt.Println("  -f, --format <格式>       输出格式: txt, md, csv (默认: txt)")
	fmt.Println("  -k, --key <调号>          调号 (默认: C)")
	fmt.Println("  --tempo <速度>            速度 BPM (默认: 60)")
	fmt.Println("")

	fmt.Println("💾 备份选项:")
	fmt.Println("  --repo <路径>             Git 仓库路径")
	fmt.Println("  --source <目录>           源目录")
	fmt.Println("")

	fmt.Println("📝 示例:")
	fmt.Println("  # 识别工尺谱，启用节奏校正")
	fmt.Println("  musicscore r -i score.png -t gongche --correct-rhythm -v")
	fmt.Println("")
	fmt.Println("  # 批量处理，移调+2，输出JSON和CSV")
	fmt.Println("  musicscore b -i ./scores -o ./out -f json,csv --transpose 2")
	fmt.Println("")
	fmt.Println("  # 生成工尺谱-简谱对照表")
	fmt.Println("  musicscore compare -i output.json -f md -k G")
	fmt.Println("")
	fmt.Println("  # 查看识别历史")
	fmt.Println("  musicscore history")
	fmt.Println("")
	fmt.Println("  # 备份识别结果到Git")
	fmt.Println("  musicscore backup --repo ~/music_backup")
	fmt.Println("")
}

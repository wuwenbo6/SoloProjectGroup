package scheduler

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"
)

type BackupSchedule struct {
	Enabled      bool   `json:"enabled"`
	Interval     string `json:"interval"` // daily, weekly, hourly
	IntervalHours int   `json:"interval_hours"`
	Remote       string `json:"remote"`
	Branch       string `json:"branch"`
	LastBackup   string `json:"last_backup"`
}

type Scheduler struct {
	configDir string
}

func NewScheduler() (*Scheduler, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	configDir := filepath.Join(homeDir, ".snippets")
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return nil, err
	}
	return &Scheduler{configDir: configDir}, nil
}

func (s *Scheduler) GetSchedule() (*BackupSchedule, error) {
	configFile := filepath.Join(s.configDir, "schedule.json")
	data, err := os.ReadFile(configFile)
	if err != nil {
		if os.IsNotExist(err) {
			return &BackupSchedule{
				Enabled:       false,
				Interval:      "daily",
				IntervalHours: 24,
				Branch:        "main",
			}, nil
		}
		return nil, err
	}

	var schedule BackupSchedule
	if err := json.Unmarshal(data, &schedule); err != nil {
		return nil, err
	}
	return &schedule, nil
}

func (s *Scheduler) SaveSchedule(schedule *BackupSchedule) error {
	configFile := filepath.Join(s.configDir, "schedule.json")
	data, err := json.MarshalIndent(schedule, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(configFile, data, 0644)
}

func (s *Scheduler) RunBackup() error {
	schedule, err := s.GetSchedule()
	if err != nil {
		return err
	}

	if !schedule.Enabled {
		return nil
	}

	now := time.Now()
	if schedule.LastBackup != "" {
		lastBackup, err := time.Parse(time.RFC3339, schedule.LastBackup)
		if err == nil {
			hoursSince := now.Sub(lastBackup).Hours()
			if hoursSince < float64(schedule.IntervalHours) {
				return nil
			}
		}
	}

	cmd := exec.Command(os.Args[0], "backup")
	if schedule.Remote != "" {
		cmd.Args = append(cmd.Args, "-R", schedule.Remote)
	}
	if schedule.Branch != "" {
		cmd.Args = append(cmd.Args, "-b", schedule.Branch)
	}

	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("backup failed: %v, output: %s", err, string(output))
	}

	schedule.LastBackup = now.Format(time.RFC3339)
	return s.SaveSchedule(schedule)
}

func (s *Scheduler) SetupCronJob() error {
	if runtime.GOOS == "windows" {
		return s.setupWindowsScheduler()
	}
	return s.setupUnixCron()
}

func (s *Scheduler) setupUnixCron() error {
	exePath, err := os.Executable()
	if err != nil {
		return err
	}

	schedule, err := s.GetSchedule()
	if err != nil {
		return err
	}

	var cronSchedule string
	switch schedule.Interval {
	case "hourly":
		cronSchedule = "0 * * * *"
	case "daily":
		cronSchedule = "0 2 * * *"
	case "weekly":
		cronSchedule = "0 2 * * 0"
	default:
		cronSchedule = fmt.Sprintf("0 */%d * * *", schedule.IntervalHours)
	}

	cronLine := fmt.Sprintf("%s %s backup >> %s 2>&1\n",
		cronSchedule, exePath, filepath.Join(s.configDir, "backup.log"))

	currentCrontab, _ := exec.Command("crontab", "-l").Output()
	lines := strings.Split(string(currentCrontab), "\n")

	var newCrontab []string
	for _, line := range lines {
		if strings.Contains(line, "snippets backup") {
			continue
		}
		if strings.TrimSpace(line) != "" {
			newCrontab = append(newCrontab, line)
		}
	}
	newCrontab = append(newCrontab, cronLine)

	cmd := exec.Command("crontab", "-")
	cmd.Stdin = strings.NewReader(strings.Join(newCrontab, "\n") + "\n")
	return cmd.Run()
}

func (s *Scheduler) setupWindowsScheduler() error {
	exePath, err := os.Executable()
	if err != nil {
		return err
	}

	schedule, err := s.GetSchedule()
	if err != nil {
		return err
	}

	taskName := "SnippetsAutoBackup"

	exec.Command("schtasks", "/delete", "/tn", taskName, "/f").Run()

	var scheduleArg string
	switch schedule.Interval {
	case "hourly":
		scheduleArg = "HOURLY"
	case "daily":
		scheduleArg = "DAILY"
	case "weekly":
		scheduleArg = "WEEKLY"
	default:
		scheduleArg = "DAILY"
	}

	cmd := exec.Command("schtasks", "/create", "/tn", taskName,
		"/tr", fmt.Sprintf("\"%s\" backup", exePath),
		"/sc", scheduleArg,
		"/st", "02:00",
		"/f")

	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to create task: %v, output: %s", err, string(output))
	}
	return nil
}

func (s *Scheduler) RemoveCronJob() error {
	if runtime.GOOS == "windows" {
		cmd := exec.Command("schtasks", "/delete", "/tn", "SnippetsAutoBackup", "/f")
		return cmd.Run()
	}

	currentCrontab, _ := exec.Command("crontab", "-l").Output()
	lines := strings.Split(string(currentCrontab), "\n")

	var newCrontab []string
	for _, line := range lines {
		if !strings.Contains(line, "snippets backup") && strings.TrimSpace(line) != "" {
			newCrontab = append(newCrontab, line)
		}
	}

	cmd := exec.Command("crontab", "-")
	cmd.Stdin = strings.NewReader(strings.Join(newCrontab, "\n") + "\n")
	return cmd.Run()
}

func ParseInterval(interval string) (int, error) {
	switch strings.ToLower(interval) {
	case "hourly":
		return 1, nil
	case "daily":
		return 24, nil
	case "weekly":
		return 168, nil
	}

	if strings.HasSuffix(interval, "h") {
		hours, err := strconv.Atoi(strings.TrimSuffix(interval, "h"))
		if err == nil {
			return hours, nil
		}
	}

	return 24, fmt.Errorf("invalid interval: %s (use: hourly, daily, weekly, NNh)", interval)
}

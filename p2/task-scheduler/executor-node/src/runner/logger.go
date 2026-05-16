package runner

import (
	"os"
	"path/filepath"
	"time"
)

func WriteTaskLog(taskID string, content string) error {
	logDir := "logs"
	if err := os.MkdirAll(logDir, 0755); err != nil {
		return err
	}

	logFile := filepath.Join(logDir, taskID+".log")

	f, err := os.OpenFile(logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer f.Close()

	timestamp := time.Now().Format("2006-01-02 15:04:05")
	logContent := "[" + timestamp + "] " + content + "\n"

	_, err = f.WriteString(logContent)
	return err
}

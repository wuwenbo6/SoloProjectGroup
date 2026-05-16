package client

import (
	"bytes"
	"encoding/json"
	"net/http"
	"time"
)

type SchedulerClient struct {
	BaseURL    string
	ExecutorID string
	HTTPClient *http.Client
}

func NewSchedulerClient(baseURL string, executorID string) *SchedulerClient {
	return &SchedulerClient{
		BaseURL:    baseURL,
		ExecutorID: executorID,
		HTTPClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (c *SchedulerClient) UpdateTaskStatus(taskID, status, log string) error {
	url := c.BaseURL + "/api/v1/callback/task/status"

	payload := map[string]string{
		"task_id":     taskID,
		"status":      status,
		"log":         log,
		"executor_id": c.ExecutorID,
	}

	data, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(data))
	req.Header.Set("Content-Type", "application/json")

	_, err := c.HTTPClient.Do(req)
	return err
}

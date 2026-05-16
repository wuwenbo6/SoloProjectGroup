package runner

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

func ExecuteHTTPRequest(requestData map[string]interface{}, timeout int) (string, error) {
	if timeout == 0 {
		timeout = 300
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeout)*time.Second)
	defer cancel()

	method := "GET"
	if m, ok := requestData["method"].(string); ok {
		method = m
	}

	url := ""
	if u, ok := requestData["url"].(string); ok {
		url = u
	}

	var body io.Reader
	if b, ok := requestData["body"]; ok {
		bodyData, _ := json.Marshal(b)
		body = bytes.NewBuffer(bodyData)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return "Failed to create request: " + err.Error(), err
	}

	if headers, ok := requestData["headers"].(map[string]interface{}); ok {
		for k, v := range headers {
			if strVal, ok := v.(string); ok {
				req.Header.Set(k, strVal)
			}
		}
	}

	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{
		Timeout: time.Duration(timeout) * time.Second,
	}

	type result struct {
		resp *http.Response
		err  error
	}

	resultChan := make(chan result, 1)

	go func() {
		resp, err := client.Do(req)
		resultChan <- result{resp, err}
	}()

	select {
	case <-ctx.Done():
		client.CloseIdleConnections()
		return fmt.Sprintf("HTTP request timed out after %d seconds", timeout), ctx.Err()
	case res := <-resultChan:
		if res.err != nil {
			return "HTTP request failed: " + res.err.Error(), res.err
		}
		defer res.resp.Body.Close()

		respBody, err := io.ReadAll(res.resp.Body)
		if err != nil {
			return "Failed to read response: " + err.Error(), err
		}

		return string(respBody), nil
	}
}

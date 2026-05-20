package loki

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/ebpf-cni/netpol-ebpf/pkg/ebpf"
)

type Client struct {
	url         string
	client      *http.Client
	eventChan   chan ebpf.ConnLogEvent
	labels      map[string]string
	ctx         context.Context
	cancel      context.CancelFunc
	wg          sync.WaitGroup
	buffer      []ebpf.ConnLogEvent
	bufferSize  int
	flushInterval time.Duration
	mu          sync.Mutex
}

type LokiEntry struct {
	Stream map[string]string `json:"stream"`
	Values [][]interface{}   `json:"values"`
}

func NewClient(lokiURL string, extraLabels map[string]string) *Client {
	ctx, cancel := context.WithCancel(context.Background())
	
	labels := map[string]string{
		"source": "ebpf-netpol",
	}
	for k, v := range extraLabels {
		labels[k] = v
	}
	
	return &Client{
		url:           lokiURL,
		client:        &http.Client{Timeout: 10 * time.Second},
		eventChan:     make(chan ebpf.ConnLogEvent, 1024),
		labels:        labels,
		ctx:           ctx,
		cancel:        cancel,
		bufferSize:    100,
		flushInterval: 5 * time.Second,
	}
}

func (c *Client) Events() chan<- ebpf.ConnLogEvent {
	return c.eventChan
}

func (c *Client) Start() {
	c.wg.Add(2)
	go c.runCollector()
	go c.runFlusher()
}

func (c *Client) Stop() {
	c.cancel()
	c.wg.Wait()
}

func (c *Client) runCollector() {
	defer c.wg.Done()
	
	for {
		select {
		case <-c.ctx.Done():
			return
		case event := <-c.eventChan:
			c.mu.Lock()
			c.buffer = append(c.buffer, event)
			if len(c.buffer) >= c.bufferSize {
				c.flushLocked()
			}
			c.mu.Unlock()
		}
	}
}

func (c *Client) runFlusher() {
	defer c.wg.Done()
	
	ticker := time.NewTicker(c.flushInterval)
	defer ticker.Stop()
	
	for {
		select {
		case <-c.ctx.Done():
			c.mu.Lock()
			c.flushLocked()
			c.mu.Unlock()
			return
		case <-ticker.C:
			c.mu.Lock()
			c.flushLocked()
			c.mu.Unlock()
		}
	}
}

func (c *Client) flushLocked() {
	if len(c.buffer) == 0 {
		return
	}
	
	if err := c.sendBatch(c.buffer); err != nil {
		log.Printf("Failed to send logs to Loki: %v", err)
	}
	
	c.buffer = nil
}

func (c *Client) sendBatch(events []ebpf.ConnLogEvent) error {
	if len(events) == 0 {
		return nil
	}
	
	values := make([][]interface{}, 0, len(events))
	for _, event := range events {
		timestamp := strconv.FormatInt(event.GetTime().UnixNano(), 10)
		line := c.formatLogLine(&event)
		values = append(values, []interface{}{timestamp, line})
	}
	
	entry := LokiEntry{
		Stream: c.labels,
		Values: values,
	}
	
	payload, err := json.Marshal(map[string]interface{}{
		"streams": []LokiEntry{entry},
	})
	if err != nil {
		return fmt.Errorf("marshaling payload: %v", err)
	}
	
	req, err := http.NewRequestWithContext(c.ctx, "POST", c.url+"/loki/api/v1/push", bytes.NewBuffer(payload))
	if err != nil {
		return fmt.Errorf("creating request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	
	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("sending request: %v", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}
	
	return nil
}

func (c *Client) formatLogLine(event *ebpf.ConnLogEvent) string {
	action := "ALLOW"
	switch event.Action {
	case ebpf.ActionDeny:
		action = "DENY"
	case ebpf.ActionRateLimit:
		action = "RATE_LIMIT"
	}
	
	proto := "TCP"
	if event.Proto == 17 {
		proto = "UDP"
	}
	
	return fmt.Sprintf(
		"src=%s:%d dst=%s:%d proto=%s bytes_tx=%d bytes_rx=%d packets_tx=%d packets_rx=%d duration_ms=%d action=%s",
		event.GetSrcIP(), event.SrcPort,
		event.GetDstIP(), event.DstPort,
		proto,
		event.BytesTx, event.BytesRx,
		event.PacketsTx, event.PacketsRx,
		event.DurationMs,
		action,
	)
}

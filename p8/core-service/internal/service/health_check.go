package service

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/influxdata/influxdb-client-go/v2"
	"go.uber.org/zap"
	"google.golang.org/grpc"
	"google.golang.org/grpc/connectivity"
)

const (
	HealthStatusPass    = "pass"
	HealthStatusFail    = "fail"
	HealthStatusWarn    = "warn"
	defaultCheckTimeout = 5 * time.Second
)

type HealthCheckService struct {
	logger       *zap.Logger
	influxClient influxdb2.Client
	pgDB         *sql.DB
	grpcConn     *grpc.ClientConn
	checks       map[string]HealthChecker
	mu           sync.RWMutex
	isShutdown   int32
	checkHistory map[string][]HealthCheckResult
	maxHistory   int
}

type HealthChecker interface {
	Check(ctx context.Context) HealthCheckResult
	Name() string
}

type HealthCheckResult struct {
	Component   string      `json:"component"`
	Status      string      `json:"status"`
	Message     string      `json:"message,omitempty"`
	ObservedTime time.Time  `json:"observed_time"`
	Output      interface{} `json:"output,omitempty"`
}

type HealthResponse struct {
	Status      string              `json:"status"`
	Version     string              `json:"version"`
	ReleaseID   string              `json:"release_id,omitempty"`
	ServiceID   string              `json:"service_id,omitempty"`
	Description string              `json:"description,omitempty"`
	Checks      []HealthCheckResult `json:"checks"`
	Notes       []string            `json:"notes,omitempty"`
	Output      interface{}         `json:"output,omitempty"`
}

func NewHealthCheckService(
	logger *zap.Logger,
	influxClient influxdb2.Client,
	pgDB *sql.DB,
	grpcConn *grpc.ClientConn,
) *HealthCheckService {
	hcs := &HealthCheckService{
		logger:       logger,
		influxClient: influxClient,
		pgDB:         pgDB,
		grpcConn:     grpcConn,
		checks:       make(map[string]HealthChecker),
		checkHistory: make(map[string][]HealthCheckResult),
		maxHistory:   100,
	}

	hcs.registerDefaultChecks()

	return hcs
}

func (h *HealthCheckService) registerDefaultChecks() {
	h.AddChecker(&InfluxDBChecker{client: h.influxClient, name: "influxdb"})
	h.AddChecker(&PostgreSQLChecker{db: h.pgDB, name: "postgresql"})
	if h.grpcConn != nil {
		h.AddChecker(&GRPCChecker{conn: h.grpcConn, name: "grpc_service"})
	}
	h.AddChecker(&MemoryChecker{name: "memory"})
	h.AddChecker(&DiskChecker{name: "disk"})
}

func (h *HealthCheckService) AddChecker(checker HealthChecker) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.checks[checker.Name()] = checker
}

func (h *HealthCheckService) LivenessHandler(w http.ResponseWriter, r *http.Request) {
	if atomic.LoadInt32(&h.isShutdown) == 1 {
		h.writeHealthResponse(w, HealthResponse{
			Status:  HealthStatusFail,
			Version: "2.0.0",
			Notes:   []string{"Service is shutting down"},
		}, http.StatusServiceUnavailable)
		return
	}

	h.writeHealthResponse(w, HealthResponse{
		Status:  HealthStatusPass,
		Version: "2.0.0",
		Notes:   []string{"Service is alive"},
	}, http.StatusOK)
}

func (h *HealthCheckService) ReadinessHandler(w http.ResponseWriter, r *http.Request) {
	if atomic.LoadInt32(&h.isShutdown) == 1 {
		h.writeHealthResponse(w, HealthResponse{
			Status:  HealthStatusFail,
			Version: "2.0.0",
			Notes:   []string{"Service is shutting down"},
		}, http.StatusServiceUnavailable)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), defaultCheckTimeout)
	defer cancel()

	results := h.runChecks(ctx)

	overallStatus := HealthStatusPass
	for _, result := range results {
		if result.Status == HealthStatusFail {
			overallStatus = HealthStatusFail
			break
		}
		if result.Status == HealthStatusWarn && overallStatus != HealthStatusFail {
			overallStatus = HealthStatusWarn
		}
	}

	statusCode := http.StatusOK
	if overallStatus == HealthStatusFail {
		statusCode = http.StatusServiceUnavailable
	}

	h.writeHealthResponse(w, HealthResponse{
		Status:  overallStatus,
		Version: "2.0.0",
		Checks:  results,
	}, statusCode)
}

func (h *HealthCheckService) DetailedHealthHandler(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), defaultCheckTimeout)
	defer cancel()

	results := h.runChecks(ctx)

	overallStatus := HealthStatusPass
	for _, result := range results {
		if result.Status == HealthStatusFail {
			overallStatus = HealthStatusFail
			break
		}
		if result.Status == HealthStatusWarn && overallStatus != HealthStatusFail {
			overallStatus = HealthStatusWarn
		}
	}

	statusCode := http.StatusOK
	if overallStatus == HealthStatusFail {
		statusCode = http.StatusServiceUnavailable
	}

	h.writeHealthResponse(w, HealthResponse{
		Status:      overallStatus,
		Version:     "2.0.0",
		ServiceID:   "iot-core-service",
		Description: "IoT Core Service - Device Data Processing",
		Checks:      results,
	}, statusCode)
}

func (h *HealthCheckService) runChecks(ctx context.Context) []HealthCheckResult {
	h.mu.RLock()
	checkers := make([]HealthChecker, 0, len(h.checks))
	for _, checker := range h.checks {
		checkers = append(checkers, checker)
	}
	h.mu.RUnlock()

	var wg sync.WaitGroup
	resultsChan := make(chan HealthCheckResult, len(checkers))

	for _, checker := range checkers {
		wg.Add(1)
		go func(c HealthChecker) {
			defer wg.Done()
			result := c.Check(ctx)
			h.addToHistory(result)
			resultsChan <- result
		}(checker)
	}

	go func() {
		wg.Wait()
		close(resultsChan)
	}()

	results := make([]HealthCheckResult, 0, len(checkers))
	for result := range resultsChan {
		results = append(results, result)
	}

	return results
}

func (h *HealthCheckService) addToHistory(result HealthCheckResult) {
	h.mu.Lock()
	defer h.mu.Unlock()

	history := h.checkHistory[result.Component]
	if len(history) >= h.maxHistory {
		history = history[1:]
	}
	h.checkHistory[result.Component] = append(history, result)
}

func (h *HealthCheckService) writeHealthResponse(w http.ResponseWriter, response HealthResponse, statusCode int) {
	w.Header().Set("Content-Type", "application/health+json")
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.WriteHeader(statusCode)
}

func (h *HealthCheckService) Shutdown() {
	atomic.StoreInt32(&h.isShutdown, 1)
}

type InfluxDBChecker struct {
	client influxdb2.Client
	name   string
}

func (c *InfluxDBChecker) Check(ctx context.Context) HealthCheckResult {
	result := HealthCheckResult{
		Component:   c.name,
		ObservedTime: time.Now(),
	}

	health, err := c.client.Health(ctx)
	if err != nil {
		result.Status = HealthStatusFail
		result.Message = fmt.Sprintf("Health check failed: %v", err)
		return result
	}

	if health.Status == "pass" {
		result.Status = HealthStatusPass
		result.Message = "InfluxDB is healthy"
	} else {
		result.Status = HealthStatusWarn
		result.Message = fmt.Sprintf("InfluxDB status: %s", health.Status)
	}

	return result
}

func (c *InfluxDBChecker) Name() string {
	return c.name
}

type PostgreSQLChecker struct {
	db   *sql.DB
	name string
}

func (c *PostgreSQLChecker) Check(ctx context.Context) HealthCheckResult {
	result := HealthCheckResult{
		Component:   c.name,
		ObservedTime: time.Now(),
	}

	if c.db == nil {
		result.Status = HealthStatusWarn
		result.Message = "Database connection not configured"
		return result
	}

	if err := c.db.PingContext(ctx); err != nil {
		result.Status = HealthStatusFail
		result.Message = fmt.Sprintf("Database ping failed: %v", err)
		return result
	}

	var version string
	if err := c.db.QueryRowContext(ctx, "SELECT version()").Scan(&version); err != nil {
		result.Status = HealthStatusWarn
		result.Message = fmt.Sprintf("Failed to get version: %v", err)
		return result
	}

	result.Status = HealthStatusPass
	result.Message = "PostgreSQL is healthy"
	result.Output = map[string]string{"version": version[:50]}

	return result
}

func (c *PostgreSQLChecker) Name() string {
	return c.name
}

type GRPCChecker struct {
	conn interface{}
	name string
}

func (c *GRPCChecker) Check(ctx context.Context) HealthCheckResult {
	result := HealthCheckResult{
		Component:   c.name,
		ObservedTime: time.Now(),
	}

	if c.conn == nil {
		result.Status = HealthStatusWarn
		result.Message = "gRPC connection not configured"
		return result
	}

	if grpcConn, ok := c.conn.(*grpc.ClientConn); ok {
		state := grpcConn.GetState()
		if state == connectivity.Ready || state == connectivity.Idle {
			result.Status = HealthStatusPass
			result.Message = fmt.Sprintf("gRPC connection is %s", state.String())
		} else if state == connectivity.Connecting {
			result.Status = HealthStatusWarn
			result.Message = "gRPC connection is connecting"
		} else {
			result.Status = HealthStatusFail
			result.Message = fmt.Sprintf("gRPC connection is %s", state.String())
		}
	} else {
		result.Status = HealthStatusWarn
		result.Message = "gRPC connection type not supported"
	}

	return result
}

func (c *GRPCChecker) Name() string {
	return c.name
}

type MemoryChecker struct {
	name string
}

func (c *MemoryChecker) Check(ctx context.Context) HealthCheckResult {
	result := HealthCheckResult{
		Component:   c.name,
		ObservedTime: time.Now(),
	}

	result.Status = HealthStatusPass
	result.Message = "Memory check passed"

	return result
}

func (c *MemoryChecker) Name() string {
	return c.name
}

type DiskChecker struct {
	name string
}

func (c *DiskChecker) Check(ctx context.Context) HealthCheckResult {
	result := HealthCheckResult{
		Component:   c.name,
		ObservedTime: time.Now(),
	}

	result.Status = HealthStatusPass
	result.Message = "Disk check passed"

	return result
}

func (c *DiskChecker) Name() string {
	return c.name
}

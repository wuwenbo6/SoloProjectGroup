package main

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
)

type Span struct {
	TraceId           string            `json:"trace_id"`
	SpanId            string            `json:"span_id"`
	ParentSpanId      string            `json:"parent_span_id"`
	Name              string            `json:"name"`
	Kind              string            `json:"kind"`
	StartTimeUnixNano int64             `json:"start_time_unix_nano"`
	EndTimeUnixNano   int64             `json:"end_time_unix_nano"`
	Duration          int64             `json:"duration"`
	Attributes        map[string]string `json:"attributes"`
	ServiceName       string            `json:"service_name"`
	StatusCode        int32             `json:"status_code"`
	StatusMessage     string            `json:"status_message"`
}

type Trace struct {
	TraceId      string   `json:"trace_id"`
	ServiceNames []string `json:"service_names"`
	SpanCount    int32    `json:"span_count"`
	ErrorCount   int32    `json:"error_count"`
	StartTime    int64    `json:"start_time"`
	EndTime      int64    `json:"end_time"`
	Duration     int64    `json:"duration"`
	Spans        []Span   `json:"spans"`
}

type Aggregator struct {
	conn driver.Conn
}

func NewAggregator(dsn string) (*Aggregator, error) {
	opts, err := clickhouse.ParseDSN(dsn)
	if err != nil {
		return nil, err
	}

	conn, err := clickhouse.Open(opts)
	if err != nil {
		return nil, err
	}

	return &Aggregator{conn: conn}, nil
}

func (a *Aggregator) GetTraceById(ctx context.Context, traceId string) (*Trace, error) {
	rows, err := a.conn.Query(ctx, `
		SELECT
			trace_id,
			span_id,
			parent_span_id,
			name,
			kind,
			toUnixTimestamp64Nano(start_time),
			toUnixTimestamp64Nano(end_time),
			duration,
			attributes,
			service_name,
			status_code,
			status_message
		FROM traces.spans
		WHERE trace_id = ?
		ORDER BY start_time ASC
	`, traceId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var spans []Span
	for rows.Next() {
		var span Span
		err := rows.Scan(
			&span.TraceId,
			&span.SpanId,
			&span.ParentSpanId,
			&span.Name,
			&span.Kind,
			&span.StartTimeUnixNano,
			&span.EndTimeUnixNano,
			&span.Duration,
			&span.Attributes,
			&span.ServiceName,
			&span.StatusCode,
			&span.StatusMessage,
		)
		if err != nil {
			return nil, err
		}
		spans = append(spans, span)
	}

	if len(spans) == 0 {
		return nil, nil
	}

	serviceNames := make(map[string]bool)
	var errorCount int32
	var minTime, maxTime int64

	for i, span := range spans {
		serviceNames[span.ServiceName] = true
		if span.StatusCode != 0 {
			errorCount++
		}
		if i == 0 {
			minTime = span.StartTimeUnixNano
		}
		if span.EndTimeUnixNano > maxTime {
			maxTime = span.EndTimeUnixNano
		}
	}

	serviceList := make([]string, 0, len(serviceNames))
	for name := range serviceNames {
		serviceList = append(serviceList, name)
	}

	return &Trace{
		TraceId:      traceId,
		ServiceNames: serviceList,
		SpanCount:    int32(len(spans)),
		ErrorCount:   errorCount,
		StartTime:    minTime,
		EndTime:      maxTime,
		Duration:     maxTime - minTime,
		Spans:        spans,
	}, nil
}

func (a *Aggregator) GetTopology(ctx context.Context, startTime, endTime time.Time) (map[string]interface{}, error) {
	rows, err := a.conn.Query(ctx, `
		SELECT
			parent.service_name as source,
			child.service_name as target,
			count(*) as call_count,
			avg(child.duration) as avg_duration,
			sumIf(1, child.status_code != 0) as error_count
		FROM traces.spans child
		LEFT JOIN traces.spans parent ON child.parent_span_id = parent.span_id
		WHERE child.start_time BETWEEN ? AND ?
		  AND parent.service_name != ''
		  AND child.service_name != ''
		GROUP BY source, target
	`, startTime, endTime)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	nodes := make(map[string]bool)
	var edges []map[string]interface{}

	for rows.Next() {
		var source, target string
		var callCount int64
		var avgDuration float64
		var errorCount int64

		err := rows.Scan(&source, &target, &callCount, &avgDuration, &errorCount)
		if err != nil {
			return nil, err
		}

		nodes[source] = true
		nodes[target] = true

		edges = append(edges, map[string]interface{}{
			"source":      source,
			"target":      target,
			"call_count":  callCount,
			"avg_duration": avgDuration,
			"error_count": errorCount,
		})
	}

	nodeList := make([]map[string]interface{}, 0, len(nodes))
	for name := range nodes {
		nodeList = append(nodeList, map[string]interface{}{
			"id":    name,
			"label": name,
		})
	}

	return map[string]interface{}{
		"nodes": nodeList,
		"edges": edges,
	}, nil
}

func (a *Aggregator) GetServiceList(ctx context.Context) ([]string, error) {
	rows, err := a.conn.Query(ctx, `
		SELECT DISTINCT service_name
		FROM traces.spans
		WHERE service_name != ''
		ORDER BY service_name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var services []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		services = append(services, name)
	}

	return services, nil
}

func (a *Aggregator) GetTraces(ctx context.Context, service string, startTime, endTime time.Time, limit int) ([]map[string]interface{}, error) {
	query := `
		SELECT
			trace_id,
			groupUniqArray(service_name) as service_names,
			count() as span_count,
			sumIf(1, status_code != 0) as error_count,
			min(start_time) as start_time,
			max(end_time) as end_time,
			max(end_time) - min(start_time) as duration
		FROM traces.spans
		WHERE start_time BETWEEN ? AND ?
	`
	args := []interface{}{startTime, endTime}

	if service != "" {
		query += ` AND trace_id IN (SELECT DISTINCT trace_id FROM traces.spans WHERE service_name = ?)`
		args = append(args, service)
	}

	query += ` GROUP BY trace_id ORDER BY start_time DESC LIMIT ?`
	args = append(args, limit)

	rows, err := a.conn.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var traces []map[string]interface{}
	for rows.Next() {
		var traceId string
		var serviceNames []string
		var spanCount, errorCount int64
		var start, end time.Time
		var duration int64

		err := rows.Scan(&traceId, &serviceNames, &spanCount, &errorCount, &start, &end, &duration)
		if err != nil {
			return nil, err
		}

		traces = append(traces, map[string]interface{}{
			"trace_id":      traceId,
			"service_names": serviceNames,
			"span_count":    spanCount,
			"error_count":   errorCount,
			"start_time":    start.UnixNano(),
			"end_time":      end.UnixNano(),
			"duration":      duration,
		})
	}

	return traces, nil
}

func main() {
	log.Println("Aggregator module is integrated with query-service")
}

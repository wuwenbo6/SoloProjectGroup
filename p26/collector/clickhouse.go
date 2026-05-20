package main

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
	pb "github.com/tracetrace/proto"
)

type ClickHouseClient struct {
	conn clickhouse.Conn
}

func NewClickHouseClient(dsn string) (*ClickHouseClient, error) {
	opts, err := clickhouse.ParseDSN(dsn)
	if err != nil {
		return nil, err
	}

	opts.Settings = clickhouse.Settings{
		"max_execution_time": 60,
		"insert_quorum":      0,
	}

	opts.MaxOpenConns = 32
	opts.MaxIdleConns = 16
	opts.ConnMaxLifetime = time.Hour
	opts.ConnMaxIdleTime = 30 * time.Minute

	conn, err := clickhouse.Open(opts)
	if err != nil {
		return nil, err
	}

	if err := conn.Ping(context.Background()); err != nil {
		return nil, err
	}

	return &ClickHouseClient{conn: conn}, nil
}

func (c *ClickHouseClient) Close() error {
	return c.conn.Close()
}

func (c *ClickHouseClient) CreateTables() error {
	queries := []string{
		`CREATE DATABASE IF NOT EXISTS traces`,
		`CREATE TABLE IF NOT EXISTS traces.spans (
			trace_id String,
			span_id String,
			parent_span_id String,
			trace_state String,
			name String,
			kind String,
			start_time DateTime64(9),
			end_time DateTime64(9),
			duration Int64,
			attributes Map(String, String),
			events String,
			links String,
			status_message String,
			status_code Int32,
			service_name String,
			resource_attributes String,
			insert_time DateTime DEFAULT now()
		) ENGINE = MergeTree()
		ORDER BY (trace_id, start_time)
		PARTITION BY toDate(start_time)
		TTL toDate(start_time) + INTERVAL 7 DAY
		SETTINGS index_granularity = 8192`,
		`CREATE TABLE IF NOT EXISTS traces.trace_summary (
			trace_id String,
			service_names Array(String),
			span_count Int32,
			error_count Int32,
			start_time DateTime64(9),
			end_time DateTime64(9),
			duration Int64,
			update_time DateTime DEFAULT now()
		) ENGINE = ReplacingMergeTree(update_time)
		ORDER BY trace_id`,
		`CREATE MATERIALIZED VIEW IF NOT EXISTS traces.trace_summary_mv
		TO traces.trace_summary AS
		SELECT
			trace_id,
			groupUniqArray(service_name) as service_names,
			count() as span_count,
			sumIf(1, status_code != 0) as error_count,
			min(start_time) as start_time,
			max(end_time) as end_time,
			max(end_time) - min(start_time) as duration
		FROM traces.spans
		GROUP BY trace_id`,
	}

	for _, q := range queries {
		if err := c.conn.Exec(context.Background(), q); err != nil {
			return fmt.Errorf("failed to execute query %s: %w", q, err)
		}
	}
	return nil
}

func (c *ClickHouseClient) InsertSpans(ctx context.Context, spans []*pb.Span) error {
	if len(spans) == 0 {
		return nil
	}

	batch, err := c.conn.PrepareBatch(ctx, `
		INSERT INTO traces.spans (
			trace_id, span_id, parent_span_id, trace_state, name, kind,
			start_time, end_time, duration, attributes, events, links,
			status_message, status_code, service_name, resource_attributes
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return fmt.Errorf("failed to prepare batch: %w", err)
	}

	for _, span := range spans {
		attrs := make(map[string]string)
		for _, attr := range span.Attributes {
			switch v := attr.Value.(type) {
			case *pb.KeyValue_StringValue:
				attrs[attr.Key] = v.StringValue
			case *pb.KeyValue_IntValue:
				attrs[attr.Key] = fmt.Sprintf("%d", v.IntValue)
			case *pb.KeyValue_DoubleValue:
				attrs[attr.Key] = fmt.Sprintf("%f", v.DoubleValue)
			case *pb.KeyValue_BoolValue:
				attrs[attr.Key] = fmt.Sprintf("%t", v.BoolValue)
			}
		}

		eventsJSON, _ := json.Marshal(span.Events)
		linksJSON, _ := json.Marshal(span.Links)
		duration := span.EndTimeUnixNano - span.StartTimeUnixNano

		err := batch.Append(
			span.TraceId,
			span.SpanId,
			span.ParentSpanId,
			span.TraceState,
			span.Name,
			span.Kind,
			time.Unix(0, span.StartTimeUnixNano),
			time.Unix(0, span.EndTimeUnixNano),
			duration,
			attrs,
			string(eventsJSON),
			string(linksJSON),
			span.Status.Message,
			span.Status.Code,
			span.ServiceName,
			span.ResourceAttributesJson,
		)
		if err != nil {
			batch.Abort()
			return fmt.Errorf("failed to append span to batch: %w", err)
		}
	}

	if err := batch.Send(); err != nil {
		return fmt.Errorf("failed to send batch: %w", err)
	}

	return nil
}

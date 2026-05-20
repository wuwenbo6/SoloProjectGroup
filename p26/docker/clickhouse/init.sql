CREATE DATABASE IF NOT EXISTS traces;

CREATE TABLE IF NOT EXISTS traces.spans (
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
TTL toDate(start_time) + INTERVAL 7 DAY;

CREATE TABLE IF NOT EXISTS traces.trace_summary (
    trace_id String,
    service_names Array(String),
    span_count Int32,
    error_count Int32,
    start_time DateTime64(9),
    end_time DateTime64(9),
    duration Int64,
    update_time DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(update_time)
ORDER BY trace_id;

CREATE MATERIALIZED VIEW IF NOT EXISTS traces.trace_summary_mv
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
GROUP BY trace_id;

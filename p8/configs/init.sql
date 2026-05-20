CREATE TABLE IF NOT EXISTS devices (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(64) UNIQUE NOT NULL,
    device_name VARCHAR(128),
    device_type VARCHAR(64),
    status VARCHAR(32) DEFAULT 'online',
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS device_metadata (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(64) REFERENCES devices(device_id) ON DELETE CASCADE,
    key VARCHAR(64) NOT NULL,
    value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(device_id, key)
);

CREATE TABLE IF NOT EXISTS anomaly_records (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(64) NOT NULL,
    anomaly_type VARCHAR(64) NOT NULL,
    confidence DOUBLE PRECISION NOT NULL,
    metric VARCHAR(64),
    "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL,
    description TEXT,
    data_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_anomaly_device_id ON anomaly_records(device_id);
CREATE INDEX IF NOT EXISTS idx_anomaly_timestamp ON anomaly_records("timestamp");
CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);

CREATE DATABASE IF NOT EXISTS trace_db;

\c trace_db;

CREATE TABLE IF NOT EXISTS trace_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL,
  trace_type VARCHAR(50) NOT NULL,
  operation_type VARCHAR(50) NOT NULL,
  operation_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  operator_id UUID,
  operator_name VARCHAR(50),
  location VARCHAR(200),
  longitude DECIMAL(10, 7),
  latitude DECIMAL(10, 7),
  temperature DECIMAL(5, 2),
  humidity DECIMAL(5, 2),
  description TEXT,
  equipment_info JSONB,
  next_process VARCHAR(100),
  previous_record_id UUID,
  is_valid BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS origin_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL,
  harvest_date DATE,
  plot_number VARCHAR(50),
  soil_type VARCHAR(50),
  fertilizer_info TEXT,
  pesticide_info TEXT,
  irrigation_info TEXT,
  farmer_name VARCHAR(50),
  farmer_contact VARCHAR(50),
  quality_check_result TEXT,
  inspector_id UUID,
  inspector_name VARCHAR(50),
  inspection_date TIMESTAMP,
  photos JSONB,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS processing_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL,
  process_stage VARCHAR(50) NOT NULL,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  workshop VARCHAR(50),
  equipment_id VARCHAR(50),
  parameters JSONB,
  operator_id UUID,
  operator_name VARCHAR(50),
  quality_check_result TEXT,
  inspector_id UUID,
  inspector_name VARCHAR(50),
  inspection_notes TEXT,
  next_batch_id UUID,
  output_quantity DECIMAL(10, 2),
  output_unit VARCHAR(20),
  waste_quantity DECIMAL(10, 2),
  remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transport_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL,
  transport_type VARCHAR(50),
  vehicle_number VARCHAR(50),
  driver_name VARCHAR(50),
  driver_contact VARCHAR(50),
  departure_location VARCHAR(200),
  arrival_location VARCHAR(200),
  departure_time TIMESTAMP,
  arrival_time TIMESTAMP,
  temperature_control JSONB,
  transport_condition TEXT,
  cargo_status TEXT,
  handler_name VARCHAR(50),
  remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trace_batch_id ON trace_records(batch_id);
CREATE INDEX IF NOT EXISTS idx_trace_type ON trace_records(trace_type);
CREATE INDEX IF NOT EXISTS idx_origin_batch_id ON origin_records(batch_id);
CREATE INDEX IF NOT EXISTS idx_processing_batch_id ON processing_records(batch_id);
CREATE INDEX IF NOT EXISTS idx_transport_batch_id ON transport_records(batch_id);

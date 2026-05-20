CREATE DATABASE IF NOT EXISTS batch_db;

\c batch_db;

CREATE TABLE IF NOT EXISTS material_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_no VARCHAR(50) UNIQUE NOT NULL,
  material_id UUID NOT NULL,
  material_name VARCHAR(100) NOT NULL,
  material_code VARCHAR(50) NOT NULL,
  quantity DECIMAL(12, 2) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  supplier_id UUID,
  supplier_name VARCHAR(100),
  production_date DATE,
  expiry_date DATE,
  warehouse_id UUID,
  warehouse_name VARCHAR(100),
  location VARCHAR(50),
  status VARCHAR(20) DEFAULT 'PENDING',
  current_stage VARCHAR(50),
  quality_grade VARCHAR(20),
  is_inspected BOOLEAN DEFAULT false,
  inspector_id UUID,
  inspector_name VARCHAR(50),
  inspection_time TIMESTAMP,
  remarks TEXT,
  created_by UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS batch_flow_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL,
  from_stage VARCHAR(50),
  to_stage VARCHAR(50) NOT NULL,
  operation_type VARCHAR(50) NOT NULL,
  quantity DECIMAL(12, 2),
  operator_id UUID,
  operator_name VARCHAR(50),
  operation_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  from_location VARCHAR(100),
  to_location VARCHAR(100),
  equipment_id VARCHAR(50),
  remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE inventory_status AS ENUM ('INSTOCK', 'LOWSTOCK', 'OUTOFSTOCK');

CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID UNIQUE NOT NULL,
  material_id UUID NOT NULL,
  material_name VARCHAR(100) NOT NULL,
  material_code VARCHAR(50) NOT NULL,
  warehouse_id UUID,
  warehouse_name VARCHAR(100),
  location VARCHAR(50),
  quantity DECIMAL(12, 2) NOT NULL DEFAULT 0,
  unit VARCHAR(20) NOT NULL,
  available_quantity DECIMAL(12, 2) NOT NULL DEFAULT 0,
  locked_quantity DECIMAL(12, 2) NOT NULL DEFAULT 0,
  status inventory_status DEFAULT 'INSTOCK',
  last_in_time TIMESTAMP,
  last_out_time TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS batch_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES material_batches(id) ON DELETE CASCADE,
  warning_type VARCHAR(50) NOT NULL,
  warning_level VARCHAR(20) DEFAULT 'NORMAL',
  warning_message TEXT,
  threshold_value DECIMAL(12,2),
  current_value DECIMAL(12,2),
  is_acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID,
  acknowledged_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS origin_process_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL,
  origin_province VARCHAR(50),
  origin_city VARCHAR(50),
  process_type VARCHAR(100) NOT NULL,
  process_description TEXT,
  process_parameters JSONB,
  quality_standards JSONB,
  typical_cycle_days INTEGER,
  is_recommended BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_batch_no ON material_batches(batch_no);
CREATE INDEX IF NOT EXISTS idx_batch_status ON material_batches(status);
CREATE INDEX IF NOT EXISTS idx_batch_material ON material_batches(material_id);
CREATE INDEX IF NOT EXISTS idx_batch_expiry ON material_batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_flow_batch ON batch_flow_records(batch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_batch ON inventory(batch_id);
CREATE INDEX IF NOT EXISTS idx_warning_batch ON batch_warnings(batch_id);
CREATE INDEX IF NOT EXISTS idx_warning_type ON batch_warnings(warning_type);
CREATE INDEX IF NOT EXISTS idx_origin_process ON origin_process_relations(material_id, origin_province);

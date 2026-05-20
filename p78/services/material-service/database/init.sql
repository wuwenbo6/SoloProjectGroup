CREATE DATABASE IF NOT EXISTS material_db;

\c material_db;

CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  origin_province VARCHAR(50),
  origin_city VARCHAR(50),
  origin_address TEXT,
  supplier_name VARCHAR(100),
  supplier_contact VARCHAR(50),
  unit VARCHAR(20) NOT NULL,
  specifications TEXT,
  description TEXT,
  quality_standard TEXT,
  storage_requirements TEXT,
  shelf_life_days INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS material_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  code VARCHAR(20) UNIQUE NOT NULL,
  description TEXT,
  parent_id UUID,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_materials_code ON materials(code);
CREATE INDEX IF NOT EXISTS idx_materials_name ON materials(name);
CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category);
CREATE INDEX IF NOT EXISTS idx_materials_origin ON materials(origin_province, origin_city);

INSERT INTO material_categories (name, code, description) VALUES
('高粱', 'GAOLIANG', '酿酒用高粱'),
('小麦', 'WHEAT', '酿酒用小麦'),
('大米', 'RICE', '酿酒用大米'),
('玉米', 'CORN', '酿酒用玉米'),
('糯米', 'GLUTINOUS_RICE', '酿酒用糯米'),
('豌豆', 'PEA', '酿酒用豌豆'),
('大麦', 'BARLEY', '酿酒用大麦')
ON CONFLICT (name) DO NOTHING;

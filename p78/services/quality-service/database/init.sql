CREATE DATABASE IF NOT EXISTS quality_db;

\c quality_db;

CREATE TABLE IF NOT EXISTS quality_standards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_category VARCHAR(50) NOT NULL,
  standard_name VARCHAR(100) NOT NULL,
  standard_code VARCHAR(50) UNIQUE NOT NULL,
  version VARCHAR(20) DEFAULT '1.0',
  parameters JSONB NOT NULL,
  grading_rules JSONB NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quality_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL,
  inspection_no VARCHAR(50) UNIQUE NOT NULL,
  standard_id UUID,
  inspector_id UUID,
  inspector_name VARCHAR(50),
  inspection_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  inspection_items JSONB,
  inspection_result JSONB,
  total_score DECIMAL(5, 2),
  grade VARCHAR(20),
  conclusion TEXT,
  is_qualified BOOLEAN DEFAULT true,
  remarks TEXT,
  attachment_urls JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quality_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_name VARCHAR(50) NOT NULL,
  grade_code VARCHAR(20) UNIQUE NOT NULL,
  min_score DECIMAL(5, 2) NOT NULL,
  max_score DECIMAL(5, 2) NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quality_batch ON quality_inspections(batch_id);
CREATE INDEX IF NOT EXISTS idx_quality_grade ON quality_inspections(grade);
CREATE INDEX IF NOT EXISTS idx_quality_time ON quality_inspections(inspection_time);

INSERT INTO quality_grades (grade_name, grade_code, min_score, max_score, sort_order) VALUES
('特级', 'SPECIAL', 95.00, 100.00, 1),
('一级', 'GRADE_1', 85.00, 94.99, 2),
('二级', 'GRADE_2', 75.00, 84.99, 3),
('三级', 'GRADE_3', 60.00, 74.99, 4),
('不合格', 'UNQUALIFIED', 0.00, 59.99, 5)
ON CONFLICT (grade_code) DO NOTHING;

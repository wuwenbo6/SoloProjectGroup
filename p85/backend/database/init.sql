-- ============================================
-- 古法造纸原料溯源系统 - 数据库初始化脚本
-- ============================================

-- 1. 原料数据库 (包含: 原料、用户、批次)
CREATE DATABASE IF NOT EXISTS papermaking_material;
\c papermaking_material;

-- 原料表
CREATE TABLE IF NOT EXISTS materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    category VARCHAR(100) NOT NULL,
    origin VARCHAR(200) NOT NULL,
    origin_coords JSONB,
    description TEXT,
    specifications JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category);
CREATE INDEX IF NOT EXISTS idx_materials_status ON materials(status);

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(200) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 批次表
CREATE TABLE IF NOT EXISTS batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_no VARCHAR(100) UNIQUE NOT NULL,
    material_id UUID NOT NULL,
    production_date TIMESTAMP NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'producing',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_batches_batch_no ON batches(batch_no);
CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status);

-- 批次-采集关联表
CREATE TABLE IF NOT EXISTS batch_collections (
    batch_id UUID NOT NULL,
    collection_id UUID NOT NULL,
    PRIMARY KEY (batch_id, collection_id)
);

-- 插入默认管理员用户 (密码: admin123)
INSERT INTO users (username, email, password_hash, role)
SELECT 'admin', 'admin@example.com', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iAt6Z5EH', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin');

-- 插入示例原料数据
INSERT INTO materials (name, category, origin, description, specifications)
SELECT '青檀皮', '树皮类', '安徽泾县', '优质青檀树皮，纤维柔韧', '{"fiber_length": "3-5mm", "purity": "95%"}'
WHERE NOT EXISTS (SELECT 1 FROM materials WHERE name = '青檀皮');

INSERT INTO materials (name, category, origin, description, specifications)
SELECT '沙田稻草', '禾本科', '安徽宣城', '沙田稻草，纤维细长', '{"fiber_length": "1-3mm", "purity": "90%"}'
WHERE NOT EXISTS (SELECT 1 FROM materials WHERE name = '沙田稻草');

-- ============================================
-- 2. 采集数据库
CREATE DATABASE IF NOT EXISTS papermaking_collection;
\c papermaking_collection;

CREATE TABLE IF NOT EXISTS collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID NOT NULL,
    collector_id UUID NOT NULL,
    collection_time TIMESTAMP NOT NULL,
    location VARCHAR(200) NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    weather VARCHAR(100),
    notes TEXT,
    sync_status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_collections_material_id ON collections(material_id);
CREATE INDEX IF NOT EXISTS idx_collections_collector_id ON collections(collector_id);
CREATE INDEX IF NOT EXISTS idx_collections_sync_status ON collections(sync_status);

-- ============================================
-- 3. 检测数据库
CREATE DATABASE IF NOT EXISTS papermaking_inspection;
\c papermaking_inspection;

-- 检测记录表
CREATE TABLE IF NOT EXISTS inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID NOT NULL,
    inspector_id UUID NOT NULL,
    inspection_type VARCHAR(20) NOT NULL,
    items JSONB NOT NULL DEFAULT '[]',
    conclusion VARCHAR(20) NOT NULL DEFAULT 'pending',
    report_url VARCHAR(500),
    agency_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inspections_collection_id ON inspections(collection_id);
CREATE INDEX IF NOT EXISTS idx_inspections_conclusion ON inspections(conclusion);

-- 第三方机构表
CREATE TABLE IF NOT EXISTS third_party_agencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    api_key VARCHAR(100) NOT NULL,
    webhook_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 插入示例第三方机构
INSERT INTO third_party_agencies (name, code, api_key, webhook_url)
SELECT '国家纸张质量监督检验中心', 'NPQIC', gen_random_uuid(), 'https://example.com/webhook/npqic'
WHERE NOT EXISTS (SELECT 1 FROM third_party_agencies WHERE code = 'NPQIC');

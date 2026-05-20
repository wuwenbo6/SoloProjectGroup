CREATE DATABASE IF NOT EXISTS dye_auth DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS dye_formula DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS dye_traceability DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS dye_quality DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE dye_auth;

CREATE TABLE IF NOT EXISTS sys_user (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    real_name VARCHAR(50),
    phone VARCHAR(20),
    email VARCHAR(100),
    role VARCHAR(50) DEFAULT 'ROLE_USER',
    status TINYINT DEFAULT 1,
    deleted TINYINT DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    create_by BIGINT,
    update_by BIGINT,
    INDEX idx_username (username),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO sys_user (username, password, real_name, role, status) VALUES 
('admin', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVKIui', '管理员', 'ROLE_ADMIN', 1);

USE dye_formula;

CREATE TABLE IF NOT EXISTS dye_formula (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    formula_no VARCHAR(50) NOT NULL UNIQUE,
    formula_name VARCHAR(100) NOT NULL,
    color_system VARCHAR(50),
    color_code VARCHAR(50),
    description TEXT,
    ph_value DECIMAL(5,2),
    temperature DECIMAL(5,2),
    process_time INT,
    status TINYINT DEFAULT 1,
    deleted TINYINT DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    create_by BIGINT,
    update_by BIGINT,
    INDEX idx_formula_no (formula_no),
    INDEX idx_color_system (color_system)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS dye_formula_material (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    formula_id BIGINT NOT NULL,
    material_code VARCHAR(50) NOT NULL,
    material_name VARCHAR(100) NOT NULL,
    material_type VARCHAR(50),
    dosage DECIMAL(10,4),
    unit VARCHAR(20),
    sort_order INT DEFAULT 0,
    remark TEXT,
    deleted TINYINT DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    create_by BIGINT,
    update_by BIGINT,
    INDEX idx_formula_id (formula_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS formula_batch (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    batch_no VARCHAR(50) NOT NULL UNIQUE,
    formula_no VARCHAR(50) NOT NULL,
    formula_name VARCHAR(100),
    quantity DECIMAL(10,2),
    unit VARCHAR(20),
    workshop VARCHAR(50),
    production_line VARCHAR(50),
    operator VARCHAR(50),
    plan_start_time DATETIME,
    actual_start_time DATETIME,
    actual_end_time DATETIME,
    quality_status VARCHAR(20),
    remark TEXT,
    status TINYINT DEFAULT 1,
    deleted TINYINT DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    create_by BIGINT,
    update_by BIGINT,
    INDEX idx_batch_no (batch_no),
    INDEX idx_formula_no (formula_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

USE dye_traceability;

CREATE TABLE IF NOT EXISTS material_trace (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    trace_code VARCHAR(50) NOT NULL UNIQUE,
    material_code VARCHAR(50) NOT NULL,
    material_name VARCHAR(100) NOT NULL,
    supplier_code VARCHAR(50),
    supplier_name VARCHAR(100),
    batch_no VARCHAR(50),
    production_date VARCHAR(20),
    quality_level VARCHAR(20),
    certification_no VARCHAR(100),
    logistics_info TEXT,
    storage_location VARCHAR(100),
    status TINYINT DEFAULT 1,
    remark TEXT,
    deleted TINYINT DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    create_by BIGINT,
    update_by BIGINT,
    INDEX idx_trace_code (trace_code),
    INDEX idx_batch_no (batch_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS process_trace (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    process_code VARCHAR(50) NOT NULL UNIQUE,
    batch_no VARCHAR(50) NOT NULL,
    formula_no VARCHAR(50),
    process_name VARCHAR(100),
    process_type VARCHAR(50),
    start_time DATETIME,
    end_time DATETIME,
    operator VARCHAR(50),
    equipment_code VARCHAR(50),
    process_parameters TEXT,
    environment_data TEXT,
    status TINYINT DEFAULT 1,
    remark TEXT,
    deleted TINYINT DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    create_by BIGINT,
    update_by BIGINT,
    INDEX idx_process_code (process_code),
    INDEX idx_batch_no (batch_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

USE dye_quality;

CREATE TABLE IF NOT EXISTS quality_inspection (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    inspection_no VARCHAR(50) NOT NULL UNIQUE,
    batch_no VARCHAR(50) NOT NULL,
    formula_no VARCHAR(50),
    inspector VARCHAR(50),
    inspection_type VARCHAR(50),
    color_difference DECIMAL(8,4),
    color_fastness DECIMAL(8,4),
    ph_value DECIMAL(5,2),
    solid_content DECIMAL(8,4),
    appearance TEXT,
    inspection_result VARCHAR(20),
    remark TEXT,
    status TINYINT DEFAULT 1,
    deleted TINYINT DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    create_by BIGINT,
    update_by BIGINT,
    INDEX idx_inspection_no (inspection_no),
    INDEX idx_batch_no (batch_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS third_party_inspection (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    report_no VARCHAR(50) NOT NULL UNIQUE,
    batch_no VARCHAR(50) NOT NULL,
    inspection_agency VARCHAR(100),
    inspection_date VARCHAR(20),
    inspector VARCHAR(50),
    color_difference DECIMAL(8,4),
    color_fastness_washing DECIMAL(8,4),
    color_fastness_light DECIMAL(8,4),
    color_fastness_rubbing DECIMAL(8,4),
    ph_value DECIMAL(5,2),
    formaldehyde_content DECIMAL(10,4),
    heavy_metals TEXT,
    inspection_result VARCHAR(20),
    report_url VARCHAR(255),
    sync_status VARCHAR(20),
    remark TEXT,
    deleted TINYINT DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    create_by BIGINT,
    update_by BIGINT,
    INDEX idx_report_no (report_no),
    INDEX idx_batch_no (batch_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

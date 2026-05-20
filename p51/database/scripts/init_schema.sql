CREATE DATABASE IF NOT EXISTS heritage_restoration DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE heritage_restoration;

CREATE TABLE equipment (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '设备ID',
    name VARCHAR(200) NOT NULL COMMENT '设备名称',
    equipment_type VARCHAR(100) COMMENT '设备类型',
    factory VARCHAR(200) COMMENT '生产厂家',
    manufacture_year INT COMMENT '制造年份',
    location VARCHAR(200) COMMENT '存放位置',
    status VARCHAR(50) DEFAULT 'active' COMMENT '状态',
    description TEXT COMMENT '设备描述',
    model_path VARCHAR(500) COMMENT '3D模型路径',
    thumbnail VARCHAR(500) COMMENT '缩略图',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_equipment_type (equipment_type),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备表';

CREATE TABLE equipment_part (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '部件ID',
    equipment_id BIGINT NOT NULL COMMENT '设备ID',
    name VARCHAR(200) NOT NULL COMMENT '部件名称',
    part_no VARCHAR(100) COMMENT '部件编号',
    material VARCHAR(100) COMMENT '材质',
    model_mesh_id VARCHAR(100) COMMENT '3D模型网格ID',
    description TEXT COMMENT '部件描述',
    sort_order INT DEFAULT 0 COMMENT '排序',
    status VARCHAR(50) DEFAULT 'normal' COMMENT '状态',
    INDEX idx_equipment_id (equipment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备部件表';

CREATE TABLE damage_mark (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '破损ID',
    equipment_id BIGINT NOT NULL COMMENT '设备ID',
    position VARCHAR(200) COMMENT '破损位置',
    damage_type VARCHAR(100) COMMENT '破损类型',
    severity VARCHAR(50) COMMENT '严重程度',
    description TEXT COMMENT '破损描述',
    coordinate VARCHAR(200) COMMENT '3D坐标',
    status VARCHAR(50) DEFAULT 'unrepaired' COMMENT '状态',
    INDEX idx_equipment_id (equipment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='破损标注表';

CREATE TABLE structure_drawing (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '图纸ID',
    equipment_id BIGINT NOT NULL COMMENT '设备ID',
    drawing_name VARCHAR(200) NOT NULL COMMENT '图纸名称',
    drawing_type VARCHAR(100) COMMENT '图纸类型',
    file_url VARCHAR(500) COMMENT '文件路径',
    version VARCHAR(50) COMMENT '版本',
    description TEXT COMMENT '图纸描述',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_equipment_id (equipment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='结构图纸表';

CREATE TABLE archive (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '档案ID',
    equipment_id BIGINT NOT NULL COMMENT '设备ID',
    archive_type VARCHAR(100) COMMENT '档案类型',
    title VARCHAR(200) NOT NULL COMMENT '标题',
    content TEXT COMMENT '内容',
    file_url VARCHAR(500) COMMENT '文件路径',
    record_date DATE COMMENT '记录日期',
    recorder VARCHAR(100) COMMENT '记录人',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_equipment_id (equipment_id),
    INDEX idx_archive_type (archive_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='历史档案表';

CREATE TABLE restoration_plan (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '方案ID',
    equipment_id BIGINT NOT NULL COMMENT '设备ID',
    plan_name VARCHAR(200) NOT NULL COMMENT '方案名称',
    description TEXT COMMENT '方案描述',
    restorer VARCHAR(100) COMMENT '修复人员',
    estimated_cost DECIMAL(12,2) COMMENT '预估费用',
    estimated_days INT COMMENT '预估天数',
    status VARCHAR(50) DEFAULT 'draft' COMMENT '状态',
    restored_model_path VARCHAR(500) COMMENT '复原后模型路径',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_equipment_id (equipment_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='复原方案表';

CREATE TABLE restoration_progress (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '进度ID',
    plan_id BIGINT NOT NULL COMMENT '方案ID',
    equipment_id BIGINT NOT NULL COMMENT '设备ID',
    step_name VARCHAR(200) NOT NULL COMMENT '步骤名称',
    step_order INT NOT NULL COMMENT '步骤顺序',
    status VARCHAR(50) DEFAULT 'pending' COMMENT '状态',
    description TEXT COMMENT '步骤描述',
    operator VARCHAR(100) COMMENT '操作人',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    complete_time DATETIME COMMENT '完成时间',
    INDEX idx_plan_id (plan_id),
    INDEX idx_equipment_id (equipment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='复原进度表';

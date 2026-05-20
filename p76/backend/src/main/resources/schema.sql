CREATE DATABASE IF NOT EXISTS rubbing_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE rubbing_db;

CREATE TABLE IF NOT EXISTS rubbing_record (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    rubbing_id VARCHAR(32) NOT NULL UNIQUE COMMENT '拓片编号',
    name VARCHAR(100) NOT NULL COMMENT '拓片名称',
    dynasty VARCHAR(50) COMMENT '所属朝代',
    resolution_width INT COMMENT '分辨率宽度',
    resolution_height INT COMMENT '分辨率高度',
    dpi INT COMMENT 'DPI',
    color_depth VARCHAR(20) COMMENT '色彩深度',
    file_format VARCHAR(10) COMMENT '文件格式',
    file_size DECIMAL(10,2) COMMENT '文件大小(MB)',
    quality_score INT COMMENT '质量评分',
    quality_level CHAR(1) COMMENT '质量等级(A/B/C/D)',
    brightness INT COMMENT '亮度参数',
    contrast INT COMMENT '对比度参数',
    threshold INT COMMENT '阈值参数',
    scan_mode VARCHAR(20) COMMENT '扫描模式',
    image_path VARCHAR(500) COMMENT '图像存储路径',
    location VARCHAR(100) COMMENT '存储位置',
    archive_level CHAR(1) COMMENT '归档等级',
    archive_time DATETIME COMMENT '归档时间',
    operator VARCHAR(50) COMMENT '操作人',
    capture_time DATETIME COMMENT '采集时间',
    remark TEXT COMMENT '备注',
    created_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '是否删除(0-否 1-是)',
    INDEX idx_rubbing_id (rubbing_id),
    INDEX idx_quality_level (quality_level),
    INDEX idx_archive_level (archive_level),
    INDEX idx_capture_time (capture_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='拓片采集记录表';

CREATE TABLE IF NOT EXISTS capture_progress (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    task_id VARCHAR(64) NOT NULL UNIQUE COMMENT '任务ID',
    current INT DEFAULT 0 COMMENT '当前进度',
    total INT DEFAULT 100 COMMENT '总进度',
    status VARCHAR(20) DEFAULT 'IDLE' COMMENT '状态(IDLE-空闲 SCANNING-扫描中 PAUSED-暂停 COMPLETED-完成 ERROR-错误)',
    estimated_time INT COMMENT '预计剩余时间(秒)',
    start_time DATETIME COMMENT '开始时间',
    end_time DATETIME COMMENT '结束时间',
    error_msg VARCHAR(500) COMMENT '错误信息',
    created_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采集进度表';

CREATE TABLE IF NOT EXISTS quality_analysis (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    rubbing_id VARCHAR(32) NOT NULL COMMENT '拓片编号',
    sharpness INT COMMENT '清晰度',
    contrast INT COMMENT '对比度',
    noise INT COMMENT '噪声水平',
    overall_score INT COMMENT '综合评分',
    analysis_result TEXT COMMENT '分析结果',
    analysis_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '分析时间',
    INDEX idx_rubbing_id (rubbing_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='图像质量分析表';

CREATE TABLE IF NOT EXISTS capture_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    task_id VARCHAR(64) COMMENT '任务ID',
    type VARCHAR(20) COMMENT '日志类型(INFO-信息 SUCCESS-成功 WARNING-警告 ERROR-错误)',
    message VARCHAR(500) COMMENT '日志内容',
    created_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_task_id (task_id),
    INDEX idx_created_time (created_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采集日志表';

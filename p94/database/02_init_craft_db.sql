CREATE DATABASE IF NOT EXISTS shadow_craft_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE shadow_craft_db;

CREATE TABLE IF NOT EXISTS craft_techniques (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '工艺ID',
    title VARCHAR(200) NOT NULL COMMENT '工艺标题',
    category VARCHAR(100) NOT NULL COMMENT '工艺分类（雕刻、染色、装订、其他）',
    content TEXT NOT NULL COMMENT '工艺详细说明',
    materials TEXT COMMENT '所需材料',
    tools TEXT COMMENT '所需工具',
    difficulty_level TINYINT COMMENT '难度等级：1-简单，2-中等，3-困难，4-专家',
    duration VARCHAR(50) COMMENT '制作时长',
    author_id BIGINT NOT NULL COMMENT '作者ID',
    video_url VARCHAR(500) COMMENT '教学视频URL',
    status TINYINT DEFAULT 1 COMMENT '状态：0-草稿，1-已发布，2-下架',
    view_count INT DEFAULT 0 COMMENT '浏览次数',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_category (category),
    INDEX idx_author (author_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='皮影工艺表';

CREATE TABLE IF NOT EXISTS craft_steps (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '步骤ID',
    craft_id BIGINT NOT NULL COMMENT '工艺ID',
    step_order INT NOT NULL COMMENT '步骤序号',
    title VARCHAR(200) NOT NULL COMMENT '步骤标题',
    description TEXT COMMENT '步骤说明',
    image_url VARCHAR(500) COMMENT '步骤图片URL',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_craft_id (craft_id),
    INDEX idx_step_order (step_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='工艺步骤表';

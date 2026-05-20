CREATE DATABASE IF NOT EXISTS shadow_prop_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE shadow_prop_db;

CREATE TABLE IF NOT EXISTS props (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '道具ID',
    name VARCHAR(200) NOT NULL COMMENT '道具名称',
    category VARCHAR(100) NOT NULL COMMENT '道具分类（人物、动物、场景、器物等）',
    description TEXT COMMENT '道具描述',
    image_url VARCHAR(500) COMMENT '道具图片URL',
    material VARCHAR(100) COMMENT '制作材质',
    size VARCHAR(100) COMMENT '尺寸规格',
    origin VARCHAR(200) COMMENT '来源地',
    collector_id BIGINT NOT NULL COMMENT '采集者ID',
    status TINYINT DEFAULT 1 COMMENT '状态：0-草稿，1-已审核，2-下架',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_category (category),
    INDEX idx_collector (collector_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='皮影道具表';

CREATE TABLE IF NOT EXISTS prop_tags (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '标签ID',
    prop_id BIGINT NOT NULL COMMENT '道具ID',
    tag_name VARCHAR(50) NOT NULL COMMENT '标签名称',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_prop_id (prop_id),
    INDEX idx_tag_name (tag_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='道具标签表';

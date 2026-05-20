-- 定制需求方案表
CREATE TABLE IF NOT EXISTS proposal (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '方案ID',
    requirement_id BIGINT NOT NULL COMMENT '需求ID',
    artisan_id BIGINT NOT NULL COMMENT '匠人ID',
    title VARCHAR(200) NOT NULL COMMENT '方案标题',
    description TEXT COMMENT '方案描述',
    price DECIMAL(10,2) NOT NULL COMMENT '报价',
    delivery_days INT NOT NULL COMMENT '交付周期(天)',
    material_desc TEXT COMMENT '用材说明',
    craft_desc TEXT COMMENT '工艺说明',
    revision INT DEFAULT 1 COMMENT '版本号',
    status TINYINT DEFAULT 1 COMMENT '状态 0-撤回 1-待审核 2-已选中 3-未选中 4-已拒绝',
    is_final TINYINT(1) DEFAULT 0 COMMENT '是否最终方案 0-否 1-是',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    version INT DEFAULT 0 COMMENT '乐观锁版本',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    INDEX idx_requirement_id (requirement_id),
    INDEX idx_artisan_id (artisan_id),
    INDEX idx_status (status),
    INDEX idx_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='定制需求方案表';

-- 方案附件表
CREATE TABLE IF NOT EXISTS proposal_attachment (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '附件ID',
    proposal_id BIGINT NOT NULL COMMENT '方案ID',
    file_name VARCHAR(255) NOT NULL COMMENT '文件名',
    file_url VARCHAR(500) NOT NULL COMMENT '文件URL',
    file_type VARCHAR(50) COMMENT '文件类型 image/video/pdf',
    file_size BIGINT COMMENT '文件大小(字节)',
    sort_order INT DEFAULT 0 COMMENT '排序',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    version INT DEFAULT 0 COMMENT '乐观锁版本',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    INDEX idx_proposal_id (proposal_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='方案附件表';

-- 方案对比历史表
CREATE TABLE IF NOT EXISTS proposal_compare (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '对比ID',
    user_id BIGINT NOT NULL COMMENT '用户ID',
    requirement_id BIGINT NOT NULL COMMENT '需求ID',
    proposal_ids JSON NOT NULL COMMENT '对比的方案ID列表',
    selected_proposal_id BIGINT COMMENT '最终选中的方案ID',
    compare_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '对比时间',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    version INT DEFAULT 0 COMMENT '乐观锁版本',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    INDEX idx_user_id (user_id),
    INDEX idx_requirement_id (requirement_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='方案对比历史表';

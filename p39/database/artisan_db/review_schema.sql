-- 匠人作品评价表
CREATE TABLE IF NOT EXISTS artisan_review (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '评价ID',
    order_id BIGINT NOT NULL COMMENT '订单ID',
    artisan_id BIGINT NOT NULL COMMENT '匠人ID',
    user_id BIGINT NOT NULL COMMENT '用户ID',
    portfolio_id BIGINT COMMENT '作品ID（可选）',
    overall_rating DECIMAL(2,1) NOT NULL COMMENT '总体评分 1-5',
    skill_rating DECIMAL(2,1) NOT NULL COMMENT '工艺评分 1-5',
    attitude_rating DECIMAL(2,1) NOT NULL COMMENT '服务态度评分 1-5',
    delivery_rating DECIMAL(2,1) NOT NULL COMMENT '交付速度评分 1-5',
    content TEXT COMMENT '评价内容',
    images JSON COMMENT '评价图片URL列表',
    is_anonymous TINYINT(1) DEFAULT 0 COMMENT '是否匿名 0-否 1-是',
    helpful_count INT DEFAULT 0 COMMENT '有用数',
    status TINYINT DEFAULT 1 COMMENT '状态 0-删除 1-正常 2-审核中',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    version INT DEFAULT 0 COMMENT '乐观锁版本',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    INDEX idx_artisan_id (artisan_id),
    INDEX idx_user_id (user_id),
    INDEX idx_order_id (order_id),
    INDEX idx_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='匠人作品评价表';

-- 匠人评分统计表
CREATE TABLE IF NOT EXISTS artisan_rating_stats (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '统计ID',
    artisan_id BIGINT NOT NULL UNIQUE COMMENT '匠人ID',
    total_reviews INT DEFAULT 0 COMMENT '总评价数',
    avg_overall_rating DECIMAL(3,2) DEFAULT 0.00 COMMENT '平均总体评分',
    avg_skill_rating DECIMAL(3,2) DEFAULT 0.00 COMMENT '平均工艺评分',
    avg_attitude_rating DECIMAL(3,2) DEFAULT 0.00 COMMENT '平均服务态度评分',
    avg_delivery_rating DECIMAL(3,2) DEFAULT 0.00 COMMENT '平均交付速度评分',
    five_star_count INT DEFAULT 0 COMMENT '5星评价数',
    four_star_count INT DEFAULT 0 COMMENT '4星评价数',
    three_star_count INT DEFAULT 0 COMMENT '3星评价数',
    two_star_count INT DEFAULT 0 COMMENT '2星评价数',
    one_star_count INT DEFAULT 0 COMMENT '1星评价数',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    version INT DEFAULT 0 COMMENT '乐观锁版本',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    INDEX idx_artisan_id (artisan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='匠人评分统计表';

-- 评价点赞记录表
CREATE TABLE IF NOT EXISTS review_helpful (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID',
    review_id BIGINT NOT NULL COMMENT '评价ID',
    user_id BIGINT NOT NULL COMMENT '用户ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    version INT DEFAULT 0 COMMENT '乐观锁版本',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    UNIQUE KEY uk_review_user (review_id, user_id),
    INDEX idx_review_id (review_id),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='评价点赞记录表';

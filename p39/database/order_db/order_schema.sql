-- =========================================
-- CraftHub 订单数据库
-- Database: crafthub_order
-- =========================================

CREATE DATABASE IF NOT EXISTS crafthub_order DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE crafthub_order;

-- 订单表
CREATE TABLE IF NOT EXISTS t_order (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '订单ID',
    order_no VARCHAR(32) NOT NULL UNIQUE COMMENT '订单编号',
    user_id BIGINT NOT NULL COMMENT '用户ID',
    artisan_id BIGINT NOT NULL COMMENT '匠人ID',
    requirement_id BIGINT COMMENT '需求ID',
    title VARCHAR(200) NOT NULL COMMENT '订单标题',
    description TEXT COMMENT '订单描述',
    amount DECIMAL(10,2) NOT NULL COMMENT '订单金额',
    status TINYINT NOT NULL DEFAULT 1 COMMENT '订单状态:1待支付2已支付3制作中4已发货5已完成6已取消',
    progress INT NOT NULL DEFAULT 0 COMMENT '制作进度0-100',
    estimated_delivery DATETIME COMMENT '预计交付时间',
    actual_delivery DATETIME COMMENT '实际交付时间',
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除:0未删除1已删除',
    INDEX idx_user_id (user_id),
    INDEX idx_artisan_id (artisan_id),
    INDEX idx_order_no (order_no),
    INDEX idx_status (status),
    INDEX idx_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单表';

-- 订单进度日志表
CREATE TABLE IF NOT EXISTS t_order_progress_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '日志ID',
    order_id BIGINT NOT NULL COMMENT '订单ID',
    progress INT NOT NULL COMMENT '进度值',
    title VARCHAR(100) NOT NULL COMMENT '进度标题',
    description VARCHAR(500) COMMENT '进度描述',
    image_urls TEXT COMMENT '进度图片URL,多个用逗号分隔',
    create_by BIGINT COMMENT '创建者ID',
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_order_id (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单进度日志表';

-- 订单评价表
CREATE TABLE IF NOT EXISTS t_order_review (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '评价ID',
    order_id BIGINT NOT NULL UNIQUE COMMENT '订单ID',
    user_id BIGINT NOT NULL COMMENT '用户ID',
    artisan_id BIGINT NOT NULL COMMENT '匠人ID',
    rating TINYINT NOT NULL COMMENT '评分1-5',
    content TEXT COMMENT '评价内容',
    image_urls TEXT COMMENT '评价图片URL,多个用逗号分隔',
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_order_id (order_id),
    INDEX idx_artisan_id (artisan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单评价表';

-- 插入测试数据
INSERT INTO t_order (order_no, user_id, artisan_id, title, description, amount, status, progress)
VALUES 
('ORD20240510120001234', 10001, 20001, '青花瓷茶具套装定制', '定制一套青花瓷茶具，包含茶壶、茶杯、茶盘', 4500.00, 3, 60),
('ORD20240415103045678', 10001, 20002, '苏绣双面绣屏风', '定制一幅山水画苏绣屏风', 12800.00, 1, 0),
('ORD20240301084590123', 10002, 20003, '东阳木雕佛像摆件', '定制一尊檀木佛像摆件', 6800.00, 5, 100);

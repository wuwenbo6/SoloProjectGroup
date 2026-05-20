-- =========================================
-- CraftHub 定制需求数据库
-- Database: crafthub_requirement
-- =========================================

CREATE DATABASE IF NOT EXISTS crafthub_requirement DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE crafthub_requirement;

-- 定制需求表
CREATE TABLE IF NOT EXISTS t_requirement (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '需求ID',
    user_id BIGINT NOT NULL COMMENT '用户ID',
    title VARCHAR(200) NOT NULL COMMENT '需求标题',
    description TEXT NOT NULL COMMENT '需求描述',
    craft_type VARCHAR(50) NOT NULL COMMENT '工艺类型',
    budget_min DECIMAL(10,2) COMMENT '预算下限',
    budget_max DECIMAL(10,2) COMMENT '预算上限',
    deadline DATETIME COMMENT '期望交付时间',
    images TEXT COMMENT '参考图片URL,多个用逗号分隔',
    status TINYINT NOT NULL DEFAULT 1 COMMENT '状态:1待接单2已接单3制作中4已完成5已关闭',
    selected_artisan_id BIGINT COMMENT '选中的匠人ID',
    view_count INT DEFAULT 0 COMMENT '浏览次数',
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除',
    INDEX idx_user_id (user_id),
    INDEX idx_craft_type (craft_type),
    INDEX idx_status (status),
    INDEX idx_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='定制需求表';

-- 需求报价表
CREATE TABLE IF NOT EXISTS t_requirement_quote (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '报价ID',
    requirement_id BIGINT NOT NULL COMMENT '需求ID',
    artisan_id BIGINT NOT NULL COMMENT '匠人ID',
    amount DECIMAL(10,2) NOT NULL COMMENT '报价金额',
    delivery_days INT NOT NULL COMMENT '预计交付天数',
    description TEXT COMMENT '方案描述',
    status TINYINT NOT NULL DEFAULT 0 COMMENT '状态:0待确认1已接受2已拒绝',
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_requirement_id (requirement_id),
    INDEX idx_artisan_id (artisan_id),
    UNIQUE KEY uk_requirement_artisan (requirement_id, artisan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='需求报价表';

-- 工艺类型字典表
CREATE TABLE IF NOT EXISTS t_craft_type (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID',
    name VARCHAR(50) NOT NULL UNIQUE COMMENT '工艺名称',
    code VARCHAR(32) NOT NULL UNIQUE COMMENT '工艺编码',
    description VARCHAR(200) COMMENT '工艺描述',
    sort INT DEFAULT 0 COMMENT '排序',
    status TINYINT DEFAULT 1 COMMENT '状态:0禁用1启用',
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工艺类型字典表';

-- 插入工艺类型数据
INSERT INTO t_craft_type (name, code, description, sort) VALUES 
('陶瓷制作', 'ceramic', '青花瓷、粉彩、釉里红等陶瓷制品', 1),
('木雕工艺', 'woodcarving', '东阳木雕、黄杨木雕、根雕等', 2),
('刺绣', 'embroidery', '苏绣、湘绣、粤绣、蜀绣等四大名绣', 3),
('漆器制作', 'lacquer', '脱胎漆器、雕漆、漆画等', 4),
('竹编', 'bamboo', '传统竹编工艺制品', 5),
('剪纸', 'papercut', '传统窗花、剪纸艺术品', 6),
('皮影', 'shadowplay', '皮影戏人物及道具制作', 7),
('景泰蓝', 'cloisonne', '铜胎掐丝珐琅工艺品', 8);

-- 插入测试数据
INSERT INTO t_requirement (user_id, title, description, craft_type, budget_min, budget_max, deadline, status)
VALUES 
(10001, '青花瓷茶具套装定制', '需要定制一套青花瓷茶具，包含茶壶、公道杯、茶杯6只，风格简约典雅', '陶瓷制作', 3000.00, 5000.00, '2024-08-15 00:00:00', 2),
(10001, '苏绣双面绣屏风定制', '定制一幅山水画苏绣屏风，尺寸约1.8米*1米，用于客厅装饰', '刺绣', 10000.00, 15000.00, '2024-09-30 00:00:00', 1),
(10002, '檀木佛像摆件', '定制一尊高度约30cm的檀木观音佛像，工艺精湛，适合供奉', '木雕', 5000.00, 8000.00, '2024-06-30 00:00:00', 4);

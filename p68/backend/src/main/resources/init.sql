-- 创建数据库
CREATE DATABASE IF NOT EXISTS mortise_furniture DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS mortise_teaching DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS mortise_user DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE mortise_furniture;

-- 家具表
CREATE TABLE IF NOT EXISTS furniture (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL COMMENT '家具名称',
    description TEXT COMMENT '描述',
    model_path VARCHAR(500) COMMENT '模型文件路径',
    thumbnail VARCHAR(200) COMMENT '缩略图',
    category VARCHAR(50) COMMENT '分类',
    difficulty INT DEFAULT 1 COMMENT '难度 1-5',
    total_steps INT DEFAULT 0 COMMENT '总拆解步骤',
    is_active TINYINT(1) DEFAULT 1 COMMENT '是否启用',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='家具表';

-- 家具部件表
CREATE TABLE IF NOT EXISTS furniture_part (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    furniture_id BIGINT NOT NULL COMMENT '家具ID',
    name VARCHAR(100) NOT NULL COMMENT '部件名称',
    description TEXT COMMENT '描述',
    step_order INT NOT NULL COMMENT '拆解顺序',
    model_id VARCHAR(100) COMMENT '模型中的部件ID',
    disassemble_position VARCHAR(500) COMMENT '拆解位置坐标',
    mortise_type VARCHAR(200) COMMENT '榫卯类型',
    assembly_tip TEXT COMMENT '组装提示',
    INDEX idx_furniture_id (furniture_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='家具部件表';

-- 插入示例数据
INSERT INTO furniture (name, description, category, difficulty, total_steps, is_active) VALUES
('明式圈椅', '经典明式家具，造型优美，榫卯结构精密', '椅子', 3, 6, 1),
('官帽椅', '古代官帽造型，结构复杂，极具收藏价值', '椅子', 4, 8, 1),
('八仙桌', '传统方桌，可坐八人，结构稳固', '桌子', 3, 5, 1),
('条案', '长条形案几，常用于厅堂摆设', '桌子', 2, 4, 1),
('衣柜', '传统实木衣柜，储存空间大', '柜子', 5, 10, 1);

INSERT INTO furniture_part (furniture_id, name, description, step_order, model_id, mortise_type, assembly_tip) VALUES
(1, '椅圈', '圈椅的圆形扶手部分', 1, 'part_1_1', '楔钉榫', '注意拼接方向，轻敲入位'),
(1, '靠背板', '椅子的靠背支撑', 2, 'part_1_2', '格肩榫', '对准插槽，垂直插入'),
(1, '座面', '椅子的座位部分', 3, 'part_1_3', '攒边打槽装板', '先装边框，再装芯板'),
(1, '前腿', '椅子前部支撑腿', 4, 'part_1_4', '夹头榫', '注意左右腿区分'),
(1, '后腿', '椅子后部支撑腿', 5, 'part_1_5', '夹头榫', '与靠背板连接紧密'),
(1, '牙板', '装饰与加固部件', 6, 'part_1_6', '托角榫', '最后安装，调整间隙');

USE mortise_teaching;

-- 拆解步骤表
CREATE TABLE IF NOT EXISTS disassemble_step (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    furniture_id BIGINT NOT NULL COMMENT '家具ID',
    step_number INT NOT NULL COMMENT '步骤序号',
    title VARCHAR(200) NOT NULL COMMENT '步骤标题',
    description TEXT COMMENT '步骤描述',
    image_url VARCHAR(500) COMMENT '步骤图片',
    video_url VARCHAR(500) COMMENT '步骤视频',
    target_part_id VARCHAR(100) COMMENT '目标部件ID',
    operation_guide TEXT COMMENT '操作指南',
    attention_points TEXT COMMENT '注意事项',
    estimated_time INT DEFAULT 60 COMMENT '预计用时(秒)',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_furniture_step (furniture_id, step_number),
    INDEX idx_furniture_id (furniture_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='拆解步骤表';

-- 插入示例拆解步骤
INSERT INTO disassemble_step (furniture_id, step_number, title, description, operation_guide, attention_points, estimated_time, target_part_id) VALUES
(1, 1, '拆卸椅圈', '首先将圈椅的圆形扶手部分拆下', '双手握住椅圈两端，轻轻向上提起，注意力度均匀', '不要用力过猛，避免损坏榫卯结构', 60, 'part_1_1'),
(1, 2, '拆卸靠背板', '将椅子的靠背支撑部分拆下', '将靠背板向上提起，注意与后腿连接的榫头', '确认椅圈已完全拆下后再进行此步', 60, 'part_1_2'),
(1, 3, '拆卸座面', '将椅子的座位部分取下', '将座面向上提起，注意与腿足的连接', '座面较重，注意托住底部', 90, 'part_1_3'),
(1, 4, '拆卸前腿', '将椅子前部的支撑腿拆下', '将前腿向外轻拉，脱离牙板连接', '注意左右腿的标识，便于组装时区分', 60, 'part_1_4'),
(1, 5, '拆卸后腿', '将椅子后部的支撑腿拆下', '将后腿向外轻拉，脱离牙板和座面连接', '后腿与靠背板曾连接，可能较紧', 60, 'part_1_5'),
(1, 6, '拆卸牙板', '将装饰与加固的牙板拆下', '将牙板轻轻从腿足凹槽中取出', '牙板较薄，用力要轻柔', 45, 'part_1_6');

USE mortise_user;

-- 用户表
CREATE TABLE IF NOT EXISTS user (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE COMMENT '用户名',
    password VARCHAR(255) NOT NULL COMMENT '密码',
    email VARCHAR(100) NOT NULL UNIQUE COMMENT '邮箱',
    real_name VARCHAR(50) COMMENT '真实姓名',
    phone VARCHAR(20) COMMENT '手机号',
    is_active TINYINT(1) DEFAULT 1 COMMENT '是否启用',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME COMMENT '最后登录时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 用户角色表
CREATE TABLE IF NOT EXISTS user_roles (
    user_id BIGINT NOT NULL COMMENT '用户ID',
    role VARCHAR(50) NOT NULL COMMENT '角色',
    PRIMARY KEY (user_id, role),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户角色表';

-- 学习进度表
CREATE TABLE IF NOT EXISTS learning_progress (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL COMMENT '用户ID',
    furniture_id BIGINT NOT NULL COMMENT '家具ID',
    current_step INT DEFAULT 0 COMMENT '当前学习步骤',
    total_steps INT NOT NULL COMMENT '总步骤数',
    is_completed TINYINT(1) DEFAULT 0 COMMENT '是否完成',
    total_time_spent INT DEFAULT 0 COMMENT '总学习时长(秒)',
    started_at DATETIME COMMENT '开始学习时间',
    completed_at DATETIME COMMENT '完成时间',
    last_accessed DATETIME COMMENT '最后访问时间',
    notes TEXT COMMENT '学习笔记',
    UNIQUE KEY uk_user_furniture (user_id, furniture_id),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='学习进度表';

-- 插入示例管理员用户 (密码: admin123)
INSERT INTO user (username, password, email, real_name, is_active) VALUES
('admin', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iAt6Z5EH', 'admin@mortise.com', '系统管理员', 1),
('instructor', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iAt6Z5EH', 'instructor@mortise.com', '讲师', 1),
('student', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iAt6Z5EH', 'student@mortise.com', '学员', 1);

INSERT INTO user_roles (user_id, role) VALUES
(1, 'ADMIN'),
(2, 'INSTRUCTOR'),
(3, 'STUDENT');

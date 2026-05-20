CREATE DATABASE IF NOT EXISTS shadow_user_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE shadow_user_db;

CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '用户ID',
    username VARCHAR(50) NOT NULL UNIQUE COMMENT '用户名',
    password VARCHAR(255) NOT NULL COMMENT '密码（加密）',
    real_name VARCHAR(100) COMMENT '真实姓名',
    email VARCHAR(100) UNIQUE COMMENT '邮箱',
    phone VARCHAR(20) COMMENT '手机号',
    avatar VARCHAR(500) COMMENT '头像URL',
    role TINYINT DEFAULT 1 COMMENT '角色：0-管理员，1-普通用户，2-采集员，3-专家',
    status TINYINT DEFAULT 1 COMMENT '状态：0-禁用，1-启用',
    last_login_at DATETIME COMMENT '最后登录时间',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_username (username),
    INDEX idx_role (role),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

CREATE TABLE IF NOT EXISTS collaboration_sessions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '会话ID',
    session_code VARCHAR(50) NOT NULL UNIQUE COMMENT '会话代码',
    session_name VARCHAR(200) NOT NULL COMMENT '会话名称',
    host_id BIGINT NOT NULL COMMENT '主持人ID',
    prop_id BIGINT COMMENT '关联道具ID',
    status TINYINT DEFAULT 1 COMMENT '状态：0-已结束，1-进行中',
    max_participants INT DEFAULT 10 COMMENT '最大参与人数',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    ended_at DATETIME COMMENT '结束时间',
    INDEX idx_host_id (host_id),
    INDEX idx_session_code (session_code),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='协同采集会话表';

CREATE TABLE IF NOT EXISTS collaboration_participants (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '参与记录ID',
    session_id BIGINT NOT NULL COMMENT '会话ID',
    user_id BIGINT NOT NULL COMMENT '用户ID',
    join_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '加入时间',
    leave_time DATETIME COMMENT '离开时间',
    role VARCHAR(50) DEFAULT 'participant' COMMENT '角色：host, participant, observer',
    INDEX idx_session_id (session_id),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='协同采集参与表';

INSERT INTO users (username, password, real_name, email, role, status) VALUES
('admin', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVE/Kq', '系统管理员', 'admin@shadow.com', 0, 1),
('collector1', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVE/Kq', '张采集', 'collector1@shadow.com', 2, 1),
('collector2', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVE/Kq', '李采集', 'collector2@shadow.com', 2, 1),
('expert1', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVE/Kq', '王专家', 'expert1@shadow.com', 3, 1);

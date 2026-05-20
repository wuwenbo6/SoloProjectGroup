CREATE DATABASE IF NOT EXISTS paper_management DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE paper_management;

CREATE TABLE sys_user (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '用户ID',
    username VARCHAR(50) NOT NULL UNIQUE COMMENT '用户名',
    password VARCHAR(255) NOT NULL COMMENT '密码',
    real_name VARCHAR(50) COMMENT '真实姓名',
    phone VARCHAR(20) COMMENT '手机号',
    role VARCHAR(20) NOT NULL COMMENT '角色: CRAFTSMAN-工匠, INSPECTOR-质检, ADMIN-管理员',
    status TINYINT DEFAULT 1 COMMENT '状态: 0-禁用, 1-启用',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '删除标记: 0-未删除, 1-已删除',
    INDEX idx_username (username),
    INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

CREATE TABLE material (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '原料ID',
    batch_no VARCHAR(50) NOT NULL COMMENT '批次号',
    material_type VARCHAR(50) COMMENT '原料类型',
    material_name VARCHAR(100) COMMENT '原料名称',
    origin VARCHAR(100) COMMENT '产地',
    quantity DECIMAL(10,2) COMMENT '数量',
    unit VARCHAR(20) COMMENT '单位',
    quality_level VARCHAR(20) COMMENT '质量等级',
    inspector VARCHAR(50) COMMENT '检验员',
    inspect_time DATETIME COMMENT '检验时间',
    remark TEXT COMMENT '备注',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '删除标记',
    INDEX idx_batch_no (batch_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='原料表';

CREATE TABLE process_node (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '节点ID',
    node_code VARCHAR(50) NOT NULL UNIQUE COMMENT '节点编码',
    node_name VARCHAR(100) NOT NULL COMMENT '节点名称',
    sort_order INT COMMENT '排序',
    description TEXT COMMENT '描述',
    standard_params TEXT COMMENT '标准参数JSON',
    warning_rules TEXT COMMENT '预警规则JSON',
    status TINYINT DEFAULT 1 COMMENT '状态: 0-禁用, 1-启用',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '删除标记'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工序节点表';

CREATE TABLE process_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '记录ID',
    batch_no VARCHAR(50) NOT NULL COMMENT '批次号',
    process_code VARCHAR(50) COMMENT '工序编码',
    process_name VARCHAR(100) COMMENT '工序名称',
    craftsman_id BIGINT COMMENT '工匠ID',
    craftsman_name VARCHAR(50) COMMENT '工匠姓名',
    start_time DATETIME COMMENT '开始时间',
    end_time DATETIME COMMENT '结束时间',
    parameters TEXT COMMENT '参数JSON',
    status VARCHAR(20) COMMENT '状态: PROCESSING-进行中, COMPLETED-已完成, SUSPENDED-已暂停',
    abnormal_flag VARCHAR(20) DEFAULT 'NORMAL' COMMENT '异常标记: NORMAL-正常, ABNORMAL-异常',
    abnormal_desc TEXT COMMENT '异常描述',
    remark TEXT COMMENT '备注',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '删除标记',
    INDEX idx_batch_no (batch_no),
    INDEX idx_craftsman_id (craftsman_id),
    INDEX idx_abnormal_flag (abnormal_flag)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工序记录表';

CREATE TABLE quality_report (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '报告ID',
    batch_no VARCHAR(50) NOT NULL COMMENT '批次号',
    report_no VARCHAR(50) NOT NULL UNIQUE COMMENT '报告编号',
    inspector_id BIGINT COMMENT '检验员ID',
    inspector_name VARCHAR(50) COMMENT '检验员姓名',
    thickness DECIMAL(5,3) COMMENT '厚度(mm)',
    density DECIMAL(5,3) COMMENT '密度(g/cm³)',
    tensile_strength DECIMAL(5,2) COMMENT '抗张强度(N/m²)',
    whiteness DECIMAL(5,2) COMMENT '白度(%)',
    appearance TEXT COMMENT '外观描述',
    quality_level VARCHAR(20) COMMENT '质量等级: EXCELLENT-优秀, GOOD-良好, PASS-合格, FAIL-不合格',
    result VARCHAR(20) COMMENT '结果: PASS-通过, FAIL-不通过',
    remark TEXT COMMENT '备注',
    inspect_time DATETIME COMMENT '检验时间',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '删除标记',
    INDEX idx_batch_no (batch_no),
    INDEX idx_quality_level (quality_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='质检报告表';

CREATE TABLE trace_record (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '记录ID',
    trace_code VARCHAR(50) NOT NULL COMMENT '溯源码',
    batch_no VARCHAR(50) NOT NULL COMMENT '批次号',
    idempotent_key VARCHAR(100) COMMENT '幂等键',
    qr_code_url VARCHAR(255) COMMENT '二维码URL',
    status VARCHAR(20) DEFAULT 'ACTIVE' COMMENT '状态: ACTIVE-有效, INACTIVE-失效',
    create_user_id BIGINT COMMENT '创建用户ID',
    generate_time DATETIME COMMENT '生成时间',
    verify_time DATETIME COMMENT '最后验证时间',
    verify_count INT DEFAULT 0 COMMENT '验证次数',
    remark TEXT COMMENT '备注',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '删除标记',
    UNIQUE INDEX uk_trace_code (trace_code),
    UNIQUE INDEX uk_idempotent_key (idempotent_key),
    INDEX idx_batch_no (batch_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='溯源记录表';

INSERT INTO process_node (node_code, node_name, sort_order, description, standard_params, warning_rules, status) VALUES
('P001', '原料筛选', 1, '筛选优质原材料，去除杂质', '{"screenSize":"40目","purity":"95%"}', '{"purityMin":"90%"}', 1),
('P002', '浸泡软化', 2, '将原料浸泡软化', '{"soakTime":"24h","temperature":"25℃"}', '{"soakTimeMin":"12h"}', 1),
('P003', '打浆制浆', 3, '打浆制成纸浆', '{"beatingTime":"2h","concentration":"4%"}', '{"concentrationMin":"3%"}', 1),
('P004', '抄造成型', 4, '将纸浆抄造成型', '{"wireSpeed":"5m/min","basisWeight":"80g/m²"}', '{"basisWeightMin":"70g/m²"}', 1),
('P005', '压榨脱水', 5, '压榨去除多余水分', '{"pressure":"0.3MPa","temperature":"60℃"}', '{"pressureMax":"0.5MPa"}', 1),
('P006', '烘干燥纸', 6, '烘干燥纸', '{"temperature":"80℃","time":"30min"}', '{"temperatureMax":"100℃"}', 1),
('P007', '压光整饰', 7, '压光整饰处理', '{"pressure":"0.5MPa","speed":"10m/min"}', '{"pressureMax":"0.8MPa"}', 1),
('P008', '分切包装', 8, '分切包装成品', '{"size":"787*1092mm","packageType":"令"}', '{}', 1);

CREATE TABLE file_chunk (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID',
    file_id VARCHAR(100) NOT NULL COMMENT '文件唯一标识',
    chunk_number INT NOT NULL COMMENT '分片序号',
    chunk_size INT COMMENT '分片大小',
    total_size BIGINT COMMENT '文件总大小',
    total_chunks INT COMMENT '总分片数',
    chunk_path VARCHAR(500) COMMENT '分片存储路径',
    file_name VARCHAR(255) COMMENT '文件名',
    content_type VARCHAR(100) COMMENT '文件类型',
    batch_no VARCHAR(50) COMMENT '批次号',
    process_code VARCHAR(50) COMMENT '工序编码',
    create_user_id BIGINT COMMENT '创建用户ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '删除标记',
    UNIQUE INDEX uk_file_chunk (file_id, chunk_number),
    INDEX idx_batch_no (batch_no),
    INDEX idx_process_code (process_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文件分片表';

INSERT INTO sys_user (username, password, realName, phone, role, status) VALUES
('admin', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iAt6Z5E', '系统管理员', '13800138000', 'ADMIN', 1),
('craftsman1', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iAt6Z5E', '张工匠', '13800138001', 'CRAFTSMAN', 1),
('inspector1', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iAt6Z5E', '李质检', '13800138002', 'INSPECTOR', 1);

-- ========================================
-- 古籍善本修复管理系统 - 数据库初始化脚本
-- 分库设计：6个独立数据库
-- ========================================

-- ========================================
-- 1. 善本信息库 (ancientbook_rarebook)
-- ========================================
CREATE DATABASE IF NOT EXISTS ancientbook_rarebook DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ancientbook_rarebook;

CREATE TABLE IF NOT EXISTS rare_book (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    book_code VARCHAR(50) NOT NULL UNIQUE COMMENT '善本编号',
    book_name VARCHAR(200) NOT NULL COMMENT '善本名称',
    author VARCHAR(100) COMMENT '作者',
    dynasty VARCHAR(50) COMMENT '朝代',
    publication_year VARCHAR(20) COMMENT '刊刻年代',
    edition VARCHAR(100) COMMENT '版本类型',
    material VARCHAR(50) COMMENT '材质',
    page_count INT COMMENT '页数',
    dimensions VARCHAR(100) COMMENT '尺寸',
    condition_level INT NOT NULL COMMENT '破损等级：1-轻微 2-中度 3-严重 4-极重',
    condition_desc TEXT COMMENT '破损描述',
    location VARCHAR(200) COMMENT '存放位置',
    status INT DEFAULT 1 COMMENT '状态：0-待修复 1-修复中 2-已修复 3-已归档',
    remark TEXT COMMENT '备注',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    create_by VARCHAR(50) COMMENT '创建人',
    update_by VARCHAR(50) COMMENT '更新人',
    deleted TINYINT DEFAULT 0 COMMENT '是否删除：0-否 1-是',
    INDEX idx_book_code (book_code),
    INDEX idx_status (status),
    INDEX idx_condition_level (condition_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='善本信息表';

-- ========================================
-- 2. 修复进度库 (ancientbook_progress)
-- ========================================
CREATE DATABASE IF NOT EXISTS ancientbook_progress DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ancientbook_progress;

CREATE TABLE IF NOT EXISTS repair_progress (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    progress_code VARCHAR(50) NOT NULL UNIQUE COMMENT '进度编号',
    book_id BIGINT NOT NULL COMMENT '善本ID',
    book_code VARCHAR(50) NOT NULL COMMENT '善本编号',
    stage INT NOT NULL COMMENT '阶段：1-修复前检测 2-修复中 3-修复后验收',
    step INT NOT NULL COMMENT '工序步骤',
    step_name VARCHAR(100) NOT NULL COMMENT '工序名称',
    operator_id BIGINT NOT NULL COMMENT '操作人员ID',
    operator_name VARCHAR(50) NOT NULL COMMENT '操作人员姓名',
    start_time DATETIME COMMENT '开始时间',
    end_time DATETIME COMMENT '结束时间',
    status INT DEFAULT 0 COMMENT '状态：0-未开始 1-进行中 2-已完成 3-异常',
    duration INT COMMENT '耗时（分钟）',
    quality_score DECIMAL(3,1) COMMENT '质量评分',
    params_json TEXT COMMENT '工序参数JSON',
    images TEXT COMMENT '图片路径，多个用逗号分隔',
    remark TEXT COMMENT '备注',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    create_by VARCHAR(50) COMMENT '创建人',
    update_by VARCHAR(50) COMMENT '更新人',
    deleted TINYINT DEFAULT 0 COMMENT '是否删除：0-否 1-是',
    INDEX idx_book_id (book_id),
    INDEX idx_progress_code (progress_code),
    INDEX idx_stage (stage),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='修复进度表';

CREATE TABLE IF NOT EXISTS repair_step (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    step_code VARCHAR(50) NOT NULL UNIQUE COMMENT '工序编号',
    step_name VARCHAR(100) NOT NULL COMMENT '工序名称',
    stage INT NOT NULL COMMENT '所属阶段：1-修复前 2-修复中 3-修复后',
    sort_order INT NOT NULL COMMENT '排序',
    required TINYINT DEFAULT 1 COMMENT '是否必须：0-否 1-是',
    description TEXT COMMENT '工序描述',
    standard_params TEXT COMMENT '标准参数JSON',
    status INT DEFAULT 1 COMMENT '状态：0-禁用 1-启用',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '是否删除：0-否 1-是'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='修复工序配置表';

-- 初始化工序数据
INSERT INTO repair_step (step_code, step_name, stage, sort_order, required, description) VALUES
('DETECT_001', '外观检测', 1, 1, 1, '对善本进行整体外观检查，记录破损情况'),
('DETECT_002', '纸张纤维检测', 1, 2, 1, '检测纸张材质、老化程度等'),
('DETECT_003', '酸碱度检测', 1, 3, 1, '检测纸张PH值'),
('REPAIR_001', '除尘清洁', 2, 1, 1, '对善本进行除尘清洁处理'),
('REPAIR_002', '脱酸处理', 2, 2, 0, '对酸性纸张进行脱酸处理'),
('REPAIR_003', '修补破损', 2, 3, 1, '修补破损页面'),
('REPAIR_004', '托裱加固', 2, 4, 0, '对脆弱页面进行托裱加固'),
('REPAIR_005', '装订复原', 2, 5, 1, '恢复原有装订形式'),
('ACCEPT_001', '修复质量检查', 3, 1, 1, '检查修复质量是否达标'),
('ACCEPT_002', '拍照存档', 3, 2, 1, '修复后拍照存档'),
('ACCEPT_003', '专家评审', 3, 3, 1, '专家评审验收');

-- ========================================
-- 3. 修复工艺库 (ancientbook_process)
-- ========================================
CREATE DATABASE IF NOT EXISTS ancientbook_process DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ancientbook_process;

CREATE TABLE IF NOT EXISTS repair_process (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    process_code VARCHAR(50) NOT NULL UNIQUE COMMENT '工艺编号',
    process_name VARCHAR(200) NOT NULL COMMENT '工艺名称',
    process_type INT NOT NULL COMMENT '工艺类型：1-清洁类 2-修补类 3-加固类 4-装订类',
    min_condition_level INT NOT NULL COMMENT '适用最小破损等级',
    max_condition_level INT NOT NULL COMMENT '适用最大破损等级',
    applicable_materials VARCHAR(200) COMMENT '适用材质，多个用逗号分隔',
    materials TEXT COMMENT '所需材料JSON',
    tools TEXT COMMENT '所需工具JSON',
    steps TEXT COMMENT '工艺步骤JSON',
    standard TEXT COMMENT '执行标准',
    duration_estimate INT COMMENT '预计耗时（分钟）',
    difficulty_level INT COMMENT '难度等级：1-简单 2-中等 3-复杂 4-高难',
    success_rate DECIMAL(5,2) COMMENT '成功率',
    creator_id BIGINT COMMENT '创建人ID',
    creator_name VARCHAR(50) COMMENT '创建人姓名',
    status INT DEFAULT 1 COMMENT '状态：0-禁用 1-启用',
    remark TEXT COMMENT '备注',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    create_by VARCHAR(50) COMMENT '创建人',
    update_by VARCHAR(50) COMMENT '更新人',
    deleted TINYINT DEFAULT 0 COMMENT '是否删除：0-否 1-是',
    INDEX idx_process_code (process_code),
    INDEX idx_process_type (process_type),
    INDEX idx_condition_level (min_condition_level, max_condition_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='修复工艺表';

CREATE TABLE IF NOT EXISTS process_material (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    material_code VARCHAR(50) NOT NULL UNIQUE COMMENT '材料编号',
    material_name VARCHAR(100) NOT NULL COMMENT '材料名称',
    material_type VARCHAR(50) COMMENT '材料类型',
    specification VARCHAR(200) COMMENT '规格型号',
    unit VARCHAR(20) COMMENT '单位',
    stock_quantity DECIMAL(10,2) COMMENT '库存数量',
    status INT DEFAULT 1 COMMENT '状态：0-禁用 1-启用',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '是否删除：0-否 1-是'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='修复材料表';

-- 初始化工艺数据
INSERT INTO repair_process (process_code, process_name, process_type, min_condition_level, max_condition_level, applicable_materials, difficulty_level, status) VALUES
('PROC_001', '干式除尘法', 1, 1, 4, '宣纸,皮纸,竹纸', 1, 1),
('PROC_002', '湿法清洁法', 1, 1, 3, '宣纸,皮纸', 2, 1),
('PROC_003', '纸浆修补法', 2, 2, 4, '宣纸,皮纸,竹纸', 3, 1),
('PROC_004', '托裱加固法', 3, 3, 4, '宣纸,皮纸', 4, 1),
('PROC_005', '线装复原法', 4, 1, 4, '宣纸,皮纸,竹纸', 3, 1);

-- ========================================
-- 4. 权限用户库 (ancientbook_auth)
-- ========================================
CREATE DATABASE IF NOT EXISTS ancientbook_auth DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ancientbook_auth;

CREATE TABLE IF NOT EXISTS sys_user (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    username VARCHAR(50) NOT NULL UNIQUE COMMENT '用户名',
    password VARCHAR(100) NOT NULL COMMENT '密码',
    real_name VARCHAR(50) NOT NULL COMMENT '真实姓名',
    phone VARCHAR(20) COMMENT '手机号',
    email VARCHAR(100) COMMENT '邮箱',
    avatar VARCHAR(255) COMMENT '头像',
    skill_level INT COMMENT '技能等级：1-初级 2-中级 3-高级 4-专家',
    specialty VARCHAR(200) COMMENT '专长领域',
    status INT DEFAULT 1 COMMENT '状态：0-禁用 1-启用',
    last_login_time DATETIME COMMENT '最后登录时间',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    create_by VARCHAR(50) COMMENT '创建人',
    update_by VARCHAR(50) COMMENT '更新人',
    deleted TINYINT DEFAULT 0 COMMENT '是否删除：0-否 1-是',
    INDEX idx_username (username),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

CREATE TABLE IF NOT EXISTS sys_role (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    role_code VARCHAR(50) NOT NULL UNIQUE COMMENT '角色编码',
    role_name VARCHAR(50) NOT NULL COMMENT '角色名称',
    description VARCHAR(200) COMMENT '角色描述',
    status INT DEFAULT 1 COMMENT '状态：0-禁用 1-启用',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '是否删除：0-否 1-是'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色表';

CREATE TABLE IF NOT EXISTS sys_permission (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    permission_code VARCHAR(100) NOT NULL UNIQUE COMMENT '权限编码',
    permission_name VARCHAR(100) NOT NULL COMMENT '权限名称',
    permission_type INT NOT NULL COMMENT '权限类型：1-菜单 2-按钮 3-接口',
    parent_id BIGINT DEFAULT 0 COMMENT '父权限ID',
    sort_order INT DEFAULT 0 COMMENT '排序',
    url VARCHAR(200) COMMENT '接口URL',
    method VARCHAR(20) COMMENT '请求方法',
    status INT DEFAULT 1 COMMENT '状态：0-禁用 1-启用',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '是否删除：0-否 1-是',
    INDEX idx_parent_id (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='权限表';

CREATE TABLE IF NOT EXISTS sys_user_role (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    user_id BIGINT NOT NULL COMMENT '用户ID',
    role_id BIGINT NOT NULL COMMENT '角色ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    UNIQUE KEY uk_user_role (user_id, role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户角色关联表';

CREATE TABLE IF NOT EXISTS sys_role_permission (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    role_id BIGINT NOT NULL COMMENT '角色ID',
    permission_id BIGINT NOT NULL COMMENT '权限ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    UNIQUE KEY uk_role_permission (role_id, permission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色权限关联表';

-- 初始化用户数据（密码：admin123，MD5加密）
INSERT INTO sys_user (username, password, real_name, phone, skill_level, status) VALUES
('admin', 'e00cf25ad42683b3df678c61f42c6bda', '系统管理员', '13800138000', 4, 1),
('restorer01', 'e00cf25ad42683b3df678c61f42c6bda', '张修复师', '13800138001', 3, 1),
('restorer02', 'e00cf25ad42683b3df678c61f42c6bda', '李修复师', '13800138002', 2, 1);

-- 初始化角色数据
INSERT INTO sys_role (role_code, role_name, description) VALUES
('ADMIN', '系统管理员', '系统最高权限'),
('SENIOR_RESTORER', '高级修复师', '可执行所有修复工序'),
('JUNIOR_RESTORER', '初级修复师', '仅可执行基础修复工序'),
('INSPECTOR', '检测员', '负责检测和验收'),
('ARCHIVIST', '档案员', '负责档案管理');

-- 初始化用户角色关联
INSERT INTO sys_user_role (user_id, role_id) VALUES
(1, 1),
(2, 2),
(3, 3);

-- ========================================
-- 5. 检测报告库 (ancientbook_detection)
-- ========================================
CREATE DATABASE IF NOT EXISTS ancientbook_detection DEFAULT CHARACTER SET utf8mb4 COLLATE=utf8mb4_unicode_ci;
USE ancientbook_detection;

CREATE TABLE IF NOT EXISTS detection_report (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    report_code VARCHAR(50) NOT NULL UNIQUE COMMENT '报告编号',
    book_id BIGINT NOT NULL COMMENT '善本ID',
    book_code VARCHAR(50) NOT NULL COMMENT '善本编号',
    detection_type INT NOT NULL COMMENT '检测类型：1-修复前检测 2-过程检测 3-修复后检测',
    third_party_code VARCHAR(100) COMMENT '第三方机构编号',
    third_party_name VARCHAR(200) COMMENT '第三方机构名称',
    reporter_id BIGINT COMMENT '报告人ID',
    reporter_name VARCHAR(50) COMMENT '报告人姓名',
    report_time DATETIME COMMENT '报告时间',
    ph_value DECIMAL(4,2) COMMENT '酸碱度PH值',
    fiber_type VARCHAR(100) COMMENT '纤维类型',
    aging_degree INT COMMENT '老化程度：1-轻微 2-中度 3-严重',
    damage_details TEXT COMMENT '破损详情JSON',
    images TEXT COMMENT '检测图片，多个用逗号分隔',
    conclusion TEXT COMMENT '检测结论',
    suggestions TEXT COMMENT '修复建议',
    sync_status INT DEFAULT 0 COMMENT '同步状态：0-未同步 1-已同步 2-同步失败',
    sync_time DATETIME COMMENT '同步时间',
    status INT DEFAULT 1 COMMENT '状态：0-草稿 1-正式',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    create_by VARCHAR(50) COMMENT '创建人',
    update_by VARCHAR(50) COMMENT '更新人',
    deleted TINYINT DEFAULT 0 COMMENT '是否删除：0-否 1-是',
    INDEX idx_report_code (report_code),
    INDEX idx_book_id (book_id),
    INDEX idx_detection_type (detection_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='检测报告表';

CREATE TABLE IF NOT EXISTS third_party_org (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    org_code VARCHAR(50) NOT NULL UNIQUE COMMENT '机构编号',
    org_name VARCHAR(200) NOT NULL COMMENT '机构名称',
    contact_person VARCHAR(50) COMMENT '联系人',
    contact_phone VARCHAR(20) COMMENT '联系电话',
    api_url VARCHAR(255) COMMENT 'API地址',
    api_key VARCHAR(255) COMMENT 'API密钥',
    status INT DEFAULT 1 COMMENT '状态：0-禁用 1-启用',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '是否删除：0-否 1-是'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='第三方检测机构表';

-- 初始化第三方机构数据
INSERT INTO third_party_org (org_code, org_name, contact_person, contact_phone) VALUES
('TEST_ORG_001', '国家图书馆古籍检测中心', '王工', '010-12345678'),
('TEST_ORG_002', '故宫博物院文保科技部', '李工', '010-87654321');

-- ========================================
-- 6. 修复档案库 (ancientbook_archive)
-- ========================================
CREATE DATABASE IF NOT EXISTS ancientbook_archive DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ancientbook_archive;

CREATE TABLE IF NOT EXISTS repair_archive (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    archive_code VARCHAR(50) NOT NULL UNIQUE COMMENT '档案编号',
    book_id BIGINT NOT NULL COMMENT '善本ID',
    book_code VARCHAR(50) NOT NULL COMMENT '善本编号',
    book_name VARCHAR(200) NOT NULL COMMENT '善本名称',
    start_time DATETIME COMMENT '修复开始时间',
    end_time DATETIME COMMENT '修复结束时间',
    total_duration INT COMMENT '总耗时（分钟）',
    restorer_ids TEXT COMMENT '修复人员ID列表，多个用逗号分隔',
    restorer_names TEXT COMMENT '修复人员姓名列表，多个用逗号分隔',
    process_ids TEXT COMMENT '使用工艺ID列表，多个用逗号分隔',
    material_usage TEXT COMMENT '材料使用情况JSON',
    before_images TEXT COMMENT '修复前图片',
    during_images TEXT COMMENT '修复中图片',
    after_images TEXT COMMENT '修复后图片',
    quality_score DECIMAL(3,1) COMMENT '综合质量评分',
    archive_content LONGBLOB COMMENT '加密的档案内容',
    content_hash VARCHAR(64) COMMENT '内容哈希值',
    encrypt_algorithm VARCHAR(50) COMMENT '加密算法',
    export_count INT DEFAULT 0 COMMENT '导出次数',
    last_export_time DATETIME COMMENT '最后导出时间',
    archivist_id BIGINT COMMENT '归档人ID',
    archivist_name VARCHAR(50) COMMENT '归档人姓名',
    archive_time DATETIME COMMENT '归档时间',
    status INT DEFAULT 0 COMMENT '状态：0-待归档 1-已归档 2-已借阅',
    remark TEXT COMMENT '备注',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    create_by VARCHAR(50) COMMENT '创建人',
    update_by VARCHAR(50) COMMENT '更新人',
    deleted TINYINT DEFAULT 0 COMMENT '是否删除：0-否 1-是',
    INDEX idx_archive_code (archive_code),
    INDEX idx_book_id (book_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='修复档案表';

CREATE TABLE IF NOT EXISTS archive_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    archive_id BIGINT NOT NULL COMMENT '档案ID',
    archive_code VARCHAR(50) NOT NULL COMMENT '档案编号',
    operation_type INT NOT NULL COMMENT '操作类型：1-创建 2-查看 3-导出 4-修改 5-借阅',
    operator_id BIGINT COMMENT '操作人ID',
    operator_name VARCHAR(50) COMMENT '操作人姓名',
    operation_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
    ip_address VARCHAR(50) COMMENT 'IP地址',
    remark VARCHAR(500) COMMENT '备注',
    INDEX idx_archive_id (archive_id),
    INDEX idx_operation_type (operation_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='档案操作日志表';

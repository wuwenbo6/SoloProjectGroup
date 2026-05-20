-- 非遗政务系统数据库初始化脚本
-- 创建时间: 2024

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 系统用户表
CREATE TABLE IF NOT EXISTS `system_users` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(50) NOT NULL UNIQUE COMMENT '用户名',
    `password` VARCHAR(255) NOT NULL COMMENT '密码',
    `real_name` VARCHAR(50) NOT NULL COMMENT '真实姓名',
    `phone` VARCHAR(20) COMMENT '手机号',
    `id_card` VARCHAR(18) COMMENT '身份证号',
    `role_id` TINYINT NOT NULL COMMENT '角色:1超级管理员,2审核人员,3录入人员,4查询人员',
    `status` TINYINT DEFAULT 1 COMMENT '状态:0禁用,1启用',
    `last_login_time` DATETIME COMMENT '最后登录时间',
    `last_login_ip` VARCHAR(50) COMMENT '最后登录IP',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_role` (`role_id`),
    INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统用户表';

-- 非遗技艺表
CREATE TABLE IF NOT EXISTS `heritage_skills` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `skill_no` VARCHAR(32) NOT NULL UNIQUE COMMENT '技艺编号',
    `name` VARCHAR(100) NOT NULL COMMENT '技艺名称',
    `category` VARCHAR(50) NOT NULL COMMENT '所属类别:传统技艺/传统美术/传统医药等',
    `level` TINYINT NOT NULL COMMENT '级别:1国家级,2省级,3市级,4县级',
    `origin_place` VARCHAR(100) COMMENT '发源地',
    `heritor_id` INT UNSIGNED COMMENT '传承人ID',
    `description` TEXT COMMENT '技艺描述',
    `historical_origin` TEXT COMMENT '历史渊源',
    `technical_features` TEXT COMMENT '技术特征',
    `material_requirements` TEXT COMMENT '材料要求',
    `tools_used` TEXT COMMENT '使用工具',
    `status` TINYINT DEFAULT 1 COMMENT '状态:0草稿,1待审核,2已通过,3已驳回',
    `audit_user_id` INT UNSIGNED COMMENT '审核人ID',
    `audit_time` DATETIME COMMENT '审核时间',
    `audit_remark` VARCHAR(500) COMMENT '审核意见',
    `entry_user_id` INT UNSIGNED COMMENT '录入人ID',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_skill_no` (`skill_no`),
    INDEX `idx_category` (`category`),
    INDEX `idx_level` (`level`),
    INDEX `idx_status` (`status`),
    INDEX `idx_heritor` (`heritor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='非遗技艺表';

-- 工序步骤表
CREATE TABLE IF NOT EXISTS `skill_processes` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `skill_id` INT UNSIGNED NOT NULL COMMENT '所属技艺ID',
    `process_no` VARCHAR(32) NOT NULL UNIQUE COMMENT '工序编号',
    `step_number` INT NOT NULL COMMENT '步骤序号',
    `name` VARCHAR(100) NOT NULL COMMENT '工序名称',
    `description` TEXT COMMENT '工序描述',
    `operation_points` TEXT COMMENT '操作要点',
    `quality_standard` TEXT COMMENT '质量标准',
    `duration_minutes` INT COMMENT '标准耗时(分钟)',
    `difficulty_level` TINYINT COMMENT '难度等级:1-5',
    `is_key_process` TINYINT DEFAULT 0 COMMENT '是否关键工序:0否,1是',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_skill_id` (`skill_id`),
    INDEX `idx_step_number` (`step_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工序步骤表';

-- 工序评分记录表
CREATE TABLE IF NOT EXISTS `process_scores` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `process_id` INT UNSIGNED NOT NULL COMMENT '工序ID',
    `skill_id` INT UNSIGNED NOT NULL COMMENT '技艺ID',
    `score_no` VARCHAR(32) NOT NULL UNIQUE COMMENT '评分编号',
    `item_name` VARCHAR(100) NOT NULL COMMENT '评分项名称',
    `standard_score` DECIMAL(5,2) NOT NULL COMMENT '标准分值',
    `actual_score` DECIMAL(5,2) COMMENT '实际得分',
    `weight` DECIMAL(4,2) DEFAULT 1.00 COMMENT '权重',
    `judge_user_id` INT UNSIGNED COMMENT '评定人ID',
    `judge_comment` VARCHAR(500) COMMENT '评定意见',
    `status` TINYINT DEFAULT 0 COMMENT '状态:0未评定,1已评分,2已确认',
    `judged_at` DATETIME COMMENT '评定时间',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_process_id` (`process_id`),
    INDEX `idx_skill_id` (`skill_id`),
    INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工序评分记录表';

-- 传承人表
CREATE TABLE IF NOT EXISTS `heritors` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `heritor_no` VARCHAR(32) NOT NULL UNIQUE COMMENT '传承人编号',
    `name` VARCHAR(50) NOT NULL COMMENT '姓名',
    `gender` TINYINT NOT NULL COMMENT '性别:1男,2女',
    `birth_date` DATE COMMENT '出生日期',
    `id_card` VARCHAR(18) UNIQUE COMMENT '身份证号',
    `phone` VARCHAR(20) COMMENT '联系电话',
    `address` VARCHAR(200) COMMENT '住址',
    `education` VARCHAR(50) COMMENT '文化程度',
    `title` VARCHAR(50) COMMENT '职称',
    `inheritance_level` TINYINT NOT NULL COMMENT '传承级别:1国家级,2省级,3市级,4县级',
    `inheritance_generation` VARCHAR(20) COMMENT '传承代次',
    `specialty` VARCHAR(500) COMMENT '专长',
    `personal_profile` TEXT COMMENT '个人简介',
    `qualification_status` TINYINT DEFAULT 0 COMMENT '资质状态:0待审核,1已认证,2已失效',
    `certificate_no` VARCHAR(50) COMMENT '证书编号',
    `certify_date` DATE COMMENT '认证日期',
    `expire_date` DATE COMMENT '有效期至',
    `audit_user_id` INT UNSIGNED COMMENT '审核人ID',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_heritor_no` (`heritor_no`),
    INDEX `idx_qualification` (`qualification_status`),
    INDEX `idx_inheritance_level` (`inheritance_level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='传承人表';

-- 定级档案表
CREATE TABLE IF NOT EXISTS `heritage_archives` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `archive_no` VARCHAR(32) NOT NULL UNIQUE COMMENT '档案编号',
    `skill_id` INT UNSIGNED NOT NULL COMMENT '技艺ID',
    `heritor_id` INT UNSIGNED COMMENT '传承人ID',
    `final_level` TINYINT NOT NULL COMMENT '最终定级:1国家级,2省级,3市级,4县级',
    `total_score` DECIMAL(8,2) COMMENT '总分',
    `archive_data` TEXT COMMENT '加密档案数据',
    `archive_hash` VARCHAR(64) NOT NULL COMMENT '档案哈希校验',
    `previous_hash` VARCHAR(64) COMMENT '上一版哈希(区块链溯源)',
    `digital_signature` VARCHAR(256) COMMENT '数字签名',
    `archive_status` TINYINT DEFAULT 1 COMMENT '档案状态:0作废,1有效',
    `archive_version` VARCHAR(20) DEFAULT '1.0' COMMENT '档案版本',
    `verify_count` INT DEFAULT 0 COMMENT '核验次数',
    `last_verify_time` DATETIME COMMENT '最后核验时间',
    `archiver_user_id` INT UNSIGNED COMMENT '归档人ID',
    `archived_at` DATETIME COMMENT '归档时间',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_archive_no` (`archive_no`),
    INDEX `idx_skill_id` (`skill_id`),
    INDEX `idx_hash` (`archive_hash`),
    INDEX `idx_archive_status` (`archive_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='定级档案表';

-- 档案溯源记录表
CREATE TABLE IF NOT EXISTS `archive_trace_logs` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `archive_id` INT UNSIGNED NOT NULL COMMENT '档案ID',
    `operation_type` VARCHAR(20) NOT NULL COMMENT '操作类型:create,update,verify,void',
    `operation_detail` VARCHAR(500) COMMENT '操作详情',
    `operator_user_id` INT UNSIGNED COMMENT '操作人ID',
    `before_hash` VARCHAR(64) COMMENT '操作前哈希',
    `after_hash` VARCHAR(64) COMMENT '操作后哈希',
    `ip_address` VARCHAR(50) COMMENT '操作IP',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_archive_id` (`archive_id`),
    INDEX `idx_operation_type` (`operation_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='档案溯源记录表';

-- 文旅系统对接记录表
CREATE TABLE IF NOT EXISTS `tourism_sync_logs` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `sync_no` VARCHAR(32) NOT NULL UNIQUE COMMENT '同步编号',
    `sync_direction` TINYINT NOT NULL COMMENT '同步方向:1推送至文旅,2从文旅拉取',
    `data_type` VARCHAR(30) NOT NULL COMMENT '数据类型:skill,heritor,archive',
    `data_id` VARCHAR(50) COMMENT '关联数据ID',
    `request_data` TEXT COMMENT '请求数据',
    `response_data` TEXT COMMENT '响应数据',
    `sync_status` TINYINT DEFAULT 0 COMMENT '同步状态:0待同步,1成功,2失败,3重试中',
    `retry_count` INT DEFAULT 0 COMMENT '重试次数',
    `error_message` VARCHAR(500) COMMENT '错误信息',
    `sync_time` DATETIME COMMENT '同步完成时间',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_sync_no` (`sync_no`),
    INDEX `idx_data_type` (`data_type`),
    INDEX `idx_sync_status` (`sync_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文旅系统对接记录表';

-- 行业标准表
CREATE TABLE IF NOT EXISTS `industry_standards` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `standard_no` VARCHAR(50) NOT NULL UNIQUE COMMENT '标准编号',
    `standard_name` VARCHAR(200) NOT NULL COMMENT '标准名称',
    `standard_type` VARCHAR(30) NOT NULL COMMENT '标准类型:国家标准/行业标准/地方标准',
    `category` VARCHAR(50) COMMENT '所属类别',
    `content` TEXT COMMENT '标准内容',
    `score_criteria` TEXT COMMENT '评分细则JSON',
    `publish_date` DATE COMMENT '发布日期',
    `implement_date` DATE COMMENT '实施日期',
    `status` TINYINT DEFAULT 1 COMMENT '状态:0失效,1有效',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_standard_no` (`standard_no`),
    INDEX `idx_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='行业标准表';

-- 系统通知表
CREATE TABLE IF NOT EXISTS `system_notifications` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NOT NULL COMMENT '接收用户ID',
    `type` VARCHAR(20) DEFAULT 'system' COMMENT '通知类型',
    `title` VARCHAR(200) NOT NULL COMMENT '标题',
    `content` TEXT COMMENT '内容',
    `is_read` TINYINT DEFAULT 0 COMMENT '是否已读:0否,1是',
    `read_time` DATETIME COMMENT '阅读时间',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_is_read` (`is_read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统通知表';

-- 操作日志表
CREATE TABLE IF NOT EXISTS `operation_logs` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED COMMENT '操作人ID',
    `module` VARCHAR(30) NOT NULL COMMENT '模块',
    `action` VARCHAR(50) NOT NULL COMMENT '操作动作',
    `request_method` VARCHAR(10) COMMENT '请求方法',
    `request_url` VARCHAR(200) COMMENT '请求URL',
    `request_params` TEXT COMMENT '请求参数',
    `response_code` INT COMMENT '响应码',
    `ip_address` VARCHAR(50) COMMENT 'IP地址',
    `user_agent` VARCHAR(500) COMMENT '客户端信息',
    `execution_time` INT COMMENT '执行耗时(ms)',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_module` (`module`),
    INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作日志表';

-- 插入初始化数据
-- 超级管理员账号: admin / admin123
INSERT INTO `system_users` (`username`, `password`, `real_name`, `phone`, `role_id`, `status`) VALUES
('admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '系统管理员', '13800138000', 1, 1),
('auditor01', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '审核员张三', '13800138001', 2, 1),
('entry01', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '录入员李四', '13800138002', 3, 1),
('query01', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '查询员王五', '13800138003', 4, 1);

-- 行业标准示例数据
INSERT INTO `industry_standards` (`standard_no`, `standard_name`, `standard_type`, `category`, `content`, `score_criteria`, `publish_date`, `implement_date`, `status`) VALUES
('GB/T 39557-2020', '非物质文化遗产 记录规范', '国家标准', '基础标准', '规定了非物质文化遗产记录的基本原则、内容要求和方法', '{}', '2020-12-14', '2021-07-01', 1),
('WH/T 001-2023', '非遗技艺评定通用标准', '行业标准', '评定标准', '规定了非遗技艺评定的通用流程和标准', '{}', '2023-01-01', '2023-06-01', 1);

-- 工序视频资料表
CREATE TABLE IF NOT EXISTS `process_videos` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `video_no` VARCHAR(32) NOT NULL UNIQUE COMMENT '视频编号',
    `skill_id` INT UNSIGNED NOT NULL COMMENT '技艺ID',
    `process_id` INT UNSIGNED NOT NULL COMMENT '工序ID',
    `original_name` VARCHAR(255) NOT NULL COMMENT '原始文件名',
    `file_path` VARCHAR(500) NOT NULL COMMENT '加密存储路径',
    `file_size` BIGINT UNSIGNED NOT NULL COMMENT '文件大小(字节)',
    `file_hash` VARCHAR(64) NOT NULL COMMENT '文件SHA256哈希',
    `encryption_key` VARCHAR(255) NOT NULL COMMENT '加密密钥(加密存储)',
    `video_duration` INT UNSIGNED COMMENT '视频时长(秒)',
    `video_format` VARCHAR(20) COMMENT '视频格式',
    `video_resolution` VARCHAR(20) COMMENT '分辨率',
    `thumbnail_path` VARCHAR(500) COMMENT '缩略图路径',
    `description` TEXT COMMENT '视频描述',
    `upload_user_id` INT UNSIGNED NOT NULL COMMENT '上传人ID',
    `status` TINYINT DEFAULT 1 COMMENT '状态:0禁用,1正常,2待审核',
    `download_count` INT UNSIGNED DEFAULT 0 COMMENT '下载次数',
    `view_count` INT UNSIGNED DEFAULT 0 COMMENT '查看次数',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_skill_id` (`skill_id`),
    INDEX `idx_process_id` (`process_id`),
    INDEX `idx_video_no` (`video_no`),
    INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工序视频资料表';

-- PDF归档记录表
CREATE TABLE IF NOT EXISTS `pdf_archives` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `archive_no` VARCHAR(32) NOT NULL UNIQUE COMMENT '归档编号',
    `archive_type` VARCHAR(20) NOT NULL COMMENT '归档类型:skill,process,heritor',
    `title` VARCHAR(200) NOT NULL COMMENT '归档标题',
    `file_path` VARCHAR(500) NOT NULL COMMENT 'PDF文件路径',
    `file_size` BIGINT UNSIGNED NOT NULL COMMENT '文件大小(字节)',
    `file_hash` VARCHAR(64) NOT NULL COMMENT '文件SHA256哈希',
    `item_ids` TEXT COMMENT '包含的记录ID列表(JSON)',
    `item_count` INT UNSIGNED DEFAULT 0 COMMENT '包含记录数',
    `generate_user_id` INT UNSIGNED NOT NULL COMMENT '生成人ID',
    `status` TINYINT DEFAULT 1 COMMENT '状态:0失效,1有效',
    `download_count` INT UNSIGNED DEFAULT 0 COMMENT '下载次数',
    `generated_at` DATETIME COMMENT '生成时间',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_archive_no` (`archive_no`),
    INDEX `idx_archive_type` (`archive_type`),
    INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='PDF归档记录表';

-- 技艺等级复审记录表
CREATE TABLE IF NOT EXISTS `skill_reviews` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `review_no` VARCHAR(32) NOT NULL UNIQUE COMMENT '复审编号',
    `skill_id` INT UNSIGNED NOT NULL COMMENT '技艺ID',
    `skill_name` VARCHAR(100) COMMENT '技艺名称',
    `current_level` TINYINT NOT NULL COMMENT '当前等级',
    `review_type` VARCHAR(20) NOT NULL COMMENT '复审类型:regular-定期,special-特别,upgrade-升级申请',
    `review_cycle` VARCHAR(20) COMMENT '复审周期:annual-年度,biennial-两年,triennial-三年',
    `review_status` TINYINT DEFAULT 0 COMMENT '复审状态:0-待审核,1-审核中,2-通过,3-不通过,4-需整改',
    `review_score` DECIMAL(5,2) COMMENT '复审得分',
    `review_opinion` TEXT COMMENT '复审意见',
    `reviewer_id` INT UNSIGNED COMMENT '审核人ID',
    `reviewer_name` VARCHAR(50) COMMENT '审核人姓名',
    `reviewed_at` DATETIME COMMENT '审核时间',
    `next_review_date` DATE COMMENT '下次复审日期',
    `auto_review` TINYINT DEFAULT 0 COMMENT '是否自动复审:0-否,1-是',
    `auto_review_result` TEXT COMMENT '自动复审结果(JSON)',
    `remark` TEXT COMMENT '备注',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_skill_id` (`skill_id`),
    INDEX `idx_review_status` (`review_status`),
    INDEX `idx_next_review_date` (`next_review_date`),
    INDEX `idx_review_type` (`review_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='技艺等级复审记录表';

-- 定时任务调度表
CREATE TABLE IF NOT EXISTS `scheduled_tasks` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `task_name` VARCHAR(100) NOT NULL COMMENT '任务名称',
    `task_code` VARCHAR(50) NOT NULL UNIQUE COMMENT '任务代码',
    `task_type` VARCHAR(20) NOT NULL COMMENT '任务类型:cron,interval,one_time',
    `cron_expression` VARCHAR(50) COMMENT 'Cron表达式',
    `interval_seconds` INT UNSIGNED COMMENT '间隔秒数',
    `task_handler` VARCHAR(200) NOT NULL COMMENT '任务处理器',
    `task_params` TEXT COMMENT '任务参数(JSON)',
    `status` TINYINT DEFAULT 1 COMMENT '状态:0-禁用,1-启用',
    `last_run_time` DATETIME COMMENT '上次运行时间',
    `next_run_time` DATETIME COMMENT '下次运行时间',
    `last_run_result` TEXT COMMENT '上次运行结果(JSON)',
    `run_count` INT UNSIGNED DEFAULT 0 COMMENT '运行次数',
    `success_count` INT UNSIGNED DEFAULT 0 COMMENT '成功次数',
    `fail_count` INT UNSIGNED DEFAULT 0 COMMENT '失败次数',
    `timeout_seconds` INT DEFAULT 300 COMMENT '超时时间(秒)',
    `max_retry` TINYINT DEFAULT 3 COMMENT '最大重试次数',
    `created_by` VARCHAR(50) COMMENT '创建人',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_task_code` (`task_code`),
    INDEX `idx_status` (`status`),
    INDEX `idx_next_run_time` (`next_run_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='定时任务调度表';

-- 异地文旅平台配置表
CREATE TABLE IF NOT EXISTS `remote_platforms` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `platform_code` VARCHAR(50) NOT NULL UNIQUE COMMENT '平台代码',
    `platform_name` VARCHAR(100) NOT NULL COMMENT '平台名称',
    `region_code` VARCHAR(20) COMMENT '行政区划代码',
    `region_name` VARCHAR(100) COMMENT '行政区划名称',
    `api_endpoint` VARCHAR(500) NOT NULL COMMENT 'API端点地址',
    `auth_type` VARCHAR(20) DEFAULT 'token' COMMENT '认证方式:token,appkey,none',
    `app_key` VARCHAR(100) COMMENT '应用Key',
    `app_secret` VARCHAR(200) COMMENT '应用密钥',
    `access_token` TEXT COMMENT '访问令牌',
    `token_expires_at` DATETIME COMMENT '令牌过期时间',
    `sync_direction` VARCHAR(20) DEFAULT 'both' COMMENT '同步方向:in,out,both',
    `sync_skills` TINYINT DEFAULT 1 COMMENT '是否同步技艺',
    `sync_heritors` TINYINT DEFAULT 1 COMMENT '是否同步传承人',
    `sync_standards` TINYINT DEFAULT 0 COMMENT '是否同步标准',
    `field_mapping_id` INT UNSIGNED COMMENT '字段映射配置ID',
    `status` TINYINT DEFAULT 1 COMMENT '状态:0-禁用,1-启用',
    `last_sync_time` DATETIME COMMENT '上次同步时间',
    `sync_interval_minutes` INT DEFAULT 60 COMMENT '同步间隔(分钟)',
    `remark` TEXT COMMENT '备注',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_platform_code` (`platform_code`),
    INDEX `idx_region_code` (`region_code`),
    INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='异地文旅平台配置表';

-- 接口操作审计日志表
CREATE TABLE IF NOT EXISTS `audit_logs` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `trace_id` VARCHAR(64) NOT NULL COMMENT '链路追踪ID',
    `span_id` VARCHAR(64) COMMENT '跨度ID',
    `parent_span_id` VARCHAR(64) COMMENT '父跨度ID',
    `user_id` INT UNSIGNED COMMENT '用户ID',
    `user_name` VARCHAR(50) COMMENT '用户名',
    `user_ip` VARCHAR(50) COMMENT '用户IP',
    `user_agent` VARCHAR(500) COMMENT '用户代理',
    `request_method` VARCHAR(10) NOT NULL COMMENT '请求方法',
    `request_url` VARCHAR(1000) NOT NULL COMMENT '请求URL',
    `request_path` VARCHAR(500) COMMENT '请求路径',
    `request_params` TEXT COMMENT '请求参数(JSON)',
    `request_headers` TEXT COMMENT '请求头(JSON)',
    `request_body` LONGTEXT COMMENT '请求体',
    `response_status` INT COMMENT '响应状态码',
    `response_data` LONGTEXT COMMENT '响应数据',
    `response_time` INT UNSIGNED COMMENT '响应时间(毫秒)',
    `error_code` VARCHAR(50) COMMENT '错误码',
    `error_message` TEXT COMMENT '错误信息',
    `module` VARCHAR(50) COMMENT '模块',
    `operation` VARCHAR(50) COMMENT '操作类型',
    `operation_desc` VARCHAR(200) COMMENT '操作描述',
    `resource_type` VARCHAR(50) COMMENT '资源类型',
    `resource_id` VARCHAR(100) COMMENT '资源ID',
    `platform_code` VARCHAR(50) COMMENT '平台代码(异地平台)',
    `sync_direction` VARCHAR(20) COMMENT '同步方向:in,out',
    `status` TINYINT DEFAULT 1 COMMENT '状态:0-失败,1-成功',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_trace_id` (`trace_id`),
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_request_path` (`request_path`(255)),
    INDEX `idx_created_at` (`created_at`),
    INDEX `idx_status` (`status`),
    INDEX `idx_module_operation` (`module`, `operation`),
    INDEX `idx_platform_code` (`platform_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='接口操作审计日志表';

-- API限流表
CREATE TABLE IF NOT EXISTS `rate_limits` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `cache_key` VARCHAR(100) NOT NULL UNIQUE COMMENT '限流键',
    `request_count` INT UNSIGNED DEFAULT 0 COMMENT '请求数',
    `window_start` INT UNSIGNED NOT NULL COMMENT '时间窗口开始时间戳',
    `expire_at` INT UNSIGNED NOT NULL COMMENT '过期时间戳',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_cache_key` (`cache_key`),
    INDEX `idx_expire_at` (`expire_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='API限流统计表';

-- 插入默认定时任务
INSERT INTO `scheduled_tasks` (`task_name`, `task_code`, `task_type`, `cron_expression`, `interval_seconds`, `task_handler`, `task_params`, `status`, `timeout_seconds`, `max_retry`, `created_by`) VALUES
('非遗技艺等级自动复审', 'skill_auto_review', 'interval', NULL, 3600, 'Modules\review\AutoReviewHandler::execute', '{"auto_approve": true}', 1, 600, 3, 'system'),
('异地文旅平台数据同步', 'remote_platform_sync', 'interval', NULL, 1800, 'Modules\integration\RemotePlatformAdapter::syncTaskHandler', '{"sync_all": true}', 1, 600, 3, 'system'),
('日志表数据清理', 'log_cleanup', 'cron', '0 2 * * *', NULL, 'Core\Task::cleanupOldLogs', '{"keep_days": 90}', 1, 300, 2, 'system');

SET FOREIGN_KEY_CHECKS = 1;

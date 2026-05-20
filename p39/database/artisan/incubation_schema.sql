-- 匠人入驻申请表
CREATE TABLE IF NOT EXISTS artisan_application (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '申请ID',
    user_id BIGINT NOT NULL COMMENT '用户ID',
    real_name VARCHAR(100) NOT NULL COMMENT '真实姓名',
    id_card VARCHAR(20) NOT NULL COMMENT '身份证号',
    phone VARCHAR(20) NOT NULL COMMENT '手机号',
    email VARCHAR(100) COMMENT '邮箱',
    province VARCHAR(50) COMMENT '省份',
    city VARCHAR(50) COMMENT '城市',
    address VARCHAR(500) COMMENT '详细地址',
    craft_type VARCHAR(100) NOT NULL COMMENT '工艺类型',
    craft_title VARCHAR(100) COMMENT '职称/头衔',
    experience_years INT COMMENT '从业年限',
    bio TEXT NOT NULL COMMENT '个人简介',
    skill_desc TEXT NOT NULL COMMENT '技能描述',
    representative_works JSON COMMENT '代表作品列表',
    id_card_front VARCHAR(500) COMMENT '身份证正面照',
    id_card_back VARCHAR(500) COMMENT '身份证反面照',
    certificate_images JSON COMMENT '资质证书图片列表',
    status TINYINT DEFAULT 0 COMMENT '状态 0-待审核 1-审核通过 2-审核拒绝',
    reject_reason VARCHAR(500) COMMENT '拒绝原因',
    auditor_id BIGINT COMMENT '审核人ID',
    audit_time DATETIME COMMENT '审核时间',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    version INT DEFAULT 0 COMMENT '乐观锁版本',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    UNIQUE KEY uk_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='匠人入驻申请表';

-- 匠人技能认证表
CREATE TABLE IF NOT EXISTS artisan_skill_cert (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '认证ID',
    artisan_id BIGINT NOT NULL COMMENT '匠人ID',
    skill_name VARCHAR(100) NOT NULL COMMENT '技能名称',
    skill_level TINYINT NOT NULL COMMENT '技能等级 1-初级 2-中级 3-高级 4-大师级',
    certificate_no VARCHAR(100) COMMENT '证书编号',
    issuing_authority VARCHAR(200) COMMENT '颁发机构',
    issue_date DATE COMMENT '颁发日期',
    expiry_date DATE COMMENT '有效期至',
    certificate_image VARCHAR(500) COMMENT '证书图片',
    status TINYINT DEFAULT 1 COMMENT '状态 0-无效 1-有效',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    version INT DEFAULT 0 COMMENT '乐观锁版本',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    INDEX idx_artisan_id (artisan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='匠人技能认证表';

-- 培训课程表
CREATE TABLE IF NOT EXISTS training_course (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '课程ID',
    title VARCHAR(200) NOT NULL COMMENT '课程名称',
    description TEXT COMMENT '课程描述',
    cover_image VARCHAR(500) COMMENT '课程封面',
    category VARCHAR(100) COMMENT '课程分类',
    course_type TINYINT DEFAULT 1 COMMENT '课程类型 1-线上 2-线下',
    level TINYINT DEFAULT 1 COMMENT '难度等级 1-入门 2-进阶 3-高级',
    duration INT COMMENT '课程时长(分钟)',
    price DECIMAL(10,2) DEFAULT 0.00 COMMENT '课程价格',
    instructor_id BIGINT COMMENT '讲师ID',
    instructor_name VARCHAR(100) COMMENT '讲师名称',
    start_date DATE COMMENT '开课日期',
    end_date DATE COMMENT '结束日期',
    location VARCHAR(500) COMMENT '上课地点',
    max_students INT COMMENT '最大学员数',
    current_students INT DEFAULT 0 COMMENT '当前报名人数',
    content TEXT COMMENT '课程内容',
    syllabus JSON COMMENT '课程大纲',
    materials JSON COMMENT '配套材料',
    status TINYINT DEFAULT 1 COMMENT '状态 0-下架 1-招生中 2-已结束',
    view_count INT DEFAULT 0 COMMENT '浏览次数',
    enroll_count INT DEFAULT 0 COMMENT '报名次数',
    rating DECIMAL(3,2) DEFAULT 5.00 COMMENT '评分',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    version INT DEFAULT 0 COMMENT '乐观锁版本',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    INDEX idx_category (category),
    INDEX idx_status (status),
    INDEX idx_instructor_id (instructor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='培训课程表';

-- 课程报名表
CREATE TABLE IF NOT EXISTS training_enrollment (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '报名ID',
    course_id BIGINT NOT NULL COMMENT '课程ID',
    user_id BIGINT NOT NULL COMMENT '用户ID',
    user_name VARCHAR(100) COMMENT '用户姓名',
    user_phone VARCHAR(20) COMMENT '用户手机号',
    status TINYINT DEFAULT 1 COMMENT '状态 1-已报名 2-已取消 3-已完成',
    enroll_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '报名时间',
    complete_time DATETIME COMMENT '完成时间',
    rating TINYINT COMMENT '课程评分 1-5',
    review TEXT COMMENT '课程评价',
    certificate_url VARCHAR(500) COMMENT '结业证书URL',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    version INT DEFAULT 0 COMMENT '乐观锁版本',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    UNIQUE KEY uk_course_user (course_id, user_id),
    INDEX idx_user_id (user_id),
    INDEX idx_course_id (course_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='课程报名表';

-- 课程章节表
CREATE TABLE IF NOT EXISTS training_chapter (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '章节ID',
    course_id BIGINT NOT NULL COMMENT '课程ID',
    title VARCHAR(200) NOT NULL COMMENT '章节名称',
    description TEXT COMMENT '章节描述',
    video_url VARCHAR(500) COMMENT '视频URL',
    duration INT COMMENT '视频时长(秒)',
    sort_order INT DEFAULT 0 COMMENT '排序',
    is_free TINYINT DEFAULT 0 COMMENT '是否免费 0-否 1-是',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    version INT DEFAULT 0 COMMENT '乐观锁版本',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    INDEX idx_course_id (course_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='课程章节表';

-- 匠人孵化扶持政策表
CREATE TABLE IF NOT EXISTS incubation_policy (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '政策ID',
    title VARCHAR(200) NOT NULL COMMENT '政策名称',
    type VARCHAR(100) COMMENT '政策类型',
    description TEXT COMMENT '政策描述',
    content TEXT COMMENT '详细内容',
    requirements TEXT COMMENT '申请条件',
    benefits TEXT COMMENT '扶持福利',
    application_process TEXT COMMENT '申请流程',
    start_date DATE COMMENT '开始日期',
    end_date DATE COMMENT '结束日期',
    status TINYINT DEFAULT 1 COMMENT '状态 0-下架 1-进行中',
    view_count INT DEFAULT 0 COMMENT '浏览次数',
    apply_count INT DEFAULT 0 COMMENT '申请次数',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    version INT DEFAULT 0 COMMENT '乐观锁版本',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    INDEX idx_type (type),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='匠人孵化扶持政策表';

-- 政策申请表
CREATE TABLE IF NOT EXISTS policy_application (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '申请ID',
    policy_id BIGINT NOT NULL COMMENT '政策ID',
    artisan_id BIGINT NOT NULL COMMENT '匠人ID',
    application_data JSON COMMENT '申请数据',
    status TINYINT DEFAULT 0 COMMENT '状态 0-待审核 1-审核通过 2-审核拒绝',
    reject_reason VARCHAR(500) COMMENT '拒绝原因',
    auditor_id BIGINT COMMENT '审核人ID',
    audit_time DATETIME COMMENT '审核时间',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    version INT DEFAULT 0 COMMENT '乐观锁版本',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    INDEX idx_policy_id (policy_id),
    INDEX idx_artisan_id (artisan_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='政策申请表';

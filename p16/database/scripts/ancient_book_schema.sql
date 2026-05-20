-- =============================================
-- 古籍修复系统数据库设计
-- 分库存储设计：古籍原版素材库、修复草稿库、释义对照库
-- =============================================

-- 创建数据库
CREATE DATABASE IF NOT EXISTS ancient_book DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ancient_book;

-- =============================================
-- 1. 古籍原版素材库 (Original Materials Library)
-- =============================================

-- 古籍书籍表
CREATE TABLE ancient_books (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '书籍ID',
    book_name VARCHAR(200) NOT NULL COMMENT '书籍名称',
    book_author VARCHAR(200) COMMENT '作者',
    book_dynasty VARCHAR(100) COMMENT '朝代',
    book_category VARCHAR(100) COMMENT '分类：经、史、子、集',
    total_pages INT DEFAULT 0 COMMENT '总页数',
    storage_path VARCHAR(500) COMMENT '存储路径',
    description TEXT COMMENT '书籍描述',
    status TINYINT DEFAULT 1 COMMENT '状态：0-禁用 1-正常',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_book_name (book_name),
    INDEX idx_dynasty (book_dynasty)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT '古籍书籍表';

-- 古籍页表（存储单页古籍信息）
CREATE TABLE ancient_book_pages (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '页面ID',
    book_id BIGINT NOT NULL COMMENT '书籍ID',
    page_number INT NOT NULL COMMENT '页码',
    original_image_path VARCHAR(500) NOT NULL COMMENT '原始图像路径',
    restored_image_path VARCHAR(500) COMMENT '修复后图像路径',
    extracted_text TEXT COMMENT '提取的文字内容',
    segmented_text TEXT COMMENT '分词后的文本',
    semantic_tags VARCHAR(500) COMMENT '语义标签',
    damage_areas JSON COMMENT '残损区域坐标(JSON格式)',
    damage_level TINYINT DEFAULT 0 COMMENT '残损程度：0-完好 1-轻微 2-中度 3-严重',
    variant_characters VARCHAR(500) COMMENT '异体字列表',
    restoration_status TINYINT DEFAULT 0 COMMENT '修复状态：0-待处理 1-处理中 2-已完成 3-需复核',
    operator_id BIGINT COMMENT '操作人员ID',
    remark TEXT COMMENT '备注',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_book_id (book_id),
    INDEX idx_page_number (page_number),
    INDEX idx_restoration_status (restoration_status),
    FOREIGN KEY (book_id) REFERENCES ancient_books(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT '古籍页表';

-- 字符特征表（存储单个字符的特征）
CREATE TABLE character_features (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '特征ID',
    page_id BIGINT NOT NULL COMMENT '页面ID',
    char_value VARCHAR(10) NOT NULL COMMENT '字符值',
    char_image_path VARCHAR(500) COMMENT '字符图像路径',
    position_x INT COMMENT '在页面中的X坐标',
    position_y INT COMMENT '在页面中的Y坐标',
    width INT COMMENT '宽度',
    height INT COMMENT '高度',
    stroke_count INT COMMENT '笔画数',
    feature_vector JSON COMMENT '特征向量数据',
    is_variant TINYINT DEFAULT 0 COMMENT '是否异体字：0-否 1-是',
    standard_char VARCHAR(10) COMMENT '对应标准字',
    confidence DECIMAL(5,4) COMMENT '识别置信度',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_page_id (page_id),
    INDEX idx_char_value (char_value),
    FOREIGN KEY (page_id) REFERENCES ancient_book_pages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT '字符特征表';

-- =============================================
-- 2. 修复草稿库 (Restoration Draft Library)
-- =============================================

-- 修复草稿表
CREATE TABLE restoration_drafts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '草稿ID',
    page_id BIGINT NOT NULL COMMENT '关联页面ID',
    draft_name VARCHAR(200) COMMENT '草稿名称',
    draft_content TEXT COMMENT '草稿内容',
    draft_image_path VARCHAR(500) COMMENT '草稿图像路径',
    restoration_step INT DEFAULT 1 COMMENT '修复步骤：1-图像预处理 2-文字提取 3-断句校准 4-异体字转换 5-完成',
    ai_suggestions TEXT COMMENT 'AI修复建议',
    manual_edits JSON COMMENT '人工编辑记录',
    operator_id BIGINT COMMENT '操作人员ID',
    operation_log TEXT COMMENT '操作日志',
    parent_draft_id BIGINT DEFAULT 0 COMMENT '父草稿ID（用于版本管理）',
    version INT DEFAULT 1 COMMENT '版本号',
    is_current TINYINT DEFAULT 1 COMMENT '是否当前版本：0-否 1-是',
    status TINYINT DEFAULT 1 COMMENT '状态：0-废弃 1-正常 2-已提交',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_page_id (page_id),
    INDEX idx_operator (operator_id),
    FOREIGN KEY (page_id) REFERENCES ancient_book_pages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT '修复草稿表';

-- 残页拼接记录表
CREATE TABLE page_assembly_records (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '记录ID',
    assembly_name VARCHAR(200) COMMENT '拼接名称',
    page_ids JSON NOT NULL COMMENT '参与拼接的页面ID列表',
    assembly_order JSON COMMENT '拼接顺序',
    assembly_image_path VARCHAR(500) COMMENT '拼接后图像路径',
    assembly_text TEXT COMMENT '拼接后的完整文本',
    operator_id BIGINT COMMENT '操作人员ID',
    status TINYINT DEFAULT 1 COMMENT '状态：0-草稿 1-已完成',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_operator (operator_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT '残页拼接记录表';

-- =============================================
-- 3. 释义对照库 (Interpretation Reference Library)
-- =============================================

-- 释义对照表
CREATE TABLE interpretations (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '释义ID',
    ancient_text VARCHAR(500) NOT NULL COMMENT '古文原文',
    modern_translation TEXT COMMENT '现代文翻译',
    pinyin VARCHAR(500) COMMENT '拼音标注',
    variant_forms VARCHAR(500) COMMENT '异体字形式（JSON数组）',
    semantic_meaning TEXT COMMENT '语义解释',
    historical_context TEXT COMMENT '历史背景',
    source_references TEXT COMMENT '出处引用',
    part_of_speech VARCHAR(50) COMMENT '词性',
    usage_examples JSON COMMENT '用法示例',
    related_words VARCHAR(500) COMMENT '相关词汇',
    confidence DECIMAL(5,4) DEFAULT 0.9 COMMENT '释义置信度',
    source_type VARCHAR(50) COMMENT '来源类型：ai-自动生成 manual-人工编辑 verified-专家审定',
    verifier_id BIGINT COMMENT '审定人ID',
    verified_time DATETIME COMMENT '审定时间',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_ancient_text (ancient_text),
    INDEX idx_source_type (source_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT '释义对照表';

-- 异体字映射表
CREATE TABLE variant_char_mapping (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '映射ID',
    variant_char VARCHAR(10) NOT NULL COMMENT '异体字',
    standard_char VARCHAR(10) NOT NULL COMMENT '标准字',
    dynasty VARCHAR(100) COMMENT '出现朝代',
    source TEXT COMMENT '来源说明',
    usage_count INT DEFAULT 0 COMMENT '使用频次',
    similarity DECIMAL(5,4) COMMENT '字形相似度',
    status TINYINT DEFAULT 1 COMMENT '状态：0-待确认 1-已确认',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    UNIQUE KEY uk_variant_standard (variant_char, standard_char),
    INDEX idx_standard_char (standard_char)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT '异体字映射表';

-- 经典文献语料库
CREATE TABLE classical_corpus (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '语料ID',
    corpus_text TEXT NOT NULL COMMENT '语料文本',
    source_book VARCHAR(200) COMMENT '来源书籍',
    source_chapter VARCHAR(200) COMMENT '来源章节',
    text_length INT COMMENT '文本长度',
    word_count INT COMMENT '词汇数量',
    sentence_count INT COMMENT '句子数量',
    tags VARCHAR(500) COMMENT '标签',
    is_verified TINYINT DEFAULT 0 COMMENT '是否已验证：0-否 1-是',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_source_book (source_book),
    FULLTEXT INDEX ft_corpus_text (corpus_text)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT '经典文献语料库';

-- =============================================
-- 4. 系统管理表
-- =============================================

-- 用户表
CREATE TABLE sys_users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '用户ID',
    username VARCHAR(50) NOT NULL UNIQUE COMMENT '用户名',
    password VARCHAR(200) NOT NULL COMMENT '密码',
    real_name VARCHAR(50) COMMENT '真实姓名',
    email VARCHAR(100) COMMENT '邮箱',
    phone VARCHAR(20) COMMENT '手机号',
    role TINYINT DEFAULT 1 COMMENT '角色：1-普通用户 2-专家 3-管理员',
    expertise VARCHAR(500) COMMENT '专业领域',
    status TINYINT DEFAULT 1 COMMENT '状态：0-禁用 1-正常',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT '系统用户表';

-- 操作日志表
CREATE TABLE operation_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '日志ID',
    user_id BIGINT COMMENT '用户ID',
    operation_type VARCHAR(50) COMMENT '操作类型：upload upload delete verify restore',
    operation_module VARCHAR(50) COMMENT '操作模块：book page draft interpretation',
    target_id BIGINT COMMENT '操作目标ID',
    description TEXT COMMENT '操作描述',
    ip_address VARCHAR(50) COMMENT 'IP地址',
    user_agent VARCHAR(500) COMMENT '用户代理',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_user_id (user_id),
    INDEX idx_operation_type (operation_type),
    INDEX idx_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT '操作日志表';

-- =============================================
-- 5. 初始化数据
-- =============================================

-- 初始化管理员用户
INSERT INTO sys_users (username, password, real_name, role, status) 
VALUES ('admin', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iAt6Z5EH', '系统管理员', 3, 1);

-- 初始化示例书籍
INSERT INTO ancient_books (book_name, book_author, book_dynasty, book_category, total_pages, description, status) VALUES
('论语', '孔子及其弟子', '春秋', '经', 20, '《论语》是儒家经典之一，记录了孔子及其弟子的言行，是研究孔子思想的重要文献。', 1),
('孟子', '孟子及其弟子', '战国', '经', 14, '《孟子》是儒家经典之一，记录了孟子的政治主张和哲学思想。', 1),
('大学', '曾子', '春秋', '经', 1, '《大学》是儒家经典之一，论述了修身齐家治国平天下的思想。', 1);

-- 初始化示例释义
INSERT INTO interpretations (ancient_text, modern_translation, pinyin, semantic_meaning, source_type, confidence) VALUES
('学而时习之', '学习并且按时温习', 'xué ér shí xí zhī', '孔子强调学习的重要性，主张学习后要及时复习巩固。', 'verified', 0.98),
('不亦说乎', '不是很快乐吗', 'bù yì yuè hū', '这里的"说"通"悦"，表示喜悦、快乐的意思。', 'verified', 0.95),
('有朋自远方来', '有志同道合的人从远方来', 'yǒu péng zì yuǎn fāng lái', '表示交友之乐，与志同道合的人交往是快乐的事情。', 'verified', 0.97);

-- 初始化异体字映射
INSERT INTO variant_char_mapping (variant_char, standard_char, dynasty, source, usage_count, similarity, status) VALUES
('说', '悦', '春秋', '《论语》通假字', 156, 0.85, 1),
('见', '现', '先秦', '古籍通假字', 89, 0.75, 1),
('反', '返', '先秦', '古籍通假字', 67, 0.70, 1),
('蚤', '早', '先秦', '古籍通假字', 45, 0.65, 1),
('距', '拒', '先秦', '古籍通假字', 34, 0.72, 1);

-- 初始化示例语料
INSERT INTO classical_corpus (corpus_text, source_book, source_chapter, text_length, word_count, sentence_count, tags, is_verified) VALUES
('学而时习之，不亦说乎？有朋自远方来，不亦乐乎？人不知而不愠，不亦君子乎？', '论语', '学而篇', 66, 35, 3, '修身,学习,交友', 1),
('吾日三省吾身：为人谋而不忠乎？与朋友交而不信乎？传不习乎？', '论语', '学而篇', 62, 32, 3, '修身,反省', 1);

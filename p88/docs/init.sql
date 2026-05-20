-- =========================================
-- 榫卯家具采集系统 - 数据库初始化脚本
-- =========================================

-- 创建家具数据库
CREATE DATABASE IF NOT EXISTS furniture_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE furniture_db;

-- 家具表
CREATE TABLE IF NOT EXISTS furniture (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    name VARCHAR(200) NOT NULL COMMENT '家具名称',
    category VARCHAR(50) COMMENT '分类：椅子、桌子、柜子、床、其他',
    description TEXT COMMENT '家具描述',
    model_path VARCHAR(500) COMMENT '3D模型文件路径',
    thumbnail VARCHAR(500) COMMENT '缩略图路径',
    width DECIMAL(10, 2) COMMENT '宽度(cm)',
    height DECIMAL(10, 2) COMMENT '高度(cm)',
    depth DECIMAL(10, 2) COMMENT '深度(cm)',
    material VARCHAR(200) COMMENT '材质',
    creator VARCHAR(100) COMMENT '创建者',
    status INT DEFAULT 1 COMMENT '状态：0-禁用，1-启用',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted BOOLEAN DEFAULT FALSE COMMENT '逻辑删除标记',
    INDEX idx_name (name),
    INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='家具信息表';

-- 插入测试数据
INSERT INTO furniture (name, category, description, width, height, depth, material, creator) VALUES
('明式圈椅', '椅子', '经典明式圈椅，采用榫卯结构制作', 60.00, 95.00, 50.00, '黄花梨', '张师傅'),
('八仙桌', '桌子', '传统八仙桌，可坐八人', 100.00, 85.00, 100.00, '红木', '李师傅'),
('衣柜', '柜子', '实木衣柜，多层结构', 180.00, 220.00, 60.00, '榆木', '王师傅');

-- 模型特征表
CREATE TABLE IF NOT EXISTS model_feature (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    furniture_id BIGINT NOT NULL COMMENT '关联家具ID',
    width DECIMAL(10, 2) COMMENT '宽度(cm)',
    height DECIMAL(10, 2) COMMENT '高度(cm)',
    depth DECIMAL(10, 2) COMMENT '深度(cm)',
    volume DECIMAL(15, 2) COMMENT '体积(cm³)',
    component_count INT COMMENT '组件数量',
    mortise_count INT COMMENT '榫卯数量',
    category VARCHAR(50) COMMENT '分类',
    material VARCHAR(200) COMMENT '材质',
    style VARCHAR(100) COMMENT '风格',
    feature_vector TEXT COMMENT '特征向量JSON',
    color_palette VARCHAR(500) COMMENT '颜色调色板',
    complexity_score DECIMAL(5, 2) COMMENT '复杂度评分',
    hash VARCHAR(64) COMMENT '特征哈希',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted BOOLEAN DEFAULT FALSE COMMENT '逻辑删除标记',
    UNIQUE KEY uk_furniture_id (furniture_id),
    INDEX idx_category (category),
    INDEX idx_material (material)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='模型特征表';

-- =========================================

-- 创建榫卯结构数据库
CREATE DATABASE IF NOT EXISTS mortise_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mortise_db;

-- 榫卯结构表
CREATE TABLE IF NOT EXISTS mortise_structure (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    furniture_id BIGINT NOT NULL COMMENT '关联家具ID',
    name VARCHAR(200) NOT NULL COMMENT '榫卯名称',
    type VARCHAR(50) COMMENT '类型：燕尾榫、粽角榫、格肩榫、其他',
    parameters JSON COMMENT '参数JSON',
    mortise_width DECIMAL(10, 2) COMMENT '卯宽度(cm)',
    mortise_height DECIMAL(10, 2) COMMENT '卯高度(cm)',
    mortise_depth DECIMAL(10, 2) COMMENT '卯深度(cm)',
    tenon_width DECIMAL(10, 2) COMMENT '榫宽度(cm)',
    tenon_height DECIMAL(10, 2) COMMENT '榫高度(cm)',
    tenon_depth DECIMAL(10, 2) COMMENT '榫深度(cm)',
    position VARCHAR(100) COMMENT '位置',
    model_path VARCHAR(500) COMMENT '3D模型路径',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted BOOLEAN DEFAULT FALSE COMMENT '逻辑删除标记',
    INDEX idx_furniture_id (furniture_id),
    INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='榫卯结构表';

-- 插入测试数据
INSERT INTO mortise_structure (furniture_id, name, type, mortise_width, mortise_height, mortise_depth, tenon_width, tenon_height, tenon_depth, position) VALUES
(1, '椅圈燕尾榫', '燕尾榫', 3.00, 2.00, 4.00, 2.80, 1.80, 3.80, '椅圈连接处'),
(1, '椅腿粽角榫', '粽角榫', 5.00, 5.00, 5.00, 4.80, 4.80, 4.80, '椅腿与座面'),
(2, '桌腿格肩榫', '格肩榫', 6.00, 4.00, 5.00, 5.80, 3.80, 4.80, '桌腿与牙板');

-- 拆解步骤表
CREATE TABLE IF NOT EXISTS disassembly_step (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    furniture_id BIGINT NOT NULL COMMENT '关联家具ID',
    step_order INT NOT NULL COMMENT '步骤序号',
    title VARCHAR(200) NOT NULL COMMENT '步骤标题',
    description TEXT COMMENT '步骤描述',
    component_name VARCHAR(200) COMMENT '组件名称',
    animation_type VARCHAR(50) COMMENT '动画类型：translate, rotate, explode',
    animation_params TEXT COMMENT '动画参数JSON',
    highlight_color VARCHAR(20) COMMENT '高亮颜色',
    duration DECIMAL(5, 2) COMMENT '动画时长(秒)',
    tips TEXT COMMENT '操作提示',
    warning TEXT COMMENT '警告信息',
    tools_required VARCHAR(500) COMMENT '所需工具',
    difficulty INT DEFAULT 1 COMMENT '难度：1-简单，2-中等，3-困难',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted BOOLEAN DEFAULT FALSE COMMENT '逻辑删除标记',
    INDEX idx_furniture_id (furniture_id),
    INDEX idx_step_order (step_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='拆解步骤表';

-- 插入拆解步骤测试数据
INSERT INTO disassembly_step (furniture_id, step_order, title, description, component_name, animation_type, animation_params, highlight_color, duration, tips, difficulty) VALUES
(1, 1, '取下椅圈', '小心地向上提起椅圈，与椅腿分离', '椅圈', 'translate', '{"y": 10, "duration": 2}', '#FF6B6B', 2.0, '注意不要用力过猛，以免损坏榫卯', 1),
(1, 2, '分离座面', '将座面从四条椅腿向外侧平移分离', '座面', 'translate', '{"y": 5, "duration": 1.5}', '#4ECDC4', 1.5, '保持水平移动', 1),
(1, 3, '拆解前腿', '将前腿与座面的连接解开', '前腿', 'rotate', '{"rx": 15, "duration": 2}', '#45B7D1', 2.0, '注意旋转角度不宜过大', 2);

-- =========================================

-- 创建工艺说明数据库
CREATE DATABASE IF NOT EXISTS craft_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE craft_db;

-- 工艺说明表
CREATE TABLE IF NOT EXISTS craft_instruction (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    furniture_id BIGINT NOT NULL COMMENT '关联家具ID',
    mortise_id BIGINT COMMENT '关联榫卯ID',
    title VARCHAR(200) NOT NULL COMMENT '工艺标题',
    title_en VARCHAR(200) COMMENT '英文标题',
    title_ja VARCHAR(200) COMMENT '日文标题',
    content TEXT COMMENT '详细说明',
    content_en TEXT COMMENT '英文说明',
    content_ja TEXT COMMENT '日文说明',
    steps TEXT COMMENT '步骤说明（每行一个步骤）',
    steps_en TEXT COMMENT '英文步骤说明',
    steps_ja TEXT COMMENT '日文步骤说明',
    images TEXT COMMENT '图片路径，多个用逗号分隔',
    video VARCHAR(500) COMMENT '视频路径',
    difficulty INT DEFAULT 1 COMMENT '难度：1-简单，2-中等，3-困难',
    estimated_time INT COMMENT '预计时间(分钟)',
    tools TEXT COMMENT '所需工具，逗号分隔',
    materials TEXT COMMENT '所需材料，逗号分隔',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted BOOLEAN DEFAULT FALSE COMMENT '逻辑删除标记',
    INDEX idx_furniture_id (furniture_id),
    INDEX idx_difficulty (difficulty)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工艺说明表';

-- 插入测试数据（包含多语言）
INSERT INTO craft_instruction (furniture_id, mortise_id, title, title_en, title_ja, content, content_en, content_ja, steps, steps_en, difficulty, estimated_time, tools, materials) VALUES
(1, 1, '燕尾榫制作工艺', 'Dovetail Joint Craftsmanship', '蟻ほぞ製作技術', 
'燕尾榫是传统木工中最经典的榫卯结构之一，因其形状酷似燕子尾巴而得名。这种榫卯结构具有极强的抗拉强度，广泛应用于家具的框架连接。',
'Dovetail joint is one of the most classic mortise and tenon structures in traditional woodworking, named for its resemblance to a swallow''s tail. This structure has extremely high tensile strength and is widely used in furniture frame connections.',
'蟻ほぞは伝統的な木工で最も古典的なほぞ構造の一つで、燕の尾に似ていることから名付けられました。この構造は引張強度が非常に高く、家具のフレーム接続に広く使用されています。',
'1. 设计并画好燕尾榫的形状和尺寸\n2. 使用榫卯锯切割卯眼\n3. 制作对应的榫头\n4. 修整配合面，确保密合\n5. 试装并微调',
'1. Design and draw the dovetail shape and dimensions\n2. Cut the mortise with a tenon saw\n3. Make the corresponding tenon\n4. Trim the mating surfaces to ensure a tight fit\n5. Test assemble and fine-tune',
2, 120, '榫卯锯, 木工凿, 角尺, 铅笔', '木料, 砂纸, 木蜡油'),
(1, 2, '粽角榫装配工艺', 'Corner Bracket Joint Assembly', '粽角ほぞ組立技術',
'粽角榫因其形似粽子角而得名，是三面接合的复杂榫卯结构，常用于家具的角部连接。',
'Corner bracket joint is named for its resemblance to zongzi corners, a complex three-sided mortise and tenon structure commonly used for furniture corner connections.',
'粽角ほぞは粽の角に似ていることから名付けられ、三面接合の複雑なほぞ構造で、家具の角部接続によく使用されます。',
'1. 准备三根需要连接的木料\n2. 分别在三根木料上标记榫卯位置\n3. 制作各自的榫头和卯眼\n4. 三面同时试装\n5. 上胶固定',
'1. Prepare three pieces of wood to be connected\n2. Mark mortise and tenon positions on each piece\n3. Make respective tenons and mortises\n4. Test assemble all three sides simultaneously\n5. Glue and fix',
3, 180, '榫卯锯, 木工凿, 木锤, 夹具', '木料, 木工胶, 砂纸'),
(2, 3, '格肩榫制作工艺', 'Mitered Shoulder Joint Craftsmanship', '格肩ほぞ製作技術',
'格肩榫是一种美观与实用兼具的榫卯结构，榫头呈阶梯状，增加了接合面积。',
'Mitered shoulder joint is a mortise and tenon structure that combines aesthetics and practicality, with stepped tenons that increase the joint area.',
'格肩ほぞは美観と実用性を兼ね備えたほぞ構造で、ほぞが階段状になっており、接続面積が増加しています。',
'1. 在木料上标记格肩线\n2. 切割阶梯状的榫头\n3. 制作对应的卯眼\n4. 修整肩线使其密合\n5. 装配并检查',
'1. Mark shoulder lines on the wood\n2. Cut the stepped tenon\n3. Make the corresponding mortise\n4. Trim shoulder lines for a tight fit\n5. Assemble and inspect',
2, 150, '榫卯锯, 木工凿, 平刨', '木料, 木工胶');

-- =========================================

SELECT '数据库初始化完成！' AS status;

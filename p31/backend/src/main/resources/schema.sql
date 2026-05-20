-- 创建榫卯类型表
CREATE TABLE IF NOT EXISTS t_mortise_tenon_type (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    type_code VARCHAR(50) NOT NULL UNIQUE COMMENT '类型编码',
    type_name VARCHAR(100) NOT NULL COMMENT '类型名称',
    category VARCHAR(50) COMMENT '分类',
    description TEXT COMMENT '描述',
    historical_origin TEXT COMMENT '历史渊源',
    typical_applications TEXT COMMENT '典型应用',
    structural_features TEXT COMMENT '结构特点',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否启用',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_type_code (type_code),
    INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='榫卯类型表';

-- 创建榫卯模型表
CREATE TABLE IF NOT EXISTS t_mortise_tenon_model (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    model_code VARCHAR(50) NOT NULL UNIQUE COMMENT '模型编码',
    model_name VARCHAR(200) NOT NULL COMMENT '模型名称',
    type_id BIGINT COMMENT '类型ID',
    ancient_building_name VARCHAR(200) COMMENT '古建筑名称',
    building_location VARCHAR(200) COMMENT '建筑位置',
    historical_period VARCHAR(100) COMMENT '历史时期',
    model_file_path VARCHAR(500) COMMENT '模型文件路径',
    model_file_format VARCHAR(20) COMMENT '模型文件格式',
    model_file_size BIGINT COMMENT '模型文件大小',
    vertex_count INT COMMENT '顶点数',
    face_count INT COMMENT '面数',
    component_count INT COMMENT '构件数',
    scale_x DOUBLE COMMENT 'X轴缩放',
    scale_y DOUBLE COMMENT 'Y轴缩放',
    scale_z DOUBLE COMMENT 'Z轴缩放',
    center_x DOUBLE COMMENT '中心X坐标',
    center_y DOUBLE COMMENT '中心Y坐标',
    center_z DOUBLE COMMENT '中心Z坐标',
    description TEXT COMMENT '描述',
    craftsmanship TEXT COMMENT '工艺特点',
    is_published BOOLEAN DEFAULT FALSE COMMENT '是否发布',
    view_count INT DEFAULT 0 COMMENT '浏览次数',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    FOREIGN KEY (type_id) REFERENCES t_mortise_tenon_type(id),
    INDEX idx_model_code (model_code),
    INDEX idx_type_id (type_id),
    INDEX idx_building_name (ancient_building_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='榫卯3D模型表';

-- 创建拆解步骤表
CREATE TABLE IF NOT EXISTS t_disassembly_step (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    model_id BIGINT NOT NULL COMMENT '模型ID',
    step_order INT NOT NULL COMMENT '步骤顺序',
    step_name VARCHAR(200) COMMENT '步骤名称',
    step_type VARCHAR(50) COMMENT '步骤类型',
    component_id VARCHAR(100) COMMENT '构件ID',
    component_name VARCHAR(200) COMMENT '构件名称',
    translate_x DOUBLE COMMENT 'X轴位移',
    translate_y DOUBLE COMMENT 'Y轴位移',
    translate_z DOUBLE COMMENT 'Z轴位移',
    rotate_x DOUBLE COMMENT 'X轴旋转',
    rotate_y DOUBLE COMMENT 'Y轴旋转',
    rotate_z DOUBLE COMMENT 'Z轴旋转',
    duration INT COMMENT '动画时长(ms)',
    description TEXT COMMENT '步骤描述',
    operation_hint TEXT COMMENT '操作提示',
    is_reverse BOOLEAN DEFAULT FALSE COMMENT '是否反向步骤',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    FOREIGN KEY (model_id) REFERENCES t_mortise_tenon_model(id) ON DELETE CASCADE,
    INDEX idx_model_id (model_id),
    INDEX idx_step_order (step_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='拆解步骤表';

-- 创建历史文献表
CREATE TABLE IF NOT EXISTS t_historical_document (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    model_id BIGINT COMMENT '关联模型ID',
    document_code VARCHAR(50) UNIQUE COMMENT '文献编码',
    document_title VARCHAR(300) COMMENT '文献标题',
    document_type VARCHAR(50) COMMENT '文献类型',
    author VARCHAR(200) COMMENT '作者',
    historical_period VARCHAR(100) COMMENT '历史时期',
    publication_year VARCHAR(50) COMMENT '出版年份',
    original_source VARCHAR(500) COMMENT '原始来源',
    file_path VARCHAR(500) COMMENT '文件路径',
    file_format VARCHAR(20) COMMENT '文件格式',
    file_size BIGINT COMMENT '文件大小',
    page_count INT COMMENT '页数',
    thumbnail_path VARCHAR(500) COMMENT '缩略图路径',
    summary TEXT COMMENT '摘要',
    content_extract TEXT COMMENT '内容摘录',
    key_references TEXT COMMENT '关键引用',
    is_verified BOOLEAN DEFAULT FALSE COMMENT '是否已验证',
    view_count INT DEFAULT 0 COMMENT '浏览次数',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    FOREIGN KEY (model_id) REFERENCES t_mortise_tenon_model(id),
    INDEX idx_document_code (document_code),
    INDEX idx_model_id (model_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='历史文献表';

-- 创建受力分析表
CREATE TABLE IF NOT EXISTS t_stress_analysis (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    model_id BIGINT NOT NULL COMMENT '模型ID',
    analysis_code VARCHAR(50) UNIQUE COMMENT '分析编码',
    analysis_name VARCHAR(200) COMMENT '分析名称',
    analysis_type VARCHAR(50) COMMENT '分析类型',
    node_id VARCHAR(100) COMMENT '节点ID',
    node_name VARCHAR(200) COMMENT '节点名称',
    node_position_x DOUBLE COMMENT '节点X坐标',
    node_position_y DOUBLE COMMENT '节点Y坐标',
    node_position_z DOUBLE COMMENT '节点Z坐标',
    max_stress DOUBLE COMMENT '最大应力(MPa)',
    min_stress DOUBLE COMMENT '最小应力(MPa)',
    average_stress DOUBLE COMMENT '平均应力(MPa)',
    stress_unit VARCHAR(20) COMMENT '应力单位',
    max_deformation DOUBLE COMMENT '最大变形量',
    safety_factor DOUBLE COMMENT '安全系数',
    load_condition TEXT COMMENT '荷载条件',
    material_properties TEXT COMMENT '材料属性',
    analysis_method VARCHAR(100) COMMENT '分析方法',
    result_data LONGTEXT COMMENT '结果数据(JSON)',
    visualization_config TEXT COMMENT '可视化配置',
    conclusion TEXT COMMENT '分析结论',
    is_validated BOOLEAN DEFAULT FALSE COMMENT '是否已验证',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    FOREIGN KEY (model_id) REFERENCES t_mortise_tenon_model(id) ON DELETE CASCADE,
    INDEX idx_analysis_code (analysis_code),
    INDEX idx_model_id (model_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='受力分析结果表';

-- 插入初始榫卯类型数据
INSERT INTO t_mortise_tenon_type (type_code, type_name, category, description, historical_origin, typical_applications, structural_features) VALUES
('SWALLOW_TAIL', '燕尾榫', '连接榫卯', '燕尾榫是一种最古老、最坚固的榫卯结构，因其形状酷似燕子尾巴而得名。', '最早可追溯到新石器时代河姆渡文化遗址，距今约7000年历史。', '广泛应用于古建筑梁枋连接、家具柜体框架等部位。', '梯形榫头呈燕尾形状，两侧有锁扣，具有极强的抗拉拔能力，是木结构中最坚固的连接方式之一。'),
('SHOULDER_MORTISE', '格肩榫', '家具榫卯', '格肩榫是家具制作中常用的榫卯，因榫肩呈格状而得名。', '宋代《营造法式》中已有记载，是中国传统家具的经典榫卯。', '明清家具桌案、椅凳等家具的腿足与边框连接。', '榫头两侧做出格肩，增加接触面积，提高连接强度和稳定性。'),
('BUTTERFLY_JOINT', '霸王拳', '装饰榫卯', '霸王拳是梁头部位的装饰性榫卯，形状像紧握的拳头。', '明清官式建筑的典型特征，具有强烈的装饰效果。', '宫殿、寺庙等大型古建筑的梁枋端头装饰。', '兼具结构加固与装饰功能，造型独特，具有很高的艺术价值。'),
('HALF_MORTISE', '半榫', '透空榫卯', '半榫是榫头不穿透卯眼的榫卯结构，常用于装饰性较强的部位。', '唐宋以后逐渐发展成熟，多用于需要透空装饰的构件。', '花格、栏杆、装饰性构件连接。', '榫头较短，不外露，美观性强，但承重力相对较弱。')
ON DUPLICATE KEY UPDATE type_name = VALUES(type_name);
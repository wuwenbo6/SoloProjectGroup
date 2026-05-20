-- 3D模型表
CREATE TABLE IF NOT EXISTS model_3d (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '模型ID',
    name VARCHAR(200) NOT NULL COMMENT '模型名称',
    description TEXT COMMENT '模型描述',
    category_id BIGINT COMMENT '分类ID',
    model_url VARCHAR(500) NOT NULL COMMENT '模型文件URL (glb/gltf)',
    thumbnail_url VARCHAR(500) COMMENT '缩略图URL',
    texture_urls JSON COMMENT '纹理贴图URL列表',
    material_config JSON COMMENT '材质配置',
    default_camera JSON COMMENT '默认相机参数',
    default_lights JSON COMMENT '默认灯光配置',
    is_customizable TINYINT DEFAULT 1 COMMENT '是否可定制 0-否 1-是',
    customizable_params JSON COMMENT '可定制参数列表',
    artisan_id BIGINT COMMENT '匠人ID',
    view_count INT DEFAULT 0 COMMENT '浏览次数',
    usage_count INT DEFAULT 0 COMMENT '使用次数',
    status TINYINT DEFAULT 1 COMMENT '状态 0-禁用 1-启用',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    version INT DEFAULT 0 COMMENT '乐观锁版本',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    INDEX idx_category_id (category_id),
    INDEX idx_artisan_id (artisan_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='3D模型表';

-- 3D模型分类表
CREATE TABLE IF NOT EXISTS model_3d_category (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '分类ID',
    name VARCHAR(100) NOT NULL COMMENT '分类名称',
    parent_id BIGINT DEFAULT 0 COMMENT '父分类ID',
    icon VARCHAR(500) COMMENT '分类图标',
    sort_order INT DEFAULT 0 COMMENT '排序',
    status TINYINT DEFAULT 1 COMMENT '状态',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    version INT DEFAULT 0 COMMENT '乐观锁版本',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    INDEX idx_parent_id (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='3D模型分类表';

-- 用户定制3D方案表
CREATE TABLE IF NOT EXISTS custom_3d_solution (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '方案ID',
    user_id BIGINT NOT NULL COMMENT '用户ID',
    requirement_id BIGINT COMMENT '需求ID',
    order_id BIGINT COMMENT '订单ID',
    base_model_id BIGINT NOT NULL COMMENT '基础模型ID',
    name VARCHAR(200) NOT NULL COMMENT '方案名称',
    description TEXT COMMENT '方案描述',
    material_selections JSON COMMENT '材质选择配置',
    color_config JSON COMMENT '颜色配置',
    size_config JSON COMMENT '尺寸配置',
    custom_params JSON COMMENT '自定义参数配置',
    preview_image VARCHAR(500) COMMENT '预览图URL',
    model_url VARCHAR(500) COMMENT '定制后模型URL',
    status TINYINT DEFAULT 1 COMMENT '状态 1-草稿 2-已确认 3-生产中 4-已完成',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    version INT DEFAULT 0 COMMENT '乐观锁版本',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    INDEX idx_user_id (user_id),
    INDEX idx_requirement_id (requirement_id),
    INDEX idx_order_id (order_id),
    INDEX idx_base_model_id (base_model_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户定制3D方案表';

-- 初始化3D模型分类数据
INSERT INTO model_3d_category (name, parent_id, sort_order) VALUES
('陶瓷', 0, 1),
('木雕', 0, 2),
('漆器', 0, 3),
('刺绣', 0, 4),
('金属', 0, 5),
('竹编', 0, 6),
('玉器', 0, 7),
('其他', 0, 8);

INSERT INTO model_3d_category (name, parent_id, sort_order) VALUES
('茶具', 1, 1),
('花瓶', 1, 2),
('摆件', 1, 3),
('家具', 2, 1),
('文玩', 2, 2),
('首饰盒', 3, 1),
('屏风', 3, 2),
('苏绣', 4, 1),
('蜀绣', 4, 2),
('铜器', 5, 1),
('银器', 5, 2),
('竹篮', 6, 1),
('竹席', 6, 2);

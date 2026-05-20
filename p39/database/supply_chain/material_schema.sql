-- 材质分类表
CREATE TABLE IF NOT EXISTS material_category (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '分类ID',
    name VARCHAR(100) NOT NULL COMMENT '分类名称',
    parent_id BIGINT DEFAULT 0 COMMENT '父分类ID',
    icon VARCHAR(500) COMMENT '分类图标',
    sort_order INT DEFAULT 0 COMMENT '排序',
    status TINYINT DEFAULT 1 COMMENT '状态 0-禁用 1-启用',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    version INT DEFAULT 0 COMMENT '乐观锁版本',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    INDEX idx_parent_id (parent_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='材质分类表';

-- 材质表
CREATE TABLE IF NOT EXISTS material (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '材质ID',
    category_id BIGINT NOT NULL COMMENT '分类ID',
    name VARCHAR(200) NOT NULL COMMENT '材质名称',
    code VARCHAR(50) UNIQUE COMMENT '材质编码',
    description TEXT COMMENT '材质描述',
    features JSON COMMENT '材质特性列表',
    origin VARCHAR(100) COMMENT '产地',
    unit VARCHAR(20) DEFAULT '件' COMMENT '单位',
    price DECIMAL(10,2) NOT NULL COMMENT '单价',
    market_price DECIMAL(10,2) COMMENT '市场价',
    stock INT DEFAULT 0 COMMENT '库存数量',
    min_order INT DEFAULT 1 COMMENT '最小起订量',
    delivery_days INT DEFAULT 7 COMMENT '交货周期(天)',
    images JSON COMMENT '材质图片列表',
    sample_image VARCHAR(500) COMMENT '样品展示图',
    supplier_id BIGINT COMMENT '供应商ID',
    quality_level TINYINT DEFAULT 2 COMMENT '质量等级 1-优质 2-标准 3-合格',
    certification VARCHAR(500) COMMENT '认证信息',
    eco_friendly TINYINT DEFAULT 0 COMMENT '是否环保材料 0-否 1-是',
    view_count INT DEFAULT 0 COMMENT '浏览次数',
    usage_count INT DEFAULT 0 COMMENT '使用次数',
    rating DECIMAL(3,2) DEFAULT 5.00 COMMENT '评分',
    review_count INT DEFAULT 0 COMMENT '评价数',
    status TINYINT DEFAULT 1 COMMENT '状态 0-下架 1-上架 2-缺货',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    version INT DEFAULT 0 COMMENT '乐观锁版本',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    INDEX idx_category_id (category_id),
    INDEX idx_supplier_id (supplier_id),
    INDEX idx_status (status),
    INDEX idx_price (price)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='材质表';

-- 材质属性表
CREATE TABLE IF NOT EXISTS material_attribute (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '属性ID',
    material_id BIGINT NOT NULL COMMENT '材质ID',
    name VARCHAR(100) NOT NULL COMMENT '属性名称',
    value VARCHAR(500) NOT NULL COMMENT '属性值',
    sort_order INT DEFAULT 0 COMMENT '排序',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    version INT DEFAULT 0 COMMENT '乐观锁版本',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    INDEX idx_material_id (material_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='材质属性表';

-- 材质规格表
CREATE TABLE IF NOT EXISTS material_spec (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '规格ID',
    material_id BIGINT NOT NULL COMMENT '材质ID',
    spec_name VARCHAR(100) NOT NULL COMMENT '规格名称',
    spec_value VARCHAR(200) NOT NULL COMMENT '规格值',
    price_adjust DECIMAL(10,2) DEFAULT 0.00 COMMENT '价格调整',
    stock INT DEFAULT 0 COMMENT '该规格库存',
    sort_order INT DEFAULT 0 COMMENT '排序',
    status TINYINT DEFAULT 1 COMMENT '状态',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    version INT DEFAULT 0 COMMENT '乐观锁版本',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    INDEX idx_material_id (material_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='材质规格表';

-- 供应商表
CREATE TABLE IF NOT EXISTS material_supplier (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '供应商ID',
    name VARCHAR(200) NOT NULL COMMENT '供应商名称',
    contact_person VARCHAR(100) COMMENT '联系人',
    phone VARCHAR(20) COMMENT '联系电话',
    email VARCHAR(100) COMMENT '邮箱',
    address VARCHAR(500) COMMENT '地址',
    description TEXT COMMENT '供应商简介',
    license_no VARCHAR(100) COMMENT '营业执照号',
    rating DECIMAL(3,2) DEFAULT 5.00 COMMENT '评分',
    cooperation_level TINYINT DEFAULT 2 COMMENT '合作等级 1-核心 2-普通 3-临时',
    status TINYINT DEFAULT 1 COMMENT '状态 0-停用 1-正常',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    version INT DEFAULT 0 COMMENT '乐观锁版本',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='材质供应商表';

-- 用户材质选择记录表
CREATE TABLE IF NOT EXISTS user_material_selection (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '记录ID',
    user_id BIGINT NOT NULL COMMENT '用户ID',
    requirement_id BIGINT COMMENT '需求ID',
    order_id BIGINT COMMENT '订单ID',
    material_id BIGINT NOT NULL COMMENT '材质ID',
    spec_id BIGINT COMMENT '规格ID',
    quantity INT NOT NULL COMMENT '数量',
    unit_price DECIMAL(10,2) NOT NULL COMMENT '单价',
    total_price DECIMAL(10,2) NOT NULL COMMENT '总价',
    customization_notes TEXT COMMENT '定制备注',
    status TINYINT DEFAULT 1 COMMENT '状态 1-已选择 2-已确认 3-已取消',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    version INT DEFAULT 0 COMMENT '乐观锁版本',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    INDEX idx_user_id (user_id),
    INDEX idx_requirement_id (requirement_id),
    INDEX idx_order_id (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户材质选择记录表';

-- 初始化材质分类数据
INSERT INTO material_category (name, parent_id, sort_order) VALUES
('陶瓷材料', 0, 1),
('木材', 0, 2),
('金属材料', 0, 3),
('纺织品', 0, 4),
('玉石宝石', 0, 5),
('天然漆料', 0, 6),
('纸张', 0, 7),
('其他材料', 0, 8);

INSERT INTO material_category (name, parent_id, sort_order) VALUES
('高岭土', 1, 1),
('瓷土', 1, 2),
('陶土', 1, 3),
('釉料', 1, 4),
('红木', 2, 1),
('紫檀', 2, 2),
('黄花梨', 2, 3),
('楠木', 2, 4),
('铜', 3, 1),
('银', 3, 2),
('金', 3, 3),
('锡', 3, 4),
('丝绸', 4, 1),
('棉麻', 4, 2),
('刺绣线', 4, 3),
('翡翠', 5, 1),
('和田玉', 5, 2),
('玛瑙', 5, 3),
('大漆', 6, 1),
('桐油', 6, 2),
('宣纸', 7, 1),
('皮纸', 7, 2);

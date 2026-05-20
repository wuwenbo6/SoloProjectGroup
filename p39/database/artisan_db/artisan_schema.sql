-- =========================================
-- CraftHub 匠人数据库
-- Database: crafthub_artisan
-- =========================================

CREATE DATABASE IF NOT EXISTS crafthub_artisan DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE crafthub_artisan;

-- 匠人表
CREATE TABLE IF NOT EXISTS t_artisan (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '匠人ID',
    user_id BIGINT NOT NULL UNIQUE COMMENT '关联用户ID',
    real_name VARCHAR(50) NOT NULL COMMENT '真实姓名',
    id_card VARCHAR(18) NOT NULL UNIQUE COMMENT '身份证号',
    craft_type VARCHAR(50) NOT NULL COMMENT '工艺类型',
    title VARCHAR(100) COMMENT '职称头衔',
    avatar VARCHAR(500) COMMENT '头像',
    bio VARCHAR(500) COMMENT '个人简介',
    experience_years INT COMMENT '从业年限',
    location VARCHAR(100) COMMENT '所在地区',
    avg_rating DECIMAL(3,2) DEFAULT 5.00 COMMENT '平均评分',
    order_count INT DEFAULT 0 COMMENT '完成订单数',
    status TINYINT NOT NULL DEFAULT 0 COMMENT '认证状态:0待审核1已通过2已拒绝',
    verify_time DATETIME COMMENT '审核时间',
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除',
    INDEX idx_user_id (user_id),
    INDEX idx_craft_type (craft_type),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='匠人表';

-- 匠人资质审核记录表
CREATE TABLE IF NOT EXISTS t_artisan_verify_record (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '记录ID',
    artisan_id BIGINT NOT NULL COMMENT '匠人ID',
    status TINYINT NOT NULL COMMENT '审核状态:0待审核1已通过2已拒绝',
    reason VARCHAR(500) COMMENT '审核意见',
    verify_user BIGINT COMMENT '审核人',
    verify_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '审核时间',
    INDEX idx_artisan_id (artisan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='匠人资质审核记录表';

-- 匠人作品案例表
CREATE TABLE IF NOT EXISTS t_artisan_portfolio (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '作品ID',
    artisan_id BIGINT NOT NULL COMMENT '匠人ID',
    title VARCHAR(200) NOT NULL COMMENT '作品标题',
    description TEXT COMMENT '作品描述',
    cover_image VARCHAR(500) NOT NULL COMMENT '封面图片',
    images TEXT COMMENT '作品图片URL,多个用逗号分隔',
    craft_type VARCHAR(50) COMMENT '工艺类型',
    material VARCHAR(100) COMMENT '材料',
    price DECIMAL(10,2) COMMENT '参考价格',
    is_show TINYINT DEFAULT 1 COMMENT '是否展示:0否1是',
    sort INT DEFAULT 0 COMMENT '排序',
    view_count INT DEFAULT 0 COMMENT '浏览量',
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除',
    INDEX idx_artisan_id (artisan_id),
    INDEX idx_craft_type (craft_type),
    INDEX idx_is_show (is_show)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='匠人作品案例表';

-- 插入测试数据
INSERT INTO t_artisan (user_id, real_name, id_card, craft_type, title, bio, experience_years, location, status)
VALUES 
(20001, '李明', '110101198001011234', '陶瓷制作', '国家级非遗传承人', '从事青花瓷制作30年，作品多次获得国家级大奖', 30, '景德镇', 1),
(20002, '王芳', '310101198502022345', '苏绣', '省级非遗传承人', '苏绣世家第四代传人，擅长双面绣', 20, '苏州', 1),
(20003, '张德', '330101197803033456', '木雕', '工艺美术大师', '东阳木雕传承人，专注佛像雕刻25年', 25, '东阳', 1);

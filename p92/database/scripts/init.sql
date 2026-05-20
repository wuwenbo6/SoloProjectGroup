-- 创建竹编工艺数据库
CREATE DATABASE IF NOT EXISTS bamboo_craft DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE bamboo_craft;

-- 工艺作品表
CREATE TABLE IF NOT EXISTS t_craft (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    title VARCHAR(200) NOT NULL COMMENT '作品名称',
    category VARCHAR(50) COMMENT '作品分类',
    description TEXT COMMENT '作品描述',
    image VARCHAR(500) COMMENT '封面图片',
    images TEXT COMMENT '作品图片列表JSON',
    materials VARCHAR(500) COMMENT '使用材料',
    craft_steps TEXT COMMENT '工艺流程JSON',
    user_id BIGINT COMMENT '用户ID',
    artisan_name VARCHAR(100) COMMENT '艺人名称',
    artisan_avatar VARCHAR(500) COMMENT '艺人头像',
    views INT DEFAULT 0 COMMENT '浏览数',
    likes INT DEFAULT 0 COMMENT '点赞数',
    comments INT DEFAULT 0 COMMENT '评论数',
    status TINYINT DEFAULT 0 COMMENT '状态：0待审核，1已发布，2已下架',
    is_heritage TINYINT DEFAULT 0 COMMENT '是否非遗传承：0否，1是',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '是否删除：0否，1是',
    INDEX idx_user_id(user_id),
    INDEX idx_category(category),
    INDEX idx_status(status),
    INDEX idx_create_time(create_time),
    INDEX idx_user_status(user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工艺作品表';

-- 插入示例数据
INSERT INTO t_craft (title, category, description, image, images, materials, craft_steps, user_id, artisan_name, artisan_avatar, views, likes, comments, status, is_heritage) VALUES
('传统竹编花篮', '日用器具', '采用千年传承技法，纯手工编织而成。精选优质毛竹，经过选材、破竹、刮青、分丝、编织等十几道工序', 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400', '["https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400"]', '毛竹、藤条', '[{"title":"选材","desc":"精选优质毛竹"},{"title":"破竹","desc":"劈削成均匀竹篾"}]', 1, '张师傅', 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png', 1234, 89, 23, 1, 1),
('竹编茶具套装', '茶具套装', '精美竹编工艺与茶文化的完美结合', 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400', '["https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400"]', '毛竹、竹丝', '[{"title":"选材","desc":"精选优质毛竹"},{"title":"编织","desc":"精细编织成型"}]', 1, '张师傅', 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png', 856, 67, 15, 1, 1),
('竹编收纳盒', '收纳用品', '精致实用的竹编收纳，让生活更有条理', 'https://images.unsplash.com/photo-1595408076683-5d0c8f0e3a3e?w=400', '["https://images.unsplash.com/photo-1595408076683-5d0c8f0e3a3e?w=400"]', '毛竹', '[{"title":"选材","desc":"精选优质毛竹"},{"title":"打磨","desc":"精细打磨处理"}]', 1, '张师傅', 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png', 2341, 156, 42, 1, 0),
('竹编装饰灯罩', '装饰摆件', '温馨的灯光透过竹编纹路，营造独特氛围', 'https://images.unsplash.com/photo-1574169208507-84376144848b?w=400', '["https://images.unsplash.com/photo-1574169208507-84376144848b?w=400"]', '毛竹、竹丝', '[{"title":"选材","desc":"精选优质毛竹"},{"title":"造型","desc":"塑造优美造型"}]', 2, '李师傅', 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png', 678, 45, 8, 1, 1),
('竹编果盘', '日用器具', '天然竹材编织，健康环保的用餐选择', 'https://images.unsplash.com/photo-1595408076683-5d0c8f0e3a3e?w=400', '["https://images.unsplash.com/photo-1595408076683-5d0c8f0e3a3e?w=400"]', '毛竹', '[{"title":"选材","desc":"精选优质毛竹"},{"title":"成型","desc":"编织成圆形"}]', 2, '李师傅', 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png', 543, 38, 12, 1, 0);

-- 创建用户数据库
CREATE DATABASE IF NOT EXISTS bamboo_user DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE bamboo_user;

-- 用户表
CREATE TABLE IF NOT EXISTS t_user (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    username VARCHAR(50) NOT NULL UNIQUE COMMENT '用户名',
    password VARCHAR(100) NOT NULL COMMENT '密码',
    nickname VARCHAR(50) COMMENT '昵称',
    avatar VARCHAR(500) COMMENT '头像',
    phone VARCHAR(20) COMMENT '手机号',
    email VARCHAR(100) COMMENT '邮箱',
    description TEXT COMMENT '个人简介',
    is_artisan TINYINT DEFAULT 0 COMMENT '是否艺人：0否，1是',
    status TINYINT DEFAULT 1 COMMENT '状态：0禁用，1启用',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '是否删除：0否，1是',
    INDEX idx_username(username),
    INDEX idx_is_artisan(is_artisan)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 插入示例用户
INSERT INTO t_user (username, password, nickname, avatar, description, is_artisan, status) VALUES
('zhangsan', '123456', '张师傅', 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png', '非遗竹编传承人，专注传统工艺30年', 1, 1),
('lisi', '123456', '李师傅', 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png', '传统竹编艺人，擅长精细编织', 1, 1),
('visitor', '123456', '竹编爱好者', 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png', '热爱竹编文化', 0, 1);

-- 创建互动数据库
CREATE DATABASE IF NOT EXISTS bamboo_interaction DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE bamboo_interaction;

-- 评论表
CREATE TABLE IF NOT EXISTS t_comment (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    craft_id BIGINT NOT NULL COMMENT '工艺ID',
    user_id BIGINT COMMENT '用户ID',
    username VARCHAR(50) COMMENT '用户名',
    user_avatar VARCHAR(500) COMMENT '用户头像',
    content TEXT NOT NULL COMMENT '评论内容',
    parent_id BIGINT DEFAULT 0 COMMENT '父评论ID',
    likes INT DEFAULT 0 COMMENT '点赞数',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '是否删除：0否，1是',
    INDEX idx_craft_id(craft_id),
    INDEX idx_user_id(user_id),
    INDEX idx_parent_id(parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='评论表';

-- 插入示例评论
INSERT INTO t_comment (craft_id, user_id, username, user_avatar, content, likes) VALUES
(1, 3, '竹编爱好者', 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png', '太精美了！这编织的纹理太有艺术感了，不愧是传统工艺！', 12),
(1, 2, '手艺人小王', 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png', '请问这个花篮的尺寸是多少？想学习一下编织技法', 5),
(1, 3, '收藏家老李', 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png', '已经收藏了好几件张师傅的作品，每件都是精品！', 8),
(2, 3, '茶文化爱好者', 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png', '这套茶具太有韵味了，必须入手一套！', 15);

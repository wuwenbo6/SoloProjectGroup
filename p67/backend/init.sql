CREATE DATABASE IF NOT EXISTS folk_order DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS folk_audit DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS folk_payment DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS folk_message DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE folk_order;
CREATE TABLE IF NOT EXISTS t_order (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_no VARCHAR(64) NOT NULL UNIQUE COMMENT '订单号',
    user_id BIGINT NOT NULL COMMENT '用户ID',
    user_name VARCHAR(64) COMMENT '用户姓名',
    user_phone VARCHAR(20) COMMENT '手机号',
    activity_id BIGINT COMMENT '活动ID',
    activity_name VARCHAR(255) COMMENT '活动名称',
    activity_time DATETIME COMMENT '活动时间',
    activity_location VARCHAR(255) COMMENT '活动地点',
    quantity INT DEFAULT 1 COMMENT '报名人数',
    unit_price DECIMAL(10,2) COMMENT '单价',
    total_amount DECIMAL(10,2) COMMENT '总金额',
    status TINYINT DEFAULT 0 COMMENT '0待支付 1已支付 2已完成 3已取消',
    payment_method VARCHAR(32) COMMENT '支付方式',
    payment_time DATETIME COMMENT '支付时间',
    remark TEXT COMMENT '备注',
    deleted TINYINT DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_order_no (order_no),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单表';

USE folk_audit;
CREATE TABLE IF NOT EXISTS t_audit_record (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    biz_type VARCHAR(32) COMMENT '业务类型',
    biz_id BIGINT COMMENT '业务ID',
    biz_name VARCHAR(255) COMMENT '业务名称',
    applicant_id BIGINT COMMENT '申请人ID',
    applicant_name VARCHAR(64) COMMENT '申请人姓名',
    status TINYINT DEFAULT 0 COMMENT '0待审核 1已通过 2已驳回',
    auditor_id BIGINT COMMENT '审核人ID',
    auditor_name VARCHAR(64) COMMENT '审核人姓名',
    audit_opinion TEXT COMMENT '审核意见',
    remark TEXT COMMENT '备注',
    deleted TINYINT DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_applicant_id (applicant_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审核记录表';

USE folk_payment;
CREATE TABLE IF NOT EXISTS t_payment_record (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_no VARCHAR(64) NOT NULL COMMENT '订单号',
    payment_no VARCHAR(64) NOT NULL UNIQUE COMMENT '支付单号',
    user_id BIGINT NOT NULL COMMENT '用户ID',
    amount DECIMAL(10,2) NOT NULL COMMENT '支付金额',
    payment_method VARCHAR(32) COMMENT '支付方式',
    channel VARCHAR(32) COMMENT '支付渠道',
    status TINYINT DEFAULT 0 COMMENT '0待支付 1支付成功 2已退款',
    success_time DATETIME COMMENT '支付成功时间',
    callback_data TEXT COMMENT '回调数据',
    remark TEXT COMMENT '备注',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_order_no (order_no),
    INDEX idx_payment_no (payment_no),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='支付记录表';

USE folk_message;
CREATE TABLE IF NOT EXISTS t_message_record (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL COMMENT '用户ID',
    user_phone VARCHAR(20) COMMENT '手机号',
    template_code VARCHAR(64) COMMENT '模板编码',
    title VARCHAR(255) COMMENT '消息标题',
    content TEXT COMMENT '消息内容',
    channel VARCHAR(32) COMMENT '发送渠道 sms/push/email',
    status TINYINT DEFAULT 0 COMMENT '0待发送 1已发送 2已读',
    result TEXT COMMENT '发送结果',
    remark TEXT COMMENT '备注',
    deleted TINYINT DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='消息记录表';

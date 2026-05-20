package com.folk.activity.order.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.folk.activity.common.core.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_order")
public class Order extends BaseEntity {
    private String orderNo;
    private Long userId;
    private String userName;
    private String userPhone;
    private Long activityId;
    private String activityName;
    private LocalDateTime activityTime;
    private String activityLocation;
    private Integer quantity;
    private BigDecimal unitPrice;
    private BigDecimal totalAmount;
    private Integer status;
    private String paymentMethod;
    private LocalDateTime paymentTime;
    private String remark;
    private Integer deleted;
}

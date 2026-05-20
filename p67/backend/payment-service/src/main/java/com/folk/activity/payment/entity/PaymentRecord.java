package com.folk.activity.payment.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.folk.activity.common.core.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_payment_record")
public class PaymentRecord extends BaseEntity {
    private String orderNo;
    private String paymentNo;
    private Long userId;
    private BigDecimal amount;
    private String paymentMethod;
    private String channel;
    private Integer status;
    private LocalDateTime successTime;
    private String callbackData;
    private String remark;
}

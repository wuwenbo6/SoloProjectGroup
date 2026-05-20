package com.crafthub.order.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("t_order")
public class Order {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String orderNo;

    private Long userId;

    private Long artisanId;

    private Long requirementId;

    private String title;

    private String description;

    private BigDecimal amount;

    private Integer status;

    private Integer progress;

    private LocalDateTime estimatedDelivery;

    private LocalDateTime actualDelivery;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}

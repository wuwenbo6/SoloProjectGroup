package com.crafthub.order.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("order_exception_log")
public class OrderExceptionLog {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long orderId;

    private String orderNo;

    private String exceptionType;

    private String exceptionCode;

    private String exceptionMessage;

    private String exceptionDetail;

    private Integer severity;

    private Integer status;

    private Integer retryCount;

    private LocalDateTime lastRetryTime;

    private LocalDateTime resolveTime;

    private String resolveMethod;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @Version
    private Integer version;

    @TableLogic
    private Integer deleted;
}

package com.crafthub.notification.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class OrderProgressDTO {

    private Long orderId;

    private String orderNo;

    private Long userId;

    private Long artisanId;

    private Integer progress;

    private String progressDesc;

    private Integer status;

    private String statusDesc;

    private String remark;

    private LocalDateTime updateTime;
}

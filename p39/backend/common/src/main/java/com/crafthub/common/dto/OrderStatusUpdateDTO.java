package com.crafthub.common.dto;

import lombok.Data;

@Data
public class OrderStatusUpdateDTO {
    private Long orderId;
    private Integer status;
    private String remark;
}

package com.crafthub.common.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class PaymentRequestDTO {
    private Long orderId;
    private Long userId;
    private BigDecimal amount;
    private String channel;
    private String subject;
    private String body;
    private String notifyUrl;
    private String returnUrl;
}

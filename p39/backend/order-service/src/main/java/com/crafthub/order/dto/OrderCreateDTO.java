package com.crafthub.order.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.math.BigDecimal;

@Data
public class OrderCreateDTO {

    @NotNull(message = "用户ID不能为空")
    private Long userId;

    @NotNull(message = "匠人ID不能为空")
    private Long artisanId;

    private Long requirementId;

    @NotBlank(message = "订单标题不能为空")
    private String title;

    private String description;

    @NotNull(message = "订单金额不能为空")
    private BigDecimal amount;
}

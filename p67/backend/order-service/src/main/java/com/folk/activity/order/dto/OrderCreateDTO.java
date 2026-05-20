package com.folk.activity.order.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class OrderCreateDTO {
    @NotNull(message = "用户ID不能为空")
    private Long userId;

    @NotBlank(message = "用户姓名不能为空")
    private String userName;

    @NotBlank(message = "手机号不能为空")
    private String userPhone;

    @NotNull(message = "活动ID不能为空")
    private Long activityId;

    @NotBlank(message = "活动名称不能为空")
    private String activityName;

    @Min(value = 1, message = "报名人数至少1人")
    private Integer quantity;

    @NotNull(message = "单价不能为空")
    private BigDecimal unitPrice;

    private String remark;
}

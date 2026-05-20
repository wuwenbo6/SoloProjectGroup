package com.crafthub.artisan.dto;

import jakarta.validation.constraints.*;
import lombok.Data;
import java.math.BigDecimal;
import java.util.List;

@Data
public class ReviewCreateDTO {

    @NotNull(message = "订单ID不能为空")
    private Long orderId;

    @NotNull(message = "匠人ID不能为空")
    private Long artisanId;

    private Long portfolioId;

    @NotNull(message = "总体评分不能为空")
    @DecimalMin(value = "1.0", message = "评分最小为1")
    @DecimalMax(value = "5.0", message = "评分最大为5")
    private BigDecimal overallRating;

    @NotNull(message = "工艺评分不能为空")
    @DecimalMin(value = "1.0", message = "评分最小为1")
    @DecimalMax(value = "5.0", message = "评分最大为5")
    private BigDecimal skillRating;

    @NotNull(message = "服务态度评分不能为空")
    @DecimalMin(value = "1.0", message = "评分最小为1")
    @DecimalMax(value = "5.0", message = "评分最大为5")
    private BigDecimal attitudeRating;

    @NotNull(message = "交付速度评分不能为空")
    @DecimalMin(value = "1.0", message = "评分最小为1")
    @DecimalMax(value = "5.0", message = "评分最大为5")
    private BigDecimal deliveryRating;

    @Size(max = 1000, message = "评价内容最多1000字")
    private String content;

    private List<String> images;

    private Boolean isAnonymous = false;
}

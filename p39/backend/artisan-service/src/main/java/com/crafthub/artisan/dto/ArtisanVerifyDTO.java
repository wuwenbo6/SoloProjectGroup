package com.crafthub.artisan.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ArtisanVerifyDTO {

    @NotNull(message = "匠人ID不能为空")
    private Long artisanId;

    @NotNull(message = "审核状态不能为空")
    private Integer status;

    private String reason;

    private Long verifyUserId;
}

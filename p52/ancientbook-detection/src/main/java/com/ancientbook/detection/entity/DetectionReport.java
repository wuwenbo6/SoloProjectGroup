package com.ancientbook.detection.entity;

import com.ancientbook.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
public class DetectionReport extends BaseEntity {

    @NotBlank(message = "报告编号不能为空")
    private String reportCode;

    @NotNull(message = "善本ID不能为空")
    private Long bookId;

    @NotBlank(message = "善本编号不能为空")
    private String bookCode;

    @NotNull(message = "检测类型不能为空")
    private Integer detectionType;

    private String thirdPartyCode;

    private String thirdPartyName;

    private Long reporterId;

    private String reporterName;

    private LocalDateTime reportTime;

    private java.math.BigDecimal phValue;

    private String fiberType;

    private Integer agingDegree;

    private String damageDetails;

    private String images;

    private String conclusion;

    private String suggestions;

    private Integer syncStatus;

    private LocalDateTime syncTime;

    private Integer status;
}

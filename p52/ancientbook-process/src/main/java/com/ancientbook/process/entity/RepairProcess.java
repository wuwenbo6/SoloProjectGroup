package com.ancientbook.process.entity;

import com.ancientbook.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

@Data
@EqualsAndHashCode(callSuper = true)
public class RepairProcess extends BaseEntity {

    @NotBlank(message = "工艺编号不能为空")
    private String processCode;

    @NotBlank(message = "工艺名称不能为空")
    private String processName;

    @NotNull(message = "工艺类型不能为空")
    private Integer processType;

    @NotNull(message = "适用最小破损等级不能为空")
    private Integer minConditionLevel;

    @NotNull(message = "适用最大破损等级不能为空")
    private Integer maxConditionLevel;

    private String applicableMaterials;

    private String materials;

    private String tools;

    private String steps;

    private String standard;

    private Integer durationEstimate;

    private Integer difficultyLevel;

    private java.math.BigDecimal successRate;

    private Long creatorId;

    private String creatorName;

    private Integer status;

    private String remark;
}

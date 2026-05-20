package com.ancientbook.progress.entity;

import com.ancientbook.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
public class RepairProgress extends BaseEntity {

    @NotBlank(message = "进度编号不能为空")
    private String progressCode;

    @NotNull(message = "善本ID不能为空")
    private Long bookId;

    @NotBlank(message = "善本编号不能为空")
    private String bookCode;

    @NotNull(message = "修复阶段不能为空")
    private Integer stage;

    @NotNull(message = "工序步骤不能为空")
    private Integer step;

    @NotBlank(message = "工序名称不能为空")
    private String stepName;

    @NotNull(message = "操作人员ID不能为空")
    private Long operatorId;

    @NotBlank(message = "操作人员姓名不能为空")
    private String operatorName;

    private LocalDateTime startTime;

    private LocalDateTime endTime;

    private Integer status;

    private Integer duration;

    private java.math.BigDecimal qualityScore;

    private String paramsJson;

    private String images;

    private String remark;
}

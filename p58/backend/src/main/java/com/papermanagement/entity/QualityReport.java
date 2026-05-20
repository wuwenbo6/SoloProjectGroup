package com.papermanagement.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("quality_report")
public class QualityReport {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String batchNo;

    private String reportNo;

    private Long inspectorId;

    private String inspectorName;

    private BigDecimal thickness;

    private BigDecimal density;

    private BigDecimal tensileStrength;

    private BigDecimal whiteness;

    private BigDecimal fiberRatioBamboo;

    private BigDecimal fiberRatioWood;

    private BigDecimal fiberRatioHemp;

    private BigDecimal fiberRatioCotton;

    private String appearance;

    private String qualityLevel;

    private String result;

    private String remark;

    private LocalDateTime inspectTime;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}

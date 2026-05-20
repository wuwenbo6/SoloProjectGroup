package com.dye.traceability.quality.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.dye.traceability.common.core.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("quality_inspection")
public class QualityInspection extends BaseEntity {

    private static final long serialVersionUID = 1L;

    @TableField("inspection_no")
    private String inspectionNo;

    @TableField("batch_no")
    private String batchNo;

    @TableField("formula_no")
    private String formulaNo;

    @TableField("inspector")
    private String inspector;

    @TableField("inspection_type")
    private String inspectionType;

    @TableField("color_difference")
    private BigDecimal colorDifference;

    @TableField("color_fastness")
    private BigDecimal colorFastness;

    @TableField("ph_value")
    private BigDecimal phValue;

    @TableField("solid_content")
    private BigDecimal solidContent;

    @TableField("appearance")
    private String appearance;

    @TableField("inspection_result")
    private String inspectionResult;

    @TableField("remark")
    private String remark;

    @TableField("status")
    private Integer status;
}

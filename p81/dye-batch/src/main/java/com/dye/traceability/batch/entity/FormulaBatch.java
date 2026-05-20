package com.dye.traceability.batch.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.dye.traceability.common.core.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("formula_batch")
public class FormulaBatch extends BaseEntity {

    private static final long serialVersionUID = 1L;

    @TableField("batch_no")
    private String batchNo;

    @TableField("formula_no")
    private String formulaNo;

    @TableField("formula_name")
    private String formulaName;

    @TableField("quantity")
    private BigDecimal quantity;

    @TableField("unit")
    private String unit;

    @TableField("workshop")
    private String workshop;

    @TableField("production_line")
    private String productionLine;

    @TableField("operator")
    private String operator;

    @TableField("plan_start_time")
    private LocalDateTime planStartTime;

    @TableField("actual_start_time")
    private LocalDateTime actualStartTime;

    @TableField("actual_end_time")
    private LocalDateTime actualEndTime;

    @TableField("quality_status")
    private String qualityStatus;

    @TableField("remark")
    private String remark;

    @TableField("status")
    private Integer status;
}

package com.dye.traceability.trace.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.dye.traceability.common.core.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("process_trace")
public class ProcessTrace extends BaseEntity {

    private static final long serialVersionUID = 1L;

    @TableField("process_code")
    private String processCode;

    @TableField("batch_no")
    private String batchNo;

    @TableField("formula_no")
    private String formulaNo;

    @TableField("process_name")
    private String processName;

    @TableField("process_type")
    private String processType;

    @TableField("start_time")
    private LocalDateTime startTime;

    @TableField("end_time")
    private LocalDateTime endTime;

    @TableField("operator")
    private String operator;

    @TableField("equipment_code")
    private String equipmentCode;

    @TableField("process_parameters")
    private String processParameters;

    @TableField("environment_data")
    private String environmentData;

    @TableField("status")
    private Integer status;

    @TableField("remark")
    private String remark;
}

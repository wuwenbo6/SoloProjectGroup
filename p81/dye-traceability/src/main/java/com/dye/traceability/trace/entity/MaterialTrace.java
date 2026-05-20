package com.dye.traceability.trace.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.dye.traceability.common.core.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("material_trace")
public class MaterialTrace extends BaseEntity {

    private static final long serialVersionUID = 1L;

    @TableField("trace_code")
    private String traceCode;

    @TableField("material_code")
    private String materialCode;

    @TableField("material_name")
    private String materialName;

    @TableField("supplier_code")
    private String supplierCode;

    @TableField("supplier_name")
    private String supplierName;

    @TableField("batch_no")
    private String batchNo;

    @TableField("production_date")
    private String productionDate;

    @TableField("quality_level")
    private String qualityLevel;

    @TableField("certification_no")
    private String certificationNo;

    @TableField("logistics_info")
    private String logisticsInfo;

    @TableField("storage_location")
    private String storageLocation;

    @TableField("status")
    private Integer status;

    @TableField("remark")
    private String remark;
}

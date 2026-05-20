package com.dye.traceability.formula.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.dye.traceability.common.core.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("dye_formula_material")
public class DyeFormulaMaterial extends BaseEntity {

    private static final long serialVersionUID = 1L;

    @TableField("formula_id")
    private Long formulaId;

    @TableField("material_code")
    private String materialCode;

    @TableField("material_name")
    private String materialName;

    @TableField("material_type")
    private String materialType;

    @TableField("origin_place")
    private String originPlace;

    @TableField("dosage")
    private BigDecimal dosage;

    @TableField("unit")
    private String unit;

    @TableField("sort_order")
    private Integer sortOrder;

    @TableField("remark")
    private String remark;
}

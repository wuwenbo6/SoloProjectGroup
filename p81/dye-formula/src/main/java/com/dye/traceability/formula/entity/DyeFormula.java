package com.dye.traceability.formula.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.dye.traceability.common.core.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("dye_formula")
public class DyeFormula extends BaseEntity {

    private static final long serialVersionUID = 1L;

    @TableField("formula_no")
    private String formulaNo;

    @TableField("formula_name")
    private String formulaName;

    @TableField("color_system")
    private String colorSystem;

    @TableField("color_code")
    private String colorCode;

    @TableField("description")
    private String description;

    @TableField("ph_value")
    private BigDecimal phValue;

    @TableField("temperature")
    private BigDecimal temperature;

    @TableField("process_time")
    private Integer processTime;

    @TableField("expire_date")
    private LocalDate expireDate;

    @TableField("status")
    private Integer status;

    @TableField(exist = false)
    private List<DyeFormulaMaterial> materials;

    @TableField(exist = false)
    private String warningLevel;

    @TableField(exist = false)
    private Long daysUntilExpire;
}

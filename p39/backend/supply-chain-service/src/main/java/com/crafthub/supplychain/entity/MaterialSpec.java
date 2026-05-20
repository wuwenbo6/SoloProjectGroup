package com.crafthub.supplychain.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("material_spec")
public class MaterialSpec {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long materialId;

    private String specName;

    private String specValue;

    private BigDecimal priceAdjust;

    private Integer stock;

    private Integer sortOrder;

    private Integer status;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @Version
    private Integer version;

    @TableLogic
    private Integer deleted;
}

package com.crafthub.supplychain.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("material_attribute")
public class MaterialAttribute {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long materialId;

    private String name;

    private String value;

    private Integer sortOrder;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @Version
    private Integer version;

    @TableLogic
    private Integer deleted;
}

package com.crafthub.supplychain.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("user_material_selection")
public class UserMaterialSelection {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    private Long requirementId;

    private Long orderId;

    private Long materialId;

    private Long specId;

    private Integer quantity;

    private BigDecimal unitPrice;

    private BigDecimal totalPrice;

    private String customizationNotes;

    private Integer status;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @Version
    private Integer version;

    @TableLogic
    private Integer deleted;

    @TableField(exist = false)
    private String materialName;

    @TableField(exist = false)
    private String materialImage;
}

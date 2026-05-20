package com.crafthub.supplychain.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@TableName("material")
public class Material {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long categoryId;

    private String name;

    private String code;

    private String description;

    private String features;

    private String origin;

    private String unit;

    private BigDecimal price;

    private BigDecimal marketPrice;

    private Integer stock;

    private Integer minOrder;

    private Integer deliveryDays;

    private String images;

    private String sampleImage;

    private Long supplierId;

    private Integer qualityLevel;

    private String certification;

    private Integer ecoFriendly;

    private Integer viewCount;

    private Integer usageCount;

    private BigDecimal rating;

    private Integer reviewCount;

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
    private String categoryName;

    @TableField(exist = false)
    private String supplierName;

    @TableField(exist = false)
    private List<MaterialSpec> specs;

    @TableField(exist = false)
    private List<MaterialAttribute> attributes;
}

package com.heritage.common.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("equipment_part")
public class EquipmentPart {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long equipmentId;
    private String name;
    private String partNo;
    private String material;
    private String modelMeshId;
    private String description;
    private Integer sortOrder;
    private String status;
}

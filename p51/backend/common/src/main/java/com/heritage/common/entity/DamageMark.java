package com.heritage.common.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("damage_mark")
public class DamageMark {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long equipmentId;
    private String position;
    private String damageType;
    private String severity;
    private String description;
    private String coordinate;
    private String status;
}

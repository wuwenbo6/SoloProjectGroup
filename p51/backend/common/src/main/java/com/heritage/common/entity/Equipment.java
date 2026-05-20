package com.heritage.common.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@TableName("equipment")
public class Equipment {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String name;
    private String equipmentType;
    private String factory;
    private Integer manufactureYear;
    private String location;
    private String status;
    private String description;
    private String modelPath;
    private String thumbnail;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;

    @TableField(exist = false)
    private List<EquipmentPart> parts;

    @TableField(exist = false)
    private List<DamageMark> damageMarks;
}

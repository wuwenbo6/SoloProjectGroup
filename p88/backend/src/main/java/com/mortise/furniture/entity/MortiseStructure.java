package com.mortise.furniture.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("mortise_structure")
public class MortiseStructure {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long furnitureId;

    private String name;

    private String type;

    private String parameters;

    private Double mortiseWidth;

    private Double mortiseHeight;

    private Double mortiseDepth;

    private Double tenonWidth;

    private Double tenonHeight;

    private Double tenonDepth;

    private String position;

    private String modelPath;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;

    private Boolean deleted;
}

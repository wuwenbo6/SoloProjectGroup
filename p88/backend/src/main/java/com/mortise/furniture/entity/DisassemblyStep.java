package com.mortise.furniture.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("disassembly_step")
public class DisassemblyStep {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long furnitureId;

    private Integer stepOrder;

    private String title;

    private String description;

    private String componentName;

    private String animationType;

    private String animationParams;

    private String highlightColor;

    private Double duration;

    private String tips;

    private String warning;

    private String toolsRequired;

    private Integer difficulty;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;

    private Boolean deleted;
}

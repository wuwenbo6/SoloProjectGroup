package com.mortise.furniture.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("craft_instruction")
public class CraftInstruction {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long furnitureId;

    private Long mortiseId;

    private String title;

    private String content;

    private String steps;

    private String images;

    private String video;

    private Integer difficulty;

    private Integer estimatedTime;

    private String tools;

    private String materials;

    private String lang;

    private String titleEn;

    private String contentEn;

    private String stepsEn;

    private String titleJa;

    private String contentJa;

    private String stepsJa;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;

    private Boolean deleted;
}

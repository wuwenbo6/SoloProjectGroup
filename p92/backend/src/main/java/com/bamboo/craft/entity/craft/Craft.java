package com.bamboo.craft.entity.craft;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("t_craft")
public class Craft {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String title;

    private String category;

    private String description;

    private String image;

    private String images;

    private String materials;

    private String craftSteps;

    private Long userId;

    private String artisanName;

    private String artisanAvatar;

    private Integer views = 0;

    private Integer likes = 0;

    private Integer comments = 0;

    private Integer status = 0;

    private Integer isHeritage = 0;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted = 0;
}

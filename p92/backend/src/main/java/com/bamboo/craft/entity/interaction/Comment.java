package com.bamboo.craft.entity.interaction;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("t_comment")
public class Comment {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long craftId;

    private Long userId;

    private String username;

    private String userAvatar;

    private String content;

    private Long parentId;

    private Integer likes = 0;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableLogic
    private Integer deleted = 0;
}

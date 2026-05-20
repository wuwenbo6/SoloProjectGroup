package com.crafthub.artisan.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("t_artisan")
public class Artisan {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    private String realName;

    private String idCard;

    private String craftType;

    private String title;

    private String avatar;

    private String bio;

    private Integer experienceYears;

    private String location;

    private BigDecimal avgRating;

    private Integer orderCount;

    private Integer status;

    private LocalDateTime verifyTime;

    private Long verifyUserId;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}

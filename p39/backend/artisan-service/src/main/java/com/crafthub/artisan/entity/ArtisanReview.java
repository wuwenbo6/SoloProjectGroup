package com.crafthub.artisan.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("artisan_review")
public class ArtisanReview {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long orderId;

    private Long artisanId;

    private Long userId;

    private Long portfolioId;

    private BigDecimal overallRating;

    private BigDecimal skillRating;

    private BigDecimal attitudeRating;

    private BigDecimal deliveryRating;

    private String content;

    private String images;

    private Integer isAnonymous;

    private Integer helpfulCount;

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
    private String userName;

    @TableField(exist = false)
    private String userAvatar;

    @TableField(exist = false)
    private Boolean isHelpful;
}

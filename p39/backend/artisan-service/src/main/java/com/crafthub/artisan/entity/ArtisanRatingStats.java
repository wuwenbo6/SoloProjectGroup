package com.crafthub.artisan.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("artisan_rating_stats")
public class ArtisanRatingStats {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long artisanId;

    private Integer totalReviews;

    private BigDecimal avgOverallRating;

    private BigDecimal avgSkillRating;

    private BigDecimal avgAttitudeRating;

    private BigDecimal avgDeliveryRating;

    private Integer fiveStarCount;

    private Integer fourStarCount;

    private Integer threeStarCount;

    private Integer twoStarCount;

    private Integer oneStarCount;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @Version
    private Integer version;

    @TableLogic
    private Integer deleted;
}

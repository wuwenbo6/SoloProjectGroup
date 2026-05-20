package com.folk.activity.common.core.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_activity_rating")
public class ActivityRating extends BaseEntity {
    private Long activityId;
    private Long userId;
    private String userName;
    private String userAvatar;
    private Integer rating;
    private String content;
    private String[] images;
    private Integer likeCount;
    private Integer status;
    private String reply;
}

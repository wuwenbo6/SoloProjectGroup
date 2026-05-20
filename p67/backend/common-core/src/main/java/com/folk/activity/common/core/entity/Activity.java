package com.folk.activity.common.core.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_activity")
public class Activity extends BaseEntity {
    private String name;
    private String category;
    private String description;
    private String coverImage;
    private String[] images;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private String location;
    private BigDecimal price;
    private Integer maxParticipants;
    private Integer currentParticipants;
    private String[] requirements;
    private String[] processSteps;
    private String[] highlights;
    private String organizer;
    private String contactPhone;
    private Integer status;
    private Double rating;
    private Integer ratingCount;
}

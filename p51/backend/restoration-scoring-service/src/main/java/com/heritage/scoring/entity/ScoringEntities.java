package com.heritage.scoring.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("restoration_score")
public class RestorationScore {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long equipmentId;
    private Long planId;
    private String planName;
    private Double technicalAccuracy;
    private Double historicalAuthenticity;
    private Double materialCompatibility;
    private Double processReliability;
    private Double aestheticEffect;
    private Double durability;
    private Double costEffectiveness;
    private Double totalScore;
    private String grade;
    private String evaluatorId;
    private String evaluatorName;
    private String evaluationComment;
    private String evaluationMethod;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}

@Data
@TableName("restoration_plan")
class RestorationPlan {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long equipmentId;
    private String equipmentName;
    private String planName;
    private String planDescription;
    private String planType;
    private String creatorId;
    private String creatorName;
    private Double estimatedCost;
    private Integer estimatedDays;
    private String materials;
    private String processes;
    private String expectedEffect;
    private String status;
    private String reviewStatus;
    private String reviewerId;
    private String reviewerName;
    private String reviewComment;
    private LocalDateTime reviewTime;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}

@Data
@TableName("expert_review")
class ExpertReview {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long planId;
    private String planName;
    private Long equipmentId;
    private String expertId;
    private String expertName;
    private String expertTitle;
    private String reviewType;
    private Integer technicalAccuracy;
    private Integer historicalAuthenticity;
    private Integer materialCompatibility;
    private Integer processReliability;
    private Integer safetyStandard;
    private Integer documentation;
    private Integer overallScore;
    private String reviewComment;
    private String suggestions;
    private String reviewResult;
    private LocalDateTime reviewTime;
    private LocalDateTime createTime;
}

@Data
@TableName("review_workflow")
class ReviewWorkflow {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long planId;
    private String currentStage;
    private Integer currentLevel;
    private String approverIds;
    private String completedApprovers;
    private String nextApprover;
    private String status;
    private LocalDateTime submitTime;
    private LocalDateTime lastReviewTime;
    private LocalDateTime completeTime;
}
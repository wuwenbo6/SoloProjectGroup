package com.ancient.book.common.entity;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.Map;

@Data
public class RestorationProgress {

    private String sessionId;

    private Long pageId;

    private String bookName;

    private Integer currentStep;

    private Integer totalSteps;

    private String stepName;

    private Double progressPercent;

    private String status;

    private String message;

    private Map<String, Object> stepData;

    private String operatorId;

    private String operatorName;

    private LocalDateTime startTime;

    private LocalDateTime updateTime;

    private Long estimatedRemainingTime;

    private Boolean isCompleted;

    private Boolean hasError;

    private String errorMessage;
}

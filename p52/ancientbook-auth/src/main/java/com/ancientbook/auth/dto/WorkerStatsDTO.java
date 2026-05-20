package com.ancientbook.auth.dto;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class WorkerStatsDTO {

    private Long workerId;

    private String workerName;

    private Integer skillLevel;

    private String specialty;

    private Long totalTasks;

    private Long completedTasks;

    private Long inProgressTasks;

    private Long pendingTasks;

    private Long totalBooks;

    private Long totalDurationMinutes;

    private BigDecimal avgQualityScore;

    private BigDecimal completionRate;

    private Integer ranking;

    private Long currentMonthTasks;

    private Long currentMonthBooks;
}

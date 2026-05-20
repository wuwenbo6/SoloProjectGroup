package com.ancientbook.auth.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class TaskRecordDTO {

    private String taskId;

    private Long bookId;

    private String bookCode;

    private String bookName;

    private String bookType;

    private String dynasty;

    private Integer processType;

    private String processName;

    private Long workerId;

    private String workerName;

    private Integer skillLevel;

    private LocalDateTime startTime;

    private LocalDateTime endTime;

    private Integer durationMinutes;

    private BigDecimal qualityScore;

    private Integer status;

    private String materialUsed;

    private String remark;

    private LocalDateTime createTime;
}

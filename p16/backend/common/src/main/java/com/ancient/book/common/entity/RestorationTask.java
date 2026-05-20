package com.ancient.book.common.entity;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Data
public class RestorationTask {

    private String taskId;
    private TaskType taskType;
    private TaskPriority priority;
    private TaskStatus status;
    private Long pageId;
    private String pageTitle;
    private Long bookId;
    private String bookName;
    private Long userId;
    private String userName;
    private Map<String, Object> parameters;
    private Map<String, Object> result;
    private int progress;
    private String message;
    private LocalDateTime createTime;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private long estimatedDurationMs;
    private int retryCount;
    private int maxRetries;
    private String errorMessage;
    private String parentTaskId;
    private int subTaskCount;
    private int completedSubTaskCount;

    public enum TaskType {
        IMAGE_ENHANCEMENT,
        OCR_RECOGNITION,
        TEXT_RESTORATION,
        STAIN_REMOVAL,
        HOLE_INPAINTING,
        COLORIZATION,
        BATCH_EXPORT,
        QUALITY_CHECK,
        TEXT_SEGMENTATION,
        DIALECT_CONVERSION
    }

    public enum TaskPriority {
        LOW(1),
        NORMAL(2),
        HIGH(3),
        CRITICAL(4);

        private final int level;

        TaskPriority(int level) {
            this.level = level;
        }

        public int getLevel() {
            return level;
        }
    }

    public enum TaskStatus {
        PENDING,
        QUEUED,
        RUNNING,
        COMPLETED,
        FAILED,
        CANCELLED,
        PAUSED,
        RETRYING
    }

    public RestorationTask() {
        this.taskId = UUID.randomUUID().toString();
        this.createTime = LocalDateTime.now();
        this.status = TaskStatus.PENDING;
        this.priority = TaskPriority.NORMAL;
        this.parameters = new ConcurrentHashMap<>();
        this.progress = 0;
        this.retryCount = 0;
        this.maxRetries = 3;
    }

    public long getDurationMs() {
        if (startTime == null) return 0;
        LocalDateTime end = endTime != null ? endTime : LocalDateTime.now();
        return java.time.Duration.between(startTime, end).toMillis();
    }

    public boolean isFinished() {
        return status == TaskStatus.COMPLETED ||
               status == TaskStatus.FAILED ||
               status == TaskStatus.CANCELLED;
    }

    public boolean canRetry() {
        return retryCount < maxRetries && status == TaskStatus.FAILED;
    }
}

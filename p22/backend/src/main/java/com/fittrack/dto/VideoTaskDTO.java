package com.fittrack.dto;

import com.fittrack.entity.VideoAnalysisTask;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class VideoTaskDTO {

    private String taskId;
    private String status;
    private String statusDescription;
    private int progress;
    private String originalFilename;
    private Long fileSize;
    private String exerciseName;
    private Double averageAccuracy;
    private Integer repsCount;
    private String suggestions;
    private String errorMessage;
    private LocalDateTime createdAt;
    private LocalDateTime completedAt;
    private Long processingTimeMs;

    public static VideoTaskDTO fromEntity(VideoAnalysisTask task) {
        VideoTaskDTO dto = new VideoTaskDTO();
        dto.setTaskId(task.getTaskId());
        dto.setStatus(task.getStatus().name());
        dto.setStatusDescription(getStatusDescription(task.getStatus()));
        dto.setProgress(task.getProgress());
        dto.setOriginalFilename(task.getOriginalFilename());
        dto.setFileSize(task.getFileSize());
        dto.setExerciseName(task.getExerciseTemplate() != null ?
            task.getExerciseTemplate().getName() : null);
        dto.setAverageAccuracy(task.getAverageAccuracy());
        dto.setRepsCount(task.getRepsCount());
        dto.setSuggestions(task.getSuggestions());
        dto.setErrorMessage(task.getErrorMessage());
        dto.setCreatedAt(task.getCreatedAt());
        dto.setCompletedAt(task.getCompletedAt());
        dto.setProcessingTimeMs(task.getProcessingTimeMs());
        return dto;
    }

    private static String getStatusDescription(VideoAnalysisTask.TaskStatus status) {
        switch (status) {
            case PENDING: return "等待中";
            case UPLOADED: return "已上传";
            case PROCESSING: return "处理中";
            case FRAME_EXTRACTION: return "帧提取中";
            case POSE_ESTIMATION: return "姿态估计中";
            case DTW_ANALYSIS: return "动作分析中";
            case COMPLETED: return "已完成";
            case FAILED: return "失败";
            case CANCELLED: return "已取消";
            default: return status.name();
        }
    }
}

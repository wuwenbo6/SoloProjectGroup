package com.fittrack.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Data
@Table(name = "video_analysis_tasks")
public class VideoAnalysisTask {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String taskId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exercise_template_id", nullable = false)
    private ExerciseTemplate exerciseTemplate;

    @Column(nullable = false)
    private String originalFilename;

    @Column(nullable = false)
    private String storedFilePath;

    @Column(nullable = false)
    private Long fileSize;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private TaskStatus status = TaskStatus.PENDING;

    @Column
    private Integer progress = 0;

    @Column(columnDefinition = "TEXT")
    private String errorMessage;

    @Column
    private Integer totalFrames;

    @Column
    private Integer analyzedFrames;

    @Column
    private Double averageAccuracy;

    @Column
    private Integer repsCount;

    @Column(columnDefinition = "TEXT")
    private String analysisResult;

    @Column(columnDefinition = "TEXT")
    private String suggestions;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column
    private LocalDateTime startedAt;

    @Column
    private LocalDateTime completedAt;

    @Column
    private Long processingTimeMs;

    public enum TaskStatus {
        PENDING,
        UPLOADED,
        PROCESSING,
        FRAME_EXTRACTION,
        POSE_ESTIMATION,
        DTW_ANALYSIS,
        COMPLETED,
        FAILED,
        CANCELLED
    }
}

package com.mortisejoiner.entity.user;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "learning_progress")
public class LearningProgress {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private Long furnitureId;

    @Column(nullable = false)
    private Integer currentStep;

    @Column(nullable = false)
    private Integer totalSteps;

    @Column(nullable = false)
    private Boolean isCompleted = false;

    @Column(nullable = false)
    private Integer totalTimeSpent = 0;

    private LocalDateTime startedAt;

    private LocalDateTime completedAt;

    private LocalDateTime lastAccessed;

    @Column(length = 1000)
    private String notes;

    @PrePersist
    protected void onCreate() {
        startedAt = LocalDateTime.now();
        lastAccessed = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        lastAccessed = LocalDateTime.now();
    }
}

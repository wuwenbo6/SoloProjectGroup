package com.fittrack.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Data
@Table(name = "exercise_templates")
public class ExerciseTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    @Column(nullable = false)
    private String description;

    @Column(nullable = false)
    private String exerciseType;

    @Column(nullable = false)
    private Integer difficultyLevel;

    @OneToMany(mappedBy = "exerciseTemplate", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<TemplateFrame> templateFrames = new ArrayList<>();

    @Column(columnDefinition = "TEXT")
    private String correctionTips;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(nullable = false)
    private Boolean isActive = true;
}

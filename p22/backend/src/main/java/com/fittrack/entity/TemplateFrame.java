package com.fittrack.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Data
@Table(name = "template_frames")
public class TemplateFrame {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Integer frameOrder;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String keypointsJson;

    @Column(columnDefinition = "TEXT")
    private String anglesJson;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exercise_template_id")
    private ExerciseTemplate exerciseTemplate;
}

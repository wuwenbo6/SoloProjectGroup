package com.rubbing.entity.interpretation;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "annotation")
public class Annotation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "rubbing_id", nullable = false)
    private Long rubbingId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "last_modified_by")
    private Long lastModifiedBy;

    @Column(nullable = false)
    private Double x;

    @Column(nullable = false)
    private Double y;

    @Column(nullable = false)
    private Double width;

    @Column(nullable = false)
    private Double height;

    @Column(columnDefinition = "TEXT")
    private String text;

    @Column
    private Double confidence;

    @Version
    private Long version;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();
}

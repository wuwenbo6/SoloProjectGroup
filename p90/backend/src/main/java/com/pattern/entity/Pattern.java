package com.pattern.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Entity
@Table(name = "patterns")
public class Pattern {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(columnDefinition = "TEXT")
    private String imageData;

    @ElementCollection
    @CollectionTable(name = "pattern_tags", joinColumns = @JoinColumn(name = "pattern_id"))
    @Column(name = "tag")
    private List<String> tags;

    private Long userId;

    private String authorName;

    private Integer likeCount = 0;

    private Integer commentCount = 0;

    private Integer shareCount = 0;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}

package com.mortisejoiner.entity.furniture;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Entity
@Table(name = "furniture")
public class Furniture {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 500)
    private String description;

    @Column(length = 500)
    private String modelPath;

    @Column(length = 200)
    private String thumbnail;

    @Column(length = 50)
    private String category;

    @Column(nullable = false)
    private Integer difficulty;

    @Column(nullable = false)
    private Integer totalSteps;

    @OneToMany(mappedBy = "furniture", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<FurniturePart> parts;

    @Column(nullable = false)
    private Boolean isActive = true;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}

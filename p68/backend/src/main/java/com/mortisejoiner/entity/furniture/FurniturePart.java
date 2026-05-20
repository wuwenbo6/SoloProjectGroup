package com.mortisejoiner.entity.furniture;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "furniture_part")
public class FurniturePart {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "furniture_id", nullable = false)
    @JsonIgnore
    private Furniture furniture;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 1000)
    private String description;

    @Column(nullable = false)
    private Integer stepOrder;

    @Column(length = 100)
    private String modelId;

    @Column(length = 500)
    private String disassemblePosition;

    @Column(length = 200)
    private String mortiseType;

    @Column(length = 1000)
    private String assemblyTip;
}

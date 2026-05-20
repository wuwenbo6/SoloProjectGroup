package com.mortise.tenon.entity;

import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "t_mortise_tenon_model")
public class MortiseTenonModel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "model_code", unique = true, nullable = false, length = 50)
    private String modelCode;

    @Column(name = "model_name", nullable = false, length = 200)
    private String modelName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "type_id")
    private MortiseTenonType type;

    @Column(name = "ancient_building_name", length = 200)
    private String ancientBuildingName;

    @Column(name = "building_location", length = 200)
    private String buildingLocation;

    @Column(name = "historical_period", length = 100)
    private String historicalPeriod;

    @Column(name = "model_file_path", length = 500)
    private String modelFilePath;

    @Column(name = "model_file_format", length = 20)
    private String modelFileFormat;

    @Column(name = "model_file_size")
    private Long modelFileSize;

    @Column(name = "vertex_count")
    private Integer vertexCount;

    @Column(name = "face_count")
    private Integer faceCount;

    @Column(name = "component_count")
    private Integer componentCount;

    @Column(name = "scale_x")
    private Double scaleX;

    @Column(name = "scale_y")
    private Double scaleY;

    @Column(name = "scale_z")
    private Double scaleZ;

    @Column(name = "center_x")
    private Double centerX;

    @Column(name = "center_y")
    private Double centerY;

    @Column(name = "center_z")
    private Double centerZ;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "craftsmanship", columnDefinition = "TEXT")
    private String craftsmanship;

    @Column(name = "is_published")
    private Boolean isPublished = false;

    @Column(name = "view_count")
    private Integer viewCount = 0;

    @CreationTimestamp
    @Column(name = "create_time", updatable = false)
    private LocalDateTime createTime;

    @UpdateTimestamp
    @Column(name = "update_time")
    private LocalDateTime updateTime;
}
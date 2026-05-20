package com.mortise.tenon.entity;

import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "t_stress_analysis")
public class StressAnalysis {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "model_id", nullable = false)
    private MortiseTenonModel model;

    @Column(name = "analysis_code", unique = true, length = 50)
    private String analysisCode;

    @Column(name = "analysis_name", length = 200)
    private String analysisName;

    @Column(name = "analysis_type", length = 50)
    private String analysisType;

    @Column(name = "node_id", length = 100)
    private String nodeId;

    @Column(name = "node_name", length = 200)
    private String nodeName;

    @Column(name = "node_position_x")
    private Double nodePositionX;

    @Column(name = "node_position_y")
    private Double nodePositionY;

    @Column(name = "node_position_z")
    private Double nodePositionZ;

    @Column(name = "max_stress")
    private Double maxStress;

    @Column(name = "min_stress")
    private Double minStress;

    @Column(name = "average_stress")
    private Double averageStress;

    @Column(name = "stress_unit", length = 20)
    private String stressUnit;

    @Column(name = "max_deformation")
    private Double maxDeformation;

    @Column(name = "safety_factor")
    private Double safetyFactor;

    @Column(name = "load_condition", columnDefinition = "TEXT")
    private String loadCondition;

    @Column(name = "material_properties", columnDefinition = "TEXT")
    private String materialProperties;

    @Column(name = "analysis_method", length = 100)
    private String analysisMethod;

    @Column(name = "result_data", columnDefinition = "LONGTEXT")
    private String resultData;

    @Column(name = "visualization_config", columnDefinition = "TEXT")
    private String visualizationConfig;

    @Column(name = "conclusion", columnDefinition = "TEXT")
    private String conclusion;

    @Column(name = "is_validated")
    private Boolean isValidated = false;

    @CreationTimestamp
    @Column(name = "create_time", updatable = false)
    private LocalDateTime createTime;

    @UpdateTimestamp
    @Column(name = "update_time")
    private LocalDateTime updateTime;
}
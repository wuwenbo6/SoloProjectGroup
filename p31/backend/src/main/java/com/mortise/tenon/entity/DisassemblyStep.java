package com.mortise.tenon.entity;

import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "t_disassembly_step")
public class DisassemblyStep {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "model_id", nullable = false)
    private MortiseTenonModel model;

    @Column(name = "step_order", nullable = false)
    private Integer stepOrder;

    @Column(name = "step_name", length = 200)
    private String stepName;

    @Column(name = "step_type", length = 50)
    private String stepType;

    @Column(name = "component_id", length = 100)
    private String componentId;

    @Column(name = "component_name", length = 200)
    private String componentName;

    @Column(name = "translate_x")
    private Double translatex;

    @Column(name = "translate_y")
    private Double translatey;

    @Column(name = "translate_z")
    private Double translatez;

    @Column(name = "rotate_x")
    private Double rotatex;

    @Column(name = "rotate_y")
    private Double rotatey;

    @Column(name = "rotate_z")
    private Double rotatez;

    @Column(name = "duration")
    private Integer duration;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "operation_hint", columnDefinition = "TEXT")
    private String operationHint;

    @Column(name = "is_reverse")
    private Boolean isReverse = false;

    @CreationTimestamp
    @Column(name = "create_time", updatable = false)
    private LocalDateTime createTime;

    @UpdateTimestamp
    @Column(name = "update_time")
    private LocalDateTime updateTime;
}
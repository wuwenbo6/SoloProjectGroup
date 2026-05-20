package com.bamboo.defect.entity;

import lombok.Data;
import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "process_params")
public class ProcessParams {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "param_type", length = 50)
    private String paramType;
    
    @Column(name = "param_name", length = 100)
    private String paramName;
    
    @Column(name = "param_value", length = 200)
    private String paramValue;
    
    @Column(name = "unit", length = 20)
    private String unit;
    
    @Column(name = "description", length = 500)
    private String description;
    
    @Column(name = "enabled")
    private Boolean enabled = true;
    
    @Column(name = "update_time")
    private LocalDateTime updateTime;
    
    @Column(name = "operator", length = 50)
    private String operator;
    
    @PrePersist
    @PreUpdate
    protected void onUpdate() {
        updateTime = LocalDateTime.now();
    }
}

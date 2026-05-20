package com.bamboo.defect.entity;

import lombok.Data;
import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "param_history")
public class ParamHistory {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "param_type", length = 50)
    private String paramType;
    
    @Column(name = "param_name", length = 100)
    private String paramName;
    
    @Column(name = "old_value", length = 200)
    private String oldValue;
    
    @Column(name = "new_value", length = 200)
    private String newValue;
    
    @Column(name = "operator", length = 50)
    private String operator;
    
    @Column(name = "timestamp")
    private LocalDateTime timestamp;
    
    @Column(name = "remark", length = 500)
    private String remark;
    
    @PrePersist
    protected void onCreate() {
        timestamp = LocalDateTime.now();
    }
}

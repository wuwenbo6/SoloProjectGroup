package com.bamboo.defect.entity;

import lombok.Data;
import javax.persistence.*;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Entity
@Table(name = "detection_record")
public class DetectionRecord {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "product_id", length = 50)
    private String productId;
    
    @Column(name = "timestamp")
    private LocalDateTime timestamp;
    
    @Column(name = "defect_count")
    private Integer defectCount = 0;
    
    @Column(name = "has_defect")
    private Boolean hasDefect = false;
    
    @Column(name = "operator", length = 50)
    private String operator;
    
    @Column(name = "handled")
    private Boolean handled = false;
    
    @Column(name = "remark", length = 500)
    private String remark;
    
    @Transient
    private List<DefectRecord> defects;
    
    @PrePersist
    protected void onCreate() {
        timestamp = LocalDateTime.now();
    }
}

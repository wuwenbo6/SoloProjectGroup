package com.bamboo.defect.entity;

import lombok.Data;
import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "defect_record")
public class DefectRecord {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "detection_id")
    private Long detectionId;
    
    @Column(name = "type", length = 50)
    private String type;
    
    @Column(name = "level")
    private Integer level;
    
    @Column(name = "level_name", length = 50)
    private String levelName;
    
    @Column(name = "severity_score")
    private Double severityScore;
    
    @Column(name = "position_x")
    private Double positionX;
    
    @Column(name = "position_y")
    private Double positionY;
    
    @Column(name = "width")
    private Double width;
    
    @Column(name = "height")
    private Double height;
    
    @Column(name = "confidence")
    private Double confidence;
    
    @Column(name = "size")
    private Double size;
    
    @Column(name = "area")
    private Double area;
    
    @Column(name = "description", length = 500)
    private String description;
    
    @Column(name = "timestamp")
    private LocalDateTime timestamp;
    
    @Column(name = "handled")
    private Boolean handled = false;
    
    @Column(name = "handle_time")
    private LocalDateTime handleTime;
    
    @Column(name = "handler", length = 50)
    private String handler;
    
    @Column(name = "remark", length = 500)
    private String remark;
    
    @PrePersist
    protected void onCreate() {
        timestamp = LocalDateTime.now();
    }
}

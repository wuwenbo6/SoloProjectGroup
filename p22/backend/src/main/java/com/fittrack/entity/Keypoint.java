package com.fittrack.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Data
@Table(name = "keypoints")
public class Keypoint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private Double x;

    @Column(nullable = false)
    private Double y;

    @Column(nullable = false)
    private Double z;

    @Column(nullable = false)
    private Double visibility;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "frame_data_id")
    private FrameData frameData;
}

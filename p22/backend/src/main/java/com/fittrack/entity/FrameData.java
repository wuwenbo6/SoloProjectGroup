package com.fittrack.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Data
@Table(name = "frame_data")
public class FrameData {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long timestamp;

    @Column(nullable = false)
    private Integer frameNumber;

    @OneToMany(mappedBy = "frameData", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Keypoint> keypoints = new ArrayList<>();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "workout_session_id")
    private WorkoutSession workoutSession;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}

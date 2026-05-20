package com.fittrack.repository;

import com.fittrack.entity.FrameData;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FrameDataRepository extends JpaRepository<FrameData, Long> {

    List<FrameData> findByWorkoutSessionIdOrderByFrameNumber(Long workoutSessionId);
}

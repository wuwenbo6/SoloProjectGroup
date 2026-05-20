package com.fittrack.repository;

import com.fittrack.entity.WorkoutSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface WorkoutSessionRepository extends JpaRepository<WorkoutSession, Long> {

    List<WorkoutSession> findByUserIdOrderByStartTimeDesc(Long userId);

    @Query("SELECT ws FROM WorkoutSession ws WHERE ws.user.id = :userId AND ws.startTime BETWEEN :start AND :end ORDER BY ws.startTime DESC")
    List<WorkoutSession> findByUserIdAndDateRange(Long userId, LocalDateTime start, LocalDateTime end);

    List<WorkoutSession> findTop10ByUserIdOrderByStartTimeDesc(Long userId);
}

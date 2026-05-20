package com.fittrack.repository;

import com.fittrack.entity.VideoAnalysisTask;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface VideoAnalysisTaskRepository extends JpaRepository<VideoAnalysisTask, Long> {

    Optional<VideoAnalysisTask> findByTaskId(String taskId);

    List<VideoAnalysisTask> findByUserIdOrderByCreatedAtDesc(Long userId);

    Page<VideoAnalysisTask> findByUserId(Long userId, Pageable pageable);

    List<VideoAnalysisTask> findByStatusIn(List<VideoAnalysisTask.TaskStatus> statuses);

    @Query("SELECT t FROM VideoAnalysisTask t WHERE t.user.id = :userId AND t.status = :status ORDER BY t.createdAt DESC")
    List<VideoAnalysisTask> findByUserIdAndStatus(@Param("userId") Long userId,
                                                   @Param("status") VideoAnalysisTask.TaskStatus status);

    @Query("SELECT COUNT(t) FROM VideoAnalysisTask t WHERE t.user.id = :userId AND t.status = :status")
    long countByUserIdAndStatus(@Param("userId") Long userId,
                                @Param("status") VideoAnalysisTask.TaskStatus status);

    @Query("SELECT AVG(t.averageAccuracy) FROM VideoAnalysisTask t WHERE t.user.id = :userId AND t.status = 'COMPLETED'")
    Double getAverageAccuracyForUser(@Param("userId") Long userId);
}

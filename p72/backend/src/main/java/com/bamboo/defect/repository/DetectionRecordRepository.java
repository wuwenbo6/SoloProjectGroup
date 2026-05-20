package com.bamboo.defect.repository;

import com.bamboo.defect.entity.DetectionRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface DetectionRecordRepository extends JpaRepository<DetectionRecord, Long> {
    
    Page<DetectionRecord> findAllByOrderByTimestampDesc(Pageable pageable);
    
    @Query("SELECT d FROM DetectionRecord d WHERE d.hasDefect = :hasDefect ORDER BY d.timestamp DESC")
    Page<DetectionRecord> findByHasDefect(@Param("hasDefect") Boolean hasDefect, Pageable pageable);
    
    @Query("SELECT d FROM DetectionRecord d WHERE d.handled = :handled ORDER BY d.timestamp DESC")
    Page<DetectionRecord> findByHandled(@Param("handled") Boolean handled, Pageable pageable);
    
    @Query("SELECT d FROM DetectionRecord d WHERE d.timestamp BETWEEN :startTime AND :endTime ORDER BY d.timestamp DESC")
    Page<DetectionRecord> findByTimeRange(@Param("startTime") LocalDateTime startTime, 
                                          @Param("endTime") LocalDateTime endTime, 
                                          Pageable pageable);
    
    @Query("SELECT COUNT(d) FROM DetectionRecord d WHERE d.timestamp BETWEEN :startTime AND :endTime")
    Long countByTimeRange(@Param("startTime") LocalDateTime startTime, @Param("endTime") LocalDateTime endTime);
    
    @Query("SELECT COUNT(d) FROM DetectionRecord d WHERE d.hasDefect = true AND d.timestamp BETWEEN :startTime AND :endTime")
    Long countDefectsByTimeRange(@Param("startTime") LocalDateTime startTime, @Param("endTime") LocalDateTime endTime);
    
    List<DetectionRecord> findTop10ByOrderByTimestampDesc();
    
    List<DetectionRecord> findByTimestampBetweenOrderByTimestampDesc(LocalDateTime startTime, LocalDateTime endTime);
    
    DetectionRecord findTopByOrderByTimestampDesc();
}

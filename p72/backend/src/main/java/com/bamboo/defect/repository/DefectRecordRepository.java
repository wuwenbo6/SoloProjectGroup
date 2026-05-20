package com.bamboo.defect.repository;

import com.bamboo.defect.entity.DefectRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface DefectRecordRepository extends JpaRepository<DefectRecord, Long> {
    
    List<DefectRecord> findByDetectionIdOrderByLevelDesc(Long detectionId);
    
    Page<DefectRecord> findAllByOrderByTimestampDesc(Pageable pageable);
    
    @Query("SELECT d FROM DefectRecord d WHERE d.level = :level ORDER BY d.timestamp DESC")
    Page<DefectRecord> findByLevel(@Param("level") Integer level, Pageable pageable);
    
    @Query("SELECT d FROM DefectRecord d WHERE d.type = :type ORDER BY d.timestamp DESC")
    Page<DefectRecord> findByType(@Param("type") String type, Pageable pageable);
    
    @Query("SELECT d FROM DefectRecord d WHERE d.timestamp BETWEEN :startTime AND :endTime ORDER BY d.timestamp DESC")
    Page<DefectRecord> findByTimeRange(@Param("startTime") LocalDateTime startTime, 
                                        @Param("endTime") LocalDateTime endTime, 
                                        Pageable pageable);
    
    List<DefectRecord> findTop10ByOrderByTimestampDesc();
    
    @Query("SELECT d.type, COUNT(d) FROM DefectRecord d WHERE d.timestamp BETWEEN :startTime AND :endTime GROUP BY d.type")
    List<Object[]> countByTypeInTimeRange(@Param("startTime") LocalDateTime startTime, 
                                           @Param("endTime") LocalDateTime endTime);
    
    @Query("SELECT DATE(d.timestamp), COUNT(d) FROM DefectRecord d WHERE d.timestamp BETWEEN :startTime AND :endTime GROUP BY DATE(d.timestamp) ORDER BY DATE(d.timestamp)")
    List<Object[]> countByDateInTimeRange(@Param("startTime") LocalDateTime startTime, 
                                           @Param("endTime") LocalDateTime endTime);
    
    List<DefectRecord> findByTimestampBetweenOrderByTimestampDesc(LocalDateTime startTime, LocalDateTime endTime);
    
    List<DefectRecord> findByTimestampBetweenAndLevelOrderByTimestampDesc(LocalDateTime startTime, LocalDateTime endTime, Integer level);
}

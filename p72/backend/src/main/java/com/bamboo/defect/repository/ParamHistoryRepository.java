package com.bamboo.defect.repository;

import com.bamboo.defect.entity.ParamHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ParamHistoryRepository extends JpaRepository<ParamHistory, Long> {
    
    Page<ParamHistory> findAllByOrderByTimestampDesc(Pageable pageable);
    
    Page<ParamHistory> findByParamTypeOrderByTimestampDesc(String paramType, Pageable pageable);
    
    List<ParamHistory> findTop10ByOrderByTimestampDesc();
    
    List<ParamHistory> findByParamTypeOrderByTimestampDesc(String paramType);
}

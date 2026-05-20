package com.bamboo.defect.repository;

import com.bamboo.defect.entity.ProcessParams;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProcessParamsRepository extends JpaRepository<ProcessParams, Long> {
    
    List<ProcessParams> findByParamType(String paramType);
    
    List<ProcessParams> findByEnabledTrue();
    
    ProcessParams findByParamTypeAndParamName(String paramType, String paramName);
}

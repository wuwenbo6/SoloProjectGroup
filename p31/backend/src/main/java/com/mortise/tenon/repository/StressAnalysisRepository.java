package com.mortise.tenon.repository;

import com.mortise.tenon.entity.StressAnalysis;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StressAnalysisRepository extends JpaRepository<StressAnalysis, Long> {

    Optional<StressAnalysis> findByAnalysisCode(String analysisCode);

    List<StressAnalysis> findByModelId(Long modelId);

    List<StressAnalysis> findByModelIdAndAnalysisType(Long modelId, String analysisType);

    List<StressAnalysis> findByIsValidatedTrue();

    void deleteByModelId(Long modelId);
}
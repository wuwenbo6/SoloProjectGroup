package com.mortise.tenon.repository;

import com.mortise.tenon.entity.DisassemblyStep;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DisassemblyStepRepository extends JpaRepository<DisassemblyStep, Long> {

    List<DisassemblyStep> findByModelIdOrderByStepOrderAsc(Long modelId);

    List<DisassemblyStep> findByModelIdAndIsReverseOrderByStepOrderAsc(Long modelId, Boolean isReverse);

    void deleteByModelId(Long modelId);
}
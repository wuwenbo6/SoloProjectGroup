package com.mortisejoiner.repository.teaching;

import com.mortisejoiner.entity.teaching.DisassembleStep;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DisassembleStepRepository extends JpaRepository<DisassembleStep, Long> {

    List<DisassembleStep> findByFurnitureIdOrderByStepNumber(Long furnitureId);

    Optional<DisassembleStep> findByFurnitureIdAndStepNumber(Long furnitureId, Integer stepNumber);

    Integer countByFurnitureId(Long furnitureId);
}

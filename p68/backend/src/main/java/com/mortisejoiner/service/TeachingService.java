package com.mortisejoiner.service;

import com.mortisejoiner.entity.teaching.DisassembleStep;
import com.mortisejoiner.repository.teaching.DisassembleStepRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class TeachingService {

    private static final Logger logger = LoggerFactory.getLogger(TeachingService.class);

    @Autowired
    private DisassembleStepRepository disassembleStepRepository;

    @Cacheable(value = "teachingSteps", key = "#furnitureId", cacheManager = "teachingCacheManager")
    public List<DisassembleStep> getStepsByFurnitureId(Long furnitureId) {
        long startTime = System.currentTimeMillis();
        logger.info("查询家具 {} 的拆解步骤", furnitureId);
        
        List<DisassembleStep> steps = disassembleStepRepository.findByFurnitureIdOrderByStepNumber(furnitureId);
        
        long duration = System.currentTimeMillis() - startTime;
        logger.info("查询完成，耗时 {} ms，共 {} 条记录", duration, steps.size());
        
        return steps;
    }

    @Cacheable(value = "teachingSteps", key = "#furnitureId + '_' + #stepNumber", cacheManager = "teachingCacheManager")
    public Optional<DisassembleStep> getStepByFurnitureAndStepNumber(Long furnitureId, Integer stepNumber) {
        return disassembleStepRepository.findByFurnitureIdAndStepNumber(furnitureId, stepNumber);
    }

    @Transactional
    @CacheEvict(value = "teachingSteps", allEntries = true, cacheManager = "teachingCacheManager")
    public DisassembleStep createStep(DisassembleStep step) {
        return disassembleStepRepository.save(step);
    }

    @Transactional
    @CacheEvict(value = "teachingSteps", allEntries = true, cacheManager = "teachingCacheManager")
    public List<DisassembleStep> createStepsBatch(List<DisassembleStep> steps) {
        return disassembleStepRepository.saveAll(steps);
    }
}

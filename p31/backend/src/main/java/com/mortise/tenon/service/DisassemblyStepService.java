package com.mortise.tenon.service;

import com.mortise.tenon.entity.DisassemblyStep;
import com.mortise.tenon.repository.DisassemblyStepRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class DisassemblyStepService {

    @Autowired
    private DisassemblyStepRepository stepRepository;

    public List<DisassemblyStep> findByModelId(Long modelId) {
        return stepRepository.findByModelIdOrderByStepOrderAsc(modelId);
    }

    public List<DisassemblyStep> findByModelIdAndDirection(Long modelId, Boolean isReverse) {
        return stepRepository.findByModelIdAndIsReverseOrderByStepOrderAsc(modelId, isReverse);
    }

    public Optional<DisassemblyStep> findById(Long id) {
        return stepRepository.findById(id);
    }

    @Transactional
    public DisassemblyStep save(DisassemblyStep step) {
        return stepRepository.save(step);
    }

    @Transactional
    public List<DisassemblyStep> saveAll(List<DisassemblyStep> steps) {
        return stepRepository.saveAll(steps);
    }

    @Transactional
    public void deleteById(Long id) {
        stepRepository.deleteById(id);
    }

    @Transactional
    public void deleteByModelId(Long modelId) {
        stepRepository.deleteByModelId(modelId);
    }
}
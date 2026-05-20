package com.shadowpuppet.backend.service.craft;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.shadowpuppet.backend.entity.craft.CraftStep;
import com.shadowpuppet.backend.mapper.craft.CraftStepMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class CraftStepService {

    @Autowired
    private CraftStepMapper craftStepMapper;

    public List<CraftStep> getStepsByCraftId(Long craftId) {
        LambdaQueryWrapper<CraftStep> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(CraftStep::getCraftId, craftId);
        wrapper.orderByAsc(CraftStep::getStepOrder);
        return craftStepMapper.selectList(wrapper);
    }

    @Transactional
    public boolean createStep(CraftStep step) {
        step.setCreatedAt(LocalDateTime.now());
        step.setUpdatedAt(LocalDateTime.now());
        if (step.getStepOrder() == null) {
            step.setStepOrder(getNextOrder(step.getCraftId()));
        }
        return craftStepMapper.insert(step) > 0;
    }

    @Transactional
    public boolean updateStep(CraftStep step) {
        step.setUpdatedAt(LocalDateTime.now());
        return craftStepMapper.updateById(step) > 0;
    }

    @Transactional
    public boolean deleteStep(Long id) {
        return craftStepMapper.deleteById(id) > 0;
    }

    @Transactional
    public boolean batchSaveSteps(Long craftId, List<CraftStep> steps) {
        LambdaQueryWrapper<CraftStep> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(CraftStep::getCraftId, craftId);
        craftStepMapper.delete(wrapper);

        for (int i = 0; i < steps.size(); i++) {
            CraftStep step = steps.get(i);
            step.setCraftId(craftId);
            step.setStepOrder(i + 1);
            step.setCreatedAt(LocalDateTime.now());
            step.setUpdatedAt(LocalDateTime.now());
            craftStepMapper.insert(step);
        }
        return true;
    }

    private Integer getNextOrder(Long craftId) {
        LambdaQueryWrapper<CraftStep> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(CraftStep::getCraftId, craftId);
        wrapper.orderByDesc(CraftStep::getStepOrder);
        wrapper.last("LIMIT 1");
        CraftStep lastStep = craftStepMapper.selectOne(wrapper);
        return lastStep != null ? lastStep.getStepOrder() + 1 : 1;
    }
}

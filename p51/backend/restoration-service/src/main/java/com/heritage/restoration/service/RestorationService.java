package com.heritage.restoration.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.heritage.common.entity.RestorationPlan;
import com.heritage.common.entity.RestorationProgress;
import com.heritage.restoration.mapper.RestorationPlanMapper;
import com.heritage.restoration.mapper.RestorationProgressMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class RestorationService extends ServiceImpl<RestorationPlanMapper, RestorationPlan> {

    @Autowired
    private RestorationProgressMapper progressMapper;

    public List<RestorationPlan> getByEquipmentId(Long equipmentId) {
        return this.list(new LambdaQueryWrapper<RestorationPlan>()
                .eq(RestorationPlan::getEquipmentId, equipmentId)
                .orderByDesc(RestorationPlan::getCreateTime));
    }

    public List<RestorationProgress> getProgressByPlanId(Long planId) {
        return progressMapper.selectList(new LambdaQueryWrapper<RestorationProgress>()
                .eq(RestorationProgress::getPlanId, planId)
                .orderByAsc(RestorationProgress::getStepOrder));
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean savePlanWithProgress(RestorationPlan plan, List<RestorationProgress> progressList) {
        boolean result = this.save(plan);
        if (result && progressList != null) {
            for (RestorationProgress progress : progressList) {
                progress.setPlanId(plan.getId());
                progress.setEquipmentId(plan.getEquipmentId());
                progressMapper.insert(progress);
            }
        }
        return result;
    }
}

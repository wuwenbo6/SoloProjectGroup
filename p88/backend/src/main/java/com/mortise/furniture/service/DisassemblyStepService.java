package com.mortise.furniture.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.mortise.furniture.config.DataSourceConfig;
import com.mortise.furniture.entity.DisassemblyStep;
import com.mortise.furniture.repository.DisassemblyStepMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@Service
public class DisassemblyStepService extends ServiceImpl<DisassemblyStepMapper, DisassemblyStep> {

    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();
    private static final long CACHE_TTL_MS = TimeUnit.MINUTES.toMillis(10);

    private static class CacheEntry {
        Object data;
        long timestamp;

        CacheEntry(Object data) {
            this.data = data;
            this.timestamp = System.currentTimeMillis();
        }

        boolean isValid() {
            return System.currentTimeMillis() - timestamp < CACHE_TTL_MS;
        }
    }

    public List<DisassemblyStep> getByFurnitureId(Long furnitureId) {
        String cacheKey = "disassembly:" + furnitureId;
        CacheEntry entry = cache.get(cacheKey);
        if (entry != null && entry.isValid()) {
            return (List<DisassemblyStep>) entry.data;
        }

        DataSourceConfig.DynamicDataSource.setDataSource("mortise");
        LambdaQueryWrapper<DisassemblyStep> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(DisassemblyStep::getFurnitureId, furnitureId)
               .eq(DisassemblyStep::getDeleted, false)
               .orderByAsc(DisassemblyStep::getStepOrder);
        List<DisassemblyStep> steps = list(wrapper);
        DataSourceConfig.DynamicDataSource.clearDataSource();

        cache.put(cacheKey, new CacheEntry(steps));
        return steps;
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean saveStep(DisassemblyStep step) {
        DataSourceConfig.DynamicDataSource.setDataSource("mortise");
        step.setCreateTime(LocalDateTime.now());
        step.setUpdateTime(LocalDateTime.now());
        step.setDeleted(false);
        boolean result = save(step);
        DataSourceConfig.DynamicDataSource.clearDataSource();

        if (result) {
            clearCache(step.getFurnitureId());
        }
        return result;
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean updateStep(DisassemblyStep step) {
        DataSourceConfig.DynamicDataSource.setDataSource("mortise");
        step.setUpdateTime(LocalDateTime.now());
        boolean result = updateById(step);
        DataSourceConfig.DynamicDataSource.clearDataSource();

        if (result) {
            clearCache(step.getFurnitureId());
        }
        return result;
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean deleteStep(Long id) {
        DisassemblyStep step = getById(id);
        if (step == null) return false;

        DataSourceConfig.DynamicDataSource.setDataSource("mortise");
        LambdaQueryWrapper<DisassemblyStep> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(DisassemblyStep::getId, id)
               .set(DisassemblyStep::getDeleted, true)
               .set(DisassemblyStep::getUpdateTime, LocalDateTime.now());
        boolean result = update(wrapper);
        DataSourceConfig.DynamicDataSource.clearDataSource();

        if (result) {
            clearCache(step.getFurnitureId());
        }
        return result;
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean batchSaveSteps(Long furnitureId, List<DisassemblyStep> steps) {
        DataSourceConfig.DynamicDataSource.setDataSource("mortise");
        try {
            LambdaQueryWrapper<DisassemblyStep> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(DisassemblyStep::getFurnitureId, furnitureId);
            remove(wrapper);

            for (int i = 0; i < steps.size(); i++) {
                DisassemblyStep step = steps.get(i);
                step.setFurnitureId(furnitureId);
                step.setStepOrder(i + 1);
                step.setCreateTime(LocalDateTime.now());
                step.setUpdateTime(LocalDateTime.now());
                step.setDeleted(false);
                save(step);
            }
            clearCache(furnitureId);
            return true;
        } finally {
            DataSourceConfig.DynamicDataSource.clearDataSource();
        }
    }

    public DisassemblyStep getStepById(Long id) {
        DataSourceConfig.DynamicDataSource.setDataSource("mortise");
        DisassemblyStep step = getById(id);
        DataSourceConfig.DynamicDataSource.clearDataSource();
        return step;
    }

    private void clearCache(Long furnitureId) {
        cache.keySet().removeIf(key -> key.contains(":" + furnitureId));
        cache.entrySet().removeIf(entry -> !entry.getValue().isValid());
    }
}

package com.mortise.furniture.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.mortise.furniture.config.DataSourceConfig;
import com.mortise.furniture.entity.MortiseStructure;
import com.mortise.furniture.repository.MortiseStructureMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

@Service
public class MortiseStructureService extends ServiceImpl<MortiseStructureMapper, MortiseStructure> {

    public List<MortiseStructure> listAll() {
        DataSourceConfig.DynamicDataSource.setDataSource("mortise");
        List<MortiseStructure> list = list();
        DataSourceConfig.DynamicDataSource.clearDataSource();
        return list;
    }

    public MortiseStructure getById(Long id) {
        DataSourceConfig.DynamicDataSource.setDataSource("mortise");
        MortiseStructure structure = super.getById(id);
        DataSourceConfig.DynamicDataSource.clearDataSource();
        return structure;
    }

    public List<MortiseStructure> getByFurnitureId(Long furnitureId) {
        DataSourceConfig.DynamicDataSource.setDataSource("mortise");
        LambdaQueryWrapper<MortiseStructure> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(MortiseStructure::getFurnitureId, furnitureId);
        List<MortiseStructure> list = list(wrapper);
        DataSourceConfig.DynamicDataSource.clearDataSource();
        return list;
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean saveStructure(MortiseStructure structure) {
        DataSourceConfig.DynamicDataSource.setDataSource("mortise");
        validateStructure(structure);
        structure.setCreateTime(LocalDateTime.now());
        structure.setUpdateTime(LocalDateTime.now());
        structure.setDeleted(false);
        boolean result = save(structure);
        DataSourceConfig.DynamicDataSource.clearDataSource();
        return result;
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean updateStructure(MortiseStructure structure) {
        DataSourceConfig.DynamicDataSource.setDataSource("mortise");
        validateStructure(structure);
        structure.setUpdateTime(LocalDateTime.now());
        
        LambdaUpdateWrapper<MortiseStructure> wrapper = new LambdaUpdateWrapper<>();
        wrapper.eq(MortiseStructure::getId, structure.getId());
        
        if (structure.getName() != null) {
            wrapper.set(MortiseStructure::getName, structure.getName());
        }
        if (structure.getType() != null) {
            wrapper.set(MortiseStructure::getType, structure.getType());
        }
        if (structure.getParameters() != null) {
            wrapper.set(MortiseStructure::getParameters, structure.getParameters());
        }
        if (structure.getMortiseWidth() != null) {
            wrapper.set(MortiseStructure::getMortiseWidth, structure.getMortiseWidth());
        }
        if (structure.getMortiseHeight() != null) {
            wrapper.set(MortiseStructure::getMortiseHeight, structure.getMortiseHeight());
        }
        if (structure.getMortiseDepth() != null) {
            wrapper.set(MortiseStructure::getMortiseDepth, structure.getMortiseDepth());
        }
        if (structure.getTenonWidth() != null) {
            wrapper.set(MortiseStructure::getTenonWidth, structure.getTenonWidth());
        }
        if (structure.getTenonHeight() != null) {
            wrapper.set(MortiseStructure::getTenonHeight, structure.getTenonHeight());
        }
        if (structure.getTenonDepth() != null) {
            wrapper.set(MortiseStructure::getTenonDepth, structure.getTenonDepth());
        }
        if (structure.getPosition() != null) {
            wrapper.set(MortiseStructure::getPosition, structure.getPosition());
        }
        if (structure.getModelPath() != null) {
            wrapper.set(MortiseStructure::getModelPath, structure.getModelPath());
        }
        wrapper.set(MortiseStructure::getUpdateTime, LocalDateTime.now());
        
        boolean result = update(wrapper);
        DataSourceConfig.DynamicDataSource.clearDataSource();
        return result;
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean deleteStructure(Long id) {
        DataSourceConfig.DynamicDataSource.setDataSource("mortise");
        LambdaUpdateWrapper<MortiseStructure> wrapper = new LambdaUpdateWrapper<>();
        wrapper.eq(MortiseStructure::getId, id)
               .set(MortiseStructure::getDeleted, true)
               .set(MortiseStructure::getUpdateTime, LocalDateTime.now());
        boolean result = update(wrapper);
        DataSourceConfig.DynamicDataSource.clearDataSource();
        return result;
    }

    private void validateStructure(MortiseStructure structure) {
        if (structure == null) {
            throw new IllegalArgumentException("榫卯结构数据不能为空");
        }
        if (structure.getName() == null || structure.getName().trim().isEmpty()) {
            throw new IllegalArgumentException("榫卯名称不能为空");
        }
        if (structure.getFurnitureId() == null) {
            throw new IllegalArgumentException("关联家具ID不能为空");
        }
        if (structure.getMortiseWidth() != null && structure.getMortiseWidth() < 0) {
            throw new IllegalArgumentException("卯宽度不能为负数");
        }
        if (structure.getMortiseHeight() != null && structure.getMortiseHeight() < 0) {
            throw new IllegalArgumentException("卯高度不能为负数");
        }
        if (structure.getMortiseDepth() != null && structure.getMortiseDepth() < 0) {
            throw new IllegalArgumentException("卯深度不能为负数");
        }
        if (structure.getTenonWidth() != null && structure.getTenonWidth() < 0) {
            throw new IllegalArgumentException("榫宽度不能为负数");
        }
        if (structure.getTenonHeight() != null && structure.getTenonHeight() < 0) {
            throw new IllegalArgumentException("榫高度不能为负数");
        }
        if (structure.getTenonDepth() != null && structure.getTenonDepth() < 0) {
            throw new IllegalArgumentException("榫深度不能为负数");
        }
    }
}

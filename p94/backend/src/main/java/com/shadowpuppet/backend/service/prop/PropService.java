package com.shadowpuppet.backend.service.prop;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.shadowpuppet.backend.entity.prop.Prop;
import com.shadowpuppet.backend.mapper.prop.PropMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class PropService {

    @Autowired
    private PropMapper propMapper;

    public Page<Prop> listProps(int page, int size, String category, String keyword) {
        Page<Prop> pageParam = new Page<>(page, size);
        LambdaQueryWrapper<Prop> wrapper = new LambdaQueryWrapper<>();
        
        if (StringUtils.hasText(category)) {
            wrapper.eq(Prop::getCategory, category);
        }
        if (StringUtils.hasText(keyword)) {
            wrapper.like(Prop::getName, keyword).or().like(Prop::getDescription, keyword);
        }
        wrapper.orderByDesc(Prop::getCreatedAt);
        
        return propMapper.selectPage(pageParam, wrapper);
    }

    public Prop getPropById(Long id) {
        return propMapper.selectById(id);
    }

    @Transactional
    public boolean createProp(Prop prop) {
        if (!StringUtils.hasText(prop.getName())) {
            throw new IllegalArgumentException("道具名称不能为空");
        }
        if (!StringUtils.hasText(prop.getCategory())) {
            throw new IllegalArgumentException("道具分类不能为空");
        }
        if (prop.getCollectorId() == null) {
            throw new IllegalArgumentException("采集者ID不能为空");
        }
        
        prop.setCreatedAt(LocalDateTime.now());
        prop.setUpdatedAt(LocalDateTime.now());
        if (prop.getStatus() == null) {
            prop.setStatus(0);
        }
        if (!StringUtils.hasText(prop.getDescription())) {
            prop.setDescription("");
        }
        if (!StringUtils.hasText(prop.getMaterial())) {
            prop.setMaterial("");
        }
        if (!StringUtils.hasText(prop.getSize())) {
            prop.setSize("");
        }
        if (!StringUtils.hasText(prop.getOrigin())) {
            prop.setOrigin("");
        }
        if (!StringUtils.hasText(prop.getImageUrl())) {
            prop.setImageUrl("");
        }
        return propMapper.insert(prop) > 0;
    }

    @Transactional
    public boolean updateProp(Prop prop) {
        Prop existProp = propMapper.selectById(prop.getId());
        if (existProp == null) {
            throw new IllegalArgumentException("道具不存在");
        }
        
        prop.setUpdatedAt(LocalDateTime.now());
        
        if (prop.getName() == null) prop.setName(existProp.getName());
        if (prop.getCategory() == null) prop.setCategory(existProp.getCategory());
        if (prop.getDescription() == null) prop.setDescription(existProp.getDescription());
        if (prop.getImageUrl() == null) prop.setImageUrl(existProp.getImageUrl());
        if (prop.getMaterial() == null) prop.setMaterial(existProp.getMaterial());
        if (prop.getSize() == null) prop.setSize(existProp.getSize());
        if (prop.getOrigin() == null) prop.setOrigin(existProp.getOrigin());
        if (prop.getStatus() == null) prop.setStatus(existProp.getStatus());
        if (prop.getCollectorId() == null) prop.setCollectorId(existProp.getCollectorId());
        
        return propMapper.updateById(prop) > 0;
    }

    @Transactional
    public boolean deleteProp(Long id) {
        return propMapper.deleteById(id) > 0;
    }

    public List<Prop> getPropsByCollector(Long collectorId) {
        LambdaQueryWrapper<Prop> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Prop::getCollectorId, collectorId);
        wrapper.orderByDesc(Prop::getCreatedAt);
        return propMapper.selectList(wrapper);
    }

    public List<Prop> findSimilarProps(Long propId) {
        Prop currentProp = propMapper.selectById(propId);
        if (currentProp == null) {
            return new java.util.ArrayList<>();
        }

        LambdaQueryWrapper<Prop> wrapper = new LambdaQueryWrapper<>();
        wrapper.ne(Prop::getId, propId);
        
        wrapper.and(w -> {
            w.eq(Prop::getCategory, currentProp.getCategory());
            if (currentProp.getMaterial() != null && !currentProp.getMaterial().isEmpty()) {
                w.or().like(Prop::getMaterial, currentProp.getMaterial());
            }
            if (currentProp.getOrigin() != null && !currentProp.getOrigin().isEmpty()) {
                w.or().like(Prop::getOrigin, currentProp.getOrigin());
            }
        });
        
        wrapper.orderByDesc(Prop::getCreatedAt);
        wrapper.last("LIMIT 6");

        return propMapper.selectList(wrapper);
    }
}

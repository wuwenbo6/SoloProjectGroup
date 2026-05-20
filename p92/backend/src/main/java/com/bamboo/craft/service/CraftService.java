package com.bamboo.craft.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.bamboo.craft.entity.craft.Craft;
import com.bamboo.craft.mapper.craft.CraftMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Service
public class CraftService {

    @Autowired
    private CraftMapper craftMapper;

    @Cacheable(value = "crafts", key = "#keyword + '_' + #category + '_' + #pageNum + '_' + #pageSize")
    public Page<Craft> list(String keyword, String category, Integer pageNum, Integer pageSize) {
        Page<Craft> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<Craft> wrapper = new LambdaQueryWrapper<>();
        
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.like(Craft::getTitle, keyword);
        }
        if (category != null && !category.isEmpty()) {
            wrapper.eq(Craft::getCategory, category);
        }
        wrapper.eq(Craft::getStatus, 1);
        wrapper.orderByDesc(Craft::getCreateTime);
        
        return craftMapper.selectPage(page, wrapper);
    }

    @Cacheable(value = "crafts", key = "#id")
    public Craft getById(Long id) {
        Craft craft = craftMapper.selectById(id);
        if (craft != null) {
            craft.setViews(craft.getViews() + 1);
            craftMapper.updateById(craft);
        }
        return craft;
    }

    @CacheEvict(value = "crafts", allEntries = true)
    public boolean save(Craft craft) {
        validateCraft(craft);
        if (craft.getUserId() == null) {
            craft.setUserId(1L);
        }
        if (craft.getArtisanName() == null) {
            craft.setArtisanName("竹编艺人");
        }
        if (craft.getArtisanAvatar() == null) {
            craft.setArtisanAvatar("https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png");
        }
        if (craft.getStatus() == null) {
            craft.setStatus(0);
        }
        if (craft.getViews() == null) {
            craft.setViews(0);
        }
        if (craft.getLikes() == null) {
            craft.setLikes(0);
        }
        if (craft.getComments() == null) {
            craft.setComments(0);
        }
        return craftMapper.insert(craft) > 0;
    }

    @CacheEvict(value = "crafts", allEntries = true)
    public boolean update(Craft craft) {
        validateCraft(craft);
        return craftMapper.updateById(craft) > 0;
    }

    private void validateCraft(Craft craft) {
        if (craft.getTitle() == null || craft.getTitle().trim().isEmpty()) {
            throw new IllegalArgumentException("作品名称不能为空");
        }
        if (craft.getTitle().length() > 200) {
            craft.setTitle(craft.getTitle().substring(0, 200));
        }
        if (craft.getDescription() != null && craft.getDescription().length() > 5000) {
            craft.setDescription(craft.getDescription().substring(0, 5000));
        }
        if (craft.getMaterials() != null && craft.getMaterials().length() > 500) {
            craft.setMaterials(craft.getMaterials().substring(0, 500));
        }
    }

    @CacheEvict(value = "crafts", allEntries = true)
    public boolean delete(Long id) {
        return craftMapper.deleteById(id) > 0;
    }

    @Cacheable(value = "userWorks", key = "#userId + '_' + #pageNum + '_' + #pageSize")
    public Page<Craft> getUserWorks(Long userId, Integer pageNum, Integer pageSize) {
        Page<Craft> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<Craft> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Craft::getUserId, userId);
        wrapper.orderByDesc(Craft::getCreateTime);
        return craftMapper.selectPage(page, wrapper);
    }

    @CacheEvict(value = "crafts", allEntries = true)
    public boolean like(Long id) {
        Craft craft = craftMapper.selectById(id);
        if (craft != null) {
            craft.setLikes(craft.getLikes() + 1);
            return craftMapper.updateById(craft) > 0;
        }
        return false;
    }
}

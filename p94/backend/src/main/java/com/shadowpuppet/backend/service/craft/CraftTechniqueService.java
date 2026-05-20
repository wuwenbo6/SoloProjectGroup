package com.shadowpuppet.backend.service.craft;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.shadowpuppet.backend.entity.craft.CraftTechnique;
import com.shadowpuppet.backend.mapper.craft.CraftTechniqueMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@Service
public class CraftTechniqueService {

    @Autowired
    private CraftTechniqueMapper craftTechniqueMapper;

    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();
    private static final long CACHE_TTL = TimeUnit.MINUTES.toMillis(10);

    private static class CacheEntry {
        Object data;
        long timestamp;

        CacheEntry(Object data) {
            this.data = data;
            this.timestamp = System.currentTimeMillis();
        }

        boolean isExpired() {
            return System.currentTimeMillis() - timestamp > CACHE_TTL;
        }
    }

    @Transactional(readOnly = true)
    public Page<CraftTechnique> listCrafts(int page, int size, String category, String keyword) {
        String cacheKey = "list:" + page + ":" + size + ":" + category + ":" + keyword;
        CacheEntry cached = cache.get(cacheKey);
        if (cached != null && !cached.isExpired()) {
            return (Page<CraftTechnique>) cached.data;
        }

        Page<CraftTechnique> pageParam = new Page<>(page, size);
        LambdaQueryWrapper<CraftTechnique> wrapper = new LambdaQueryWrapper<>();

        wrapper.select(CraftTechnique::getId,
                       CraftTechnique::getTitle,
                       CraftTechnique::getCategory,
                       CraftTechnique::getDifficultyLevel,
                       CraftTechnique::getDuration,
                       CraftTechnique::getViewCount,
                       CraftTechnique::getCreatedAt);

        if (StringUtils.hasText(category)) {
            wrapper.eq(CraftTechnique::getCategory, category);
        }
        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w.like(CraftTechnique::getTitle, keyword).or().like(CraftTechnique::getContent, keyword));
        }
        wrapper.eq(CraftTechnique::getStatus, 1);
        wrapper.orderByDesc(CraftTechnique::getCreatedAt);
        wrapper.last("limit " + (page - 1) * size + ", " + size);

        Page<CraftTechnique> result = craftTechniqueMapper.selectPage(pageParam, wrapper);
        cache.put(cacheKey, new CacheEntry(result));
        return result;
    }

    public CraftTechnique getCraftById(Long id) {
        String cacheKey = "detail:" + id;
        CacheEntry cached = cache.get(cacheKey);
        if (cached != null && !cached.isExpired()) {
            return (CraftTechnique) cached.data;
        }

        CraftTechnique craft = craftTechniqueMapper.selectById(id);
        if (craft != null) {
            craft.setViewCount(craft.getViewCount() == null ? 1 : craft.getViewCount() + 1);
            craftTechniqueMapper.updateById(craft);
            cache.put(cacheKey, new CacheEntry(craft));
        }
        return craft;
    }

    @Transactional
    public boolean createCraft(CraftTechnique craft) {
        craft.setCreatedAt(LocalDateTime.now());
        craft.setUpdatedAt(LocalDateTime.now());
        craft.setViewCount(0);
        if (craft.getStatus() == null) {
            craft.setStatus(0);
        }
        boolean result = craftTechniqueMapper.insert(craft) > 0;
        if (result) {
            cache.clear();
        }
        return result;
    }

    @Transactional
    public boolean updateCraft(CraftTechnique craft) {
        craft.setUpdatedAt(LocalDateTime.now());
        boolean result = craftTechniqueMapper.updateById(craft) > 0;
        if (result) {
            cache.clear();
        }
        return result;
    }

    @Transactional
    public boolean deleteCraft(Long id) {
        boolean result = craftTechniqueMapper.deleteById(id) > 0;
        if (result) {
            cache.clear();
        }
        return result;
    }

    @Transactional(readOnly = true)
    public List<CraftTechnique> getCraftsByAuthor(Long authorId) {
        LambdaQueryWrapper<CraftTechnique> wrapper = new LambdaQueryWrapper<>();
        wrapper.select(CraftTechnique::getId,
                       CraftTechnique::getTitle,
                       CraftTechnique::getCategory,
                       CraftTechnique::getCreatedAt);
        wrapper.eq(CraftTechnique::getAuthorId, authorId);
        wrapper.orderByDesc(CraftTechnique::getCreatedAt);
        return craftTechniqueMapper.selectList(wrapper);
    }
}

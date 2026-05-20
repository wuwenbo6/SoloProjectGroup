package com.mortise.furniture.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.mortise.furniture.config.DataSourceConfig;
import com.mortise.furniture.dto.CraftDTO;
import com.mortise.furniture.entity.CraftInstruction;
import com.mortise.furniture.repository.CraftInstructionMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@Service
public class CraftInstructionService extends ServiceImpl<CraftInstructionMapper, CraftInstruction> {

    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();
    private static final long CACHE_TTL_MS = TimeUnit.MINUTES.toMillis(5);

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

    public List<CraftInstruction> listAll() {
        String cacheKey = "craft:all";
        CacheEntry entry = cache.get(cacheKey);
        if (entry != null && entry.isValid()) {
            return (List<CraftInstruction>) entry.data;
        }

        DataSourceConfig.DynamicDataSource.setDataSource("craft");
        List<CraftInstruction> list = list();
        DataSourceConfig.DynamicDataSource.clearDataSource();

        cache.put(cacheKey, new CacheEntry(list));
        return list;
    }

    public CraftInstruction getById(Long id) {
        String cacheKey = "craft:" + id;
        CacheEntry entry = cache.get(cacheKey);
        if (entry != null && entry.isValid()) {
            return (CraftInstruction) entry.data;
        }

        DataSourceConfig.DynamicDataSource.setDataSource("craft");
        CraftInstruction instruction = super.getById(id);
        DataSourceConfig.DynamicDataSource.clearDataSource();

        if (instruction != null) {
            cache.put(cacheKey, new CacheEntry(instruction));
        }
        return instruction;
    }

    public List<CraftDTO> getByFurnitureIdSimple(Long furnitureId) {
        String cacheKey = "craft:furniture:simple:" + furnitureId;
        CacheEntry entry = cache.get(cacheKey);
        if (entry != null && entry.isValid()) {
            return (List<CraftDTO>) entry.data;
        }

        DataSourceConfig.DynamicDataSource.setDataSource("craft");
        LambdaQueryWrapper<CraftInstruction> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(CraftInstruction::getFurnitureId, furnitureId)
               .eq(CraftInstruction::getDeleted, false)
               .orderByDesc(CraftInstruction::getCreateTime)
               .select(CraftInstruction::getId,
                       CraftInstruction::getTitle,
                       CraftInstruction::getDifficulty,
                       CraftInstruction::getEstimatedTime,
                       CraftInstruction::getTools,
                       CraftInstruction::getCreateTime);

        List<CraftInstruction> entities = list(wrapper);
        List<CraftDTO> result = entities.stream().map(this::toSimpleDTO).toList();
        DataSourceConfig.DynamicDataSource.clearDataSource();

        cache.put(cacheKey, new CacheEntry(result));
        return result;
    }

    public IPage<CraftDTO> getByFurnitureIdPage(Long furnitureId, int page, int pageSize) {
        DataSourceConfig.DynamicDataSource.setDataSource("craft");
        LambdaQueryWrapper<CraftInstruction> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(CraftInstruction::getFurnitureId, furnitureId)
               .eq(CraftInstruction::getDeleted, false)
               .orderByDesc(CraftInstruction::getCreateTime);

        Page<CraftInstruction> pageRequest = new Page<>(page, pageSize);
        IPage<CraftInstruction> entityPage = page(pageRequest, wrapper);

        IPage<CraftDTO> dtoPage = entityPage.convert(this::toDTO);
        DataSourceConfig.DynamicDataSource.clearDataSource();
        return dtoPage;
    }

    public List<CraftInstruction> getByFurnitureId(Long furnitureId) {
        return getByFurnitureId(furnitureId, false);
    }

    public List<CraftInstruction> getByFurnitureId(Long furnitureId, boolean includeContent, String lang) {
        String cacheKey = "craft:furniture:" + furnitureId + ":" + includeContent + ":" + lang;
        CacheEntry entry = cache.get(cacheKey);
        if (entry != null && entry.isValid()) {
            return (List<CraftInstruction>) entry.data;
        }

        DataSourceConfig.DynamicDataSource.setDataSource("craft");
        LambdaQueryWrapper<CraftInstruction> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(CraftInstruction::getFurnitureId, furnitureId)
               .eq(CraftInstruction::getDeleted, false)
               .orderByDesc(CraftInstruction::getCreateTime);

        if (!includeContent) {
            wrapper.select(CraftInstruction::getId,
                    CraftInstruction::getTitle,
                    CraftInstruction::getDifficulty,
                    CraftInstruction::getEstimatedTime,
                    CraftInstruction::getTools,
                    CraftInstruction::getMaterials,
                    CraftInstruction::getCreateTime,
                    CraftInstruction::getTitleEn,
                    CraftInstruction::getTitleJa);
        }

        List<CraftInstruction> list = list(wrapper);

        if (lang != null && !"zh".equals(lang)) {
            list.forEach(item -> applyLanguage(item, lang));
        }

        DataSourceConfig.DynamicDataSource.clearDataSource();

        cache.put(cacheKey, new CacheEntry(list));
        return list;
    }

    private void applyLanguage(CraftInstruction item, String lang) {
        switch (lang) {
            case "en":
                if (item.getTitleEn() != null) {
                    item.setTitle(item.getTitleEn());
                }
                if (item.getContentEn() != null) {
                    item.setContent(item.getContentEn());
                }
                if (item.getStepsEn() != null) {
                    item.setSteps(item.getStepsEn());
                }
                break;
            case "ja":
                if (item.getTitleJa() != null) {
                    item.setTitle(item.getTitleJa());
                }
                if (item.getContentJa() != null) {
                    item.setContent(item.getContentJa());
                }
                if (item.getStepsJa() != null) {
                    item.setSteps(item.getStepsJa());
                }
                break;
        }
    }

    public List<CraftInstruction> getByMortiseId(Long mortiseId) {
        DataSourceConfig.DynamicDataSource.setDataSource("craft");
        LambdaQueryWrapper<CraftInstruction> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(CraftInstruction::getMortiseId, mortiseId)
               .eq(CraftInstruction::getDeleted, false)
               .orderByDesc(CraftInstruction::getCreateTime)
               .select(CraftInstruction::getId,
                       CraftInstruction::getTitle,
                       CraftInstruction::getDifficulty,
                       CraftInstruction::getEstimatedTime);
        List<CraftInstruction> list = list(wrapper);
        DataSourceConfig.DynamicDataSource.clearDataSource();
        return list;
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean saveInstruction(CraftInstruction instruction) {
        DataSourceConfig.DynamicDataSource.setDataSource("craft");
        instruction.setCreateTime(LocalDateTime.now());
        instruction.setUpdateTime(LocalDateTime.now());
        instruction.setDeleted(false);
        boolean result = save(instruction);
        DataSourceConfig.DynamicDataSource.clearDataSource();

        if (result) {
            clearCache(instruction.getFurnitureId());
        }
        return result;
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean updateInstruction(CraftInstruction instruction) {
        DataSourceConfig.DynamicDataSource.setDataSource("craft");
        instruction.setUpdateTime(LocalDateTime.now());
        boolean result = updateById(instruction);
        DataSourceConfig.DynamicDataSource.clearDataSource();

        if (result) {
            clearCache(instruction.getFurnitureId());
        }
        return result;
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean deleteInstruction(Long id) {
        CraftInstruction instruction = getById(id);
        if (instruction == null) {
            return false;
        }

        DataSourceConfig.DynamicDataSource.setDataSource("craft");
        LambdaQueryWrapper<CraftInstruction> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(CraftInstruction::getId, id)
               .set(CraftInstruction::getDeleted, true)
               .set(CraftInstruction::getUpdateTime, LocalDateTime.now());
        boolean result = update(wrapper);
        DataSourceConfig.DynamicDataSource.clearDataSource();

        if (result) {
            clearCache(instruction.getFurnitureId());
        }
        return result;
    }

    private CraftDTO toSimpleDTO(CraftInstruction entity) {
        CraftDTO dto = new CraftDTO();
        dto.setId(entity.getId());
        dto.setTitle(entity.getTitle());
        dto.setDifficulty(entity.getDifficulty());
        dto.setEstimatedTime(entity.getEstimatedTime());
        dto.setTools(entity.getTools());
        dto.setCreateTime(entity.getCreateTime());
        return dto;
    }

    private CraftDTO toDTO(CraftInstruction entity) {
        CraftDTO dto = new CraftDTO();
        dto.setId(entity.getId());
        dto.setFurnitureId(entity.getFurnitureId());
        dto.setMortiseId(entity.getMortiseId());
        dto.setTitle(entity.getTitle());
        dto.setContent(entity.getContent());
        dto.setSteps(entity.getSteps());
        dto.setDifficulty(entity.getDifficulty());
        dto.setEstimatedTime(entity.getEstimatedTime());
        dto.setTools(entity.getTools());
        dto.setMaterials(entity.getMaterials());
        dto.setCreateTime(entity.getCreateTime());
        dto.setUpdateTime(entity.getUpdateTime());
        return dto;
    }

    private void clearCache(Long furnitureId) {
        cache.keySet().removeIf(key -> key.contains(":" + furnitureId) || key.contains("craft:all"));
        cache.entrySet().removeIf(entry -> !entry.getValue().isValid());
    }
}

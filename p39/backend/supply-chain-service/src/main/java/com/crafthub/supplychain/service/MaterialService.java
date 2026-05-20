package com.crafthub.supplychain.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.crafthub.common.result.Result;
import com.crafthub.supplychain.dto.MaterialSelectionDTO;
import com.crafthub.supplychain.entity.*;
import com.crafthub.supplychain.mapper.*;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MaterialService extends ServiceImpl<MaterialMapper, Material> {

    private static final Logger log = LoggerFactory.getLogger(MaterialService.class);

    private final MaterialCategoryMapper categoryMapper;
    private final MaterialSpecMapper specMapper;
    private final MaterialAttributeMapper attributeMapper;
    private final UserMaterialSelectionMapper selectionMapper;

    public Result<List<MaterialCategory>> getCategoryTree() {
        List<MaterialCategory> allCategories = categoryMapper.selectList(
            new LambdaQueryWrapper<MaterialCategory>()
                .eq(MaterialCategory::getStatus, 1)
                .orderByAsc(MaterialCategory::getSortOrder)
        );

        List<MaterialCategory> rootCategories = allCategories.stream()
            .filter(c -> c.getParentId() == 0)
            .collect(Collectors.toList());

        for (MaterialCategory root : rootCategories) {
            List<MaterialCategory> children = allCategories.stream()
                .filter(c -> c.getParentId().equals(root.getId()))
                .collect(Collectors.toList());
            root.setChildren(children);
        }

        return Result.success(rootCategories);
    }

    public Result<Page<Material>> getMaterialsByCategory(Long categoryId, Integer page, Integer size) {
        Page<Material> pageParam = new Page<>(page, size);
        Page<Material> result = page(pageParam,
            new LambdaQueryWrapper<Material>()
                .eq(categoryId != null && categoryId > 0, Material::getCategoryId, categoryId)
                .eq(Material::getStatus, 1)
                .orderByDesc(Material::getUsageCount)
                .orderByDesc(Material::getRating)
        );

        for (Material material : result.getRecords()) {
            List<MaterialSpec> specs = specMapper.selectList(
                new LambdaQueryWrapper<MaterialSpec>()
                    .eq(MaterialSpec::getMaterialId, material.getId())
                    .eq(MaterialSpec::getStatus, 1)
                    .orderByAsc(MaterialSpec::getSortOrder)
            );
            material.setSpecs(specs);

            List<MaterialAttribute> attributes = attributeMapper.selectList(
                new LambdaQueryWrapper<MaterialAttribute>()
                    .eq(MaterialAttribute::getMaterialId, material.getId())
                    .orderByAsc(MaterialAttribute::getSortOrder)
            );
            material.setAttributes(attributes);
        }

        return Result.success(result);
    }

    public Result<Material> getMaterialDetail(Long id) {
        Material material = getById(id);
        if (material == null) {
            return Result.error("材质不存在");
        }

        material.setViewCount(material.getViewCount() + 1);
        updateById(material);

        List<MaterialSpec> specs = specMapper.selectList(
            new LambdaQueryWrapper<MaterialSpec>()
                .eq(MaterialSpec::getMaterialId, id)
                .eq(MaterialSpec::getStatus, 1)
                .orderByAsc(MaterialSpec::getSortOrder)
        );
        material.setSpecs(specs);

        List<MaterialAttribute> attributes = attributeMapper.selectList(
            new LambdaQueryWrapper<MaterialAttribute>()
                .eq(MaterialAttribute::getMaterialId, id)
                .orderByAsc(MaterialAttribute::getSortOrder)
        );
        material.setAttributes(attributes);

        return Result.success(material);
    }

    @Transactional(rollbackFor = Exception.class)
    public Result<UserMaterialSelection> selectMaterial(MaterialSelectionDTO dto, Long userId) {
        log.info("用户选择材质, userId: {}, materialId: {}", userId, dto.getMaterialId());

        Material material = getById(dto.getMaterialId());
        if (material == null || material.getStatus() != 1) {
            return Result.error("材质不存在或已下架");
        }

        if (material.getStock() < dto.getQuantity()) {
            return Result.error("库存不足");
        }

        BigDecimal unitPrice = material.getPrice();
        if (dto.getSpecId() != null) {
            MaterialSpec spec = specMapper.selectById(dto.getSpecId());
            if (spec != null) {
                unitPrice = unitPrice.add(spec.getPriceAdjust());
            }
        }

        BigDecimal totalPrice = unitPrice.multiply(BigDecimal.valueOf(dto.getQuantity()));

        UserMaterialSelection selection = new UserMaterialSelection();
        selection.setUserId(userId);
        selection.setRequirementId(dto.getRequirementId());
        selection.setMaterialId(dto.getMaterialId());
        selection.setSpecId(dto.getSpecId());
        selection.setQuantity(dto.getQuantity());
        selection.setUnitPrice(unitPrice);
        selection.setTotalPrice(totalPrice);
        selection.setCustomizationNotes(dto.getCustomizationNotes());
        selection.setStatus(1);

        selectionMapper.insert(selection);

        material.setUsageCount(material.getUsageCount() + 1);
        updateById(material);

        return Result.success("材质选择成功", selection);
    }

    public Result<List<UserMaterialSelection>> getUserSelections(Long userId, Long requirementId) {
        List<UserMaterialSelection> selections = selectionMapper.selectList(
            new LambdaQueryWrapper<UserMaterialSelection>()
                .eq(UserMaterialSelection::getUserId, userId)
                .eq(requirementId != null, UserMaterialSelection::getRequirementId, requirementId)
                .orderByDesc(UserMaterialSelection::getCreateTime)
        );
        return Result.success(selections);
    }

    @Transactional(rollbackFor = Exception.class)
    public Result<Void> cancelSelection(Long selectionId, Long userId) {
        UserMaterialSelection selection = selectionMapper.selectById(selectionId);
        if (selection == null) {
            return Result.error("选择记录不存在");
        }
        if (!selection.getUserId().equals(userId)) {
            return Result.error("无权操作");
        }

        selection.setStatus(3);
        selectionMapper.updateById(selection);
        return Result.success();
    }

    public Result<List<Material>> getRecommendedMaterials(Integer limit) {
        List<Material> materials = list(
            new LambdaQueryWrapper<Material>()
                .eq(Material::getStatus, 1)
                .orderByDesc(Material::getUsageCount)
                .orderByDesc(Material::getRating)
                .last("limit " + (limit != null ? limit : 10))
        );
        return Result.success(materials);
    }

    public Result<List<Material>> searchMaterials(String keyword, Long categoryId, Integer page, Integer size) {
        Page<Material> pageParam = new Page<>(page, size);
        Page<Material> result = page(pageParam,
            new LambdaQueryWrapper<Material>()
                .eq(categoryId != null && categoryId > 0, Material::getCategoryId, categoryId)
                .and(keyword != null && !keyword.isEmpty(), w -> w
                    .like(Material::getName, keyword)
                    .or()
                    .like(Material::getDescription, keyword)
                    .or()
                    .like(Material::getOrigin, keyword)
                )
                .eq(Material::getStatus, 1)
                .orderByDesc(Material::getUsageCount)
        );
        return Result.success(result.getRecords());
    }
}

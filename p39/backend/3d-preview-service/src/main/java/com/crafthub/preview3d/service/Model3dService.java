package com.crafthub.preview3d.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.crafthub.common.result.Result;
import com.crafthub.preview3d.dto.CustomSolutionDTO;
import com.crafthub.preview3d.entity.Custom3dSolution;
import com.crafthub.preview3d.entity.Model3d;
import com.crafthub.preview3d.mapper.Custom3dSolutionMapper;
import com.crafthub.preview3d.mapper.Model3dMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class Model3dService extends ServiceImpl<Model3dMapper, Model3d> {

    private static final Logger log = LoggerFactory.getLogger(Model3dService.class);

    private final Custom3dSolutionMapper solutionMapper;

    public Result<Page<Model3d>> getModelsByCategory(Long categoryId, Integer page, Integer size) {
        Page<Model3d> pageParam = new Page<>(page, size);
        Page<Model3d> result = page(pageParam,
            new LambdaQueryWrapper<Model3d>()
                .eq(categoryId != null && categoryId > 0, Model3d::getCategoryId, categoryId)
                .eq(Model3d::getStatus, 1)
                .orderByDesc(Model3d::getUsageCount)
                .orderByDesc(Model3d::getViewCount)
        );
        return Result.success(result);
    }

    public Result<Model3d> getModelDetail(Long id) {
        Model3d model = getById(id);
        if (model == null || model.getStatus() != 1) {
            return Result.error("模型不存在或已下架");
        }

        model.setViewCount(model.getViewCount() + 1);
        updateById(model);

        return Result.success(model);
    }

    @Transactional(rollbackFor = Exception.class)
    public Result<Custom3dSolution> createCustomSolution(CustomSolutionDTO dto, Long userId) {
        log.info("创建3D定制方案, userId: {}, modelId: {}", userId, dto.getBaseModelId());

        Model3d model = getById(dto.getBaseModelId());
        if (model == null || model.getStatus() != 1) {
            return Result.error("基础模型不存在或已下架");
        }

        Custom3dSolution solution = new Custom3dSolution();
        solution.setUserId(userId);
        solution.setRequirementId(dto.getRequirementId());
        solution.setBaseModelId(dto.getBaseModelId());
        solution.setName(dto.getName());
        solution.setDescription(dto.getDescription());
        solution.setMaterialSelections(dto.getMaterialSelections());
        solution.setColorConfig(dto.getColorConfig());
        solution.setSizeConfig(dto.getSizeConfig());
        solution.setCustomParams(dto.getCustomParams());
        solution.setPreviewImage(dto.getPreviewImage());
        solution.setStatus(1);

        solutionMapper.insert(solution);

        model.setUsageCount(model.getUsageCount() + 1);
        updateById(model);

        return Result.success("方案创建成功", solution);
    }

    @Transactional(rollbackFor = Exception.class)
    public Result<Custom3dSolution> updateCustomSolution(Long solutionId, CustomSolutionDTO dto, Long userId) {
        Custom3dSolution solution = solutionMapper.selectById(solutionId);
        if (solution == null) {
            return Result.error("方案不存在");
        }
        if (!solution.getUserId().equals(userId)) {
            return Result.error("无权修改此方案");
        }

        if (dto.getName() != null) solution.setName(dto.getName());
        if (dto.getDescription() != null) solution.setDescription(dto.getDescription());
        if (dto.getMaterialSelections() != null) solution.setMaterialSelections(dto.getMaterialSelections());
        if (dto.getColorConfig() != null) solution.setColorConfig(dto.getColorConfig());
        if (dto.getSizeConfig() != null) solution.setSizeConfig(dto.getSizeConfig());
        if (dto.getCustomParams() != null) solution.setCustomParams(dto.getCustomParams());
        if (dto.getPreviewImage() != null) solution.setPreviewImage(dto.getPreviewImage());

        solutionMapper.updateById(solution);
        return Result.success("方案更新成功", solution);
    }

    public Result<List<Custom3dSolution>> getUserSolutions(Long userId, Long requirementId) {
        List<Custom3dSolution> solutions = solutionMapper.selectList(
            new LambdaQueryWrapper<Custom3dSolution>()
                .eq(Custom3dSolution::getUserId, userId)
                .eq(requirementId != null, Custom3dSolution::getRequirementId, requirementId)
                .orderByDesc(Custom3dSolution::getCreateTime)
        );

        for (Custom3dSolution solution : solutions) {
            Model3d model = getById(solution.getBaseModelId());
            if (model != null) {
                solution.setModelName(model.getName());
                solution.setModelThumbnail(model.getThumbnailUrl());
            }
        }

        return Result.success(solutions);
    }

    public Result<Custom3dSolution> getSolutionDetail(Long solutionId, Long userId) {
        Custom3dSolution solution = solutionMapper.selectById(solutionId);
        if (solution == null) {
            return Result.error("方案不存在");
        }
        if (!solution.getUserId().equals(userId)) {
            return Result.error("无权查看此方案");
        }

        Model3d model = getById(solution.getBaseModelId());
        if (model != null) {
            solution.setModelName(model.getName());
            solution.setModelThumbnail(model.getThumbnailUrl());
        }

        return Result.success(solution);
    }

    @Transactional(rollbackFor = Exception.class)
    public Result<Void> confirmSolution(Long solutionId, Long userId) {
        Custom3dSolution solution = solutionMapper.selectById(solutionId);
        if (solution == null) {
            return Result.error("方案不存在");
        }
        if (!solution.getUserId().equals(userId)) {
            return Result.error("无权操作此方案");
        }

        solution.setStatus(2);
        solutionMapper.updateById(solution);
        return Result.success("方案已确认");
    }

    @Transactional(rollbackFor = Exception.class)
    public Result<Void> deleteSolution(Long solutionId, Long userId) {
        Custom3dSolution solution = solutionMapper.selectById(solutionId);
        if (solution == null) {
            return Result.error("方案不存在");
        }
        if (!solution.getUserId().equals(userId)) {
            return Result.error("无权删除此方案");
        }

        solutionMapper.deleteById(solutionId);
        return Result.success("方案已删除");
    }

    public Result<List<Model3d>> getRecommendedModels(Integer limit) {
        List<Model3d> models = list(
            new LambdaQueryWrapper<Model3d>()
                .eq(Model3d::getStatus, 1)
                .orderByDesc(Model3d::getUsageCount)
                .orderByDesc(Model3d::getViewCount)
                .last("limit " + (limit != null ? limit : 10))
        );
        return Result.success(models);
    }

    public Result<List<Model3d>> searchModels(String keyword, Long categoryId, Integer page, Integer size) {
        Page<Model3d> pageParam = new Page<>(page, size);
        Page<Model3d> result = page(pageParam,
            new LambdaQueryWrapper<Model3d>()
                .eq(categoryId != null && categoryId > 0, Model3d::getCategoryId, categoryId)
                .and(keyword != null && !keyword.isEmpty(), w -> w
                    .like(Model3d::getName, keyword)
                    .or()
                    .like(Model3d::getDescription, keyword)
                )
                .eq(Model3d::getStatus, 1)
                .orderByDesc(Model3d::getUsageCount)
        );
        return Result.success(result.getRecords());
    }
}

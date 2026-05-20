package com.crafthub.preview3d.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.crafthub.common.result.Result;
import com.crafthub.preview3d.dto.CustomSolutionDTO;
import com.crafthub.preview3d.entity.Custom3dSolution;
import com.crafthub.preview3d.entity.Model3d;
import com.crafthub.preview3d.service.Model3dService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/model3d")
@RequiredArgsConstructor
public class Model3dController {

    private final Model3dService model3dService;

    @GetMapping("/list")
    public Result<Page<Model3d>> getModelsByCategory(
            @RequestParam(required = false) Long categoryId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "20") Integer size) {
        return model3dService.getModelsByCategory(categoryId, page, size);
    }

    @GetMapping("/{id}")
    public Result<Model3d> getModelDetail(@PathVariable Long id) {
        return model3dService.getModelDetail(id);
    }

    @GetMapping("/recommended")
    public Result<List<Model3d>> getRecommendedModels(
            @RequestParam(defaultValue = "10") Integer limit) {
        return model3dService.getRecommendedModels(limit);
    }

    @GetMapping("/search")
    public Result<List<Model3d>> searchModels(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "20") Integer size) {
        return model3dService.searchModels(keyword, categoryId, page, size);
    }

    @PostMapping("/solution")
    public Result<Custom3dSolution> createCustomSolution(
            @RequestBody CustomSolutionDTO dto,
            @RequestHeader(required = false) Long userId) {
        if (userId == null) {
            userId = 1L;
        }
        return model3dService.createCustomSolution(dto, userId);
    }

    @PutMapping("/solution/{id}")
    public Result<Custom3dSolution> updateCustomSolution(
            @PathVariable Long id,
            @RequestBody CustomSolutionDTO dto,
            @RequestHeader(required = false) Long userId) {
        if (userId == null) {
            userId = 1L;
        }
        return model3dService.updateCustomSolution(id, dto, userId);
    }

    @GetMapping("/solution/list")
    public Result<List<Custom3dSolution>> getUserSolutions(
            @RequestParam(required = false) Long requirementId,
            @RequestHeader(required = false) Long userId) {
        if (userId == null) {
            userId = 1L;
        }
        return model3dService.getUserSolutions(userId, requirementId);
    }

    @GetMapping("/solution/{id}")
    public Result<Custom3dSolution> getSolutionDetail(
            @PathVariable Long id,
            @RequestHeader(required = false) Long userId) {
        if (userId == null) {
            userId = 1L;
        }
        return model3dService.getSolutionDetail(id, userId);
    }

    @PostMapping("/solution/{id}/confirm")
    public Result<Void> confirmSolution(
            @PathVariable Long id,
            @RequestHeader(required = false) Long userId) {
        if (userId == null) {
            userId = 1L;
        }
        return model3dService.confirmSolution(id, userId);
    }

    @DeleteMapping("/solution/{id}")
    public Result<Void> deleteSolution(
            @PathVariable Long id,
            @RequestHeader(required = false) Long userId) {
        if (userId == null) {
            userId = 1L;
        }
        return model3dService.deleteSolution(id, userId);
    }
}

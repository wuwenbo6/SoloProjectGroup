package com.crafthub.supplychain.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.crafthub.common.result.Result;
import com.crafthub.supplychain.dto.MaterialSelectionDTO;
import com.crafthub.supplychain.entity.Material;
import com.crafthub.supplychain.entity.MaterialCategory;
import com.crafthub.supplychain.entity.UserMaterialSelection;
import com.crafthub.supplychain.service.MaterialService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/material")
@RequiredArgsConstructor
public class MaterialController {

    private final MaterialService materialService;

    @GetMapping("/categories")
    public Result<List<MaterialCategory>> getCategoryTree() {
        return materialService.getCategoryTree();
    }

    @GetMapping("/list")
    public Result<Page<Material>> getMaterialsByCategory(
            @RequestParam(required = false) Long categoryId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "20") Integer size) {
        return materialService.getMaterialsByCategory(categoryId, page, size);
    }

    @GetMapping("/{id}")
    public Result<Material> getMaterialDetail(@PathVariable Long id) {
        return materialService.getMaterialDetail(id);
    }

    @PostMapping("/select")
    public Result<UserMaterialSelection> selectMaterial(
            @RequestBody MaterialSelectionDTO dto,
            @RequestHeader(required = false) Long userId) {
        if (userId == null) {
            userId = 1L;
        }
        return materialService.selectMaterial(dto, userId);
    }

    @GetMapping("/selections")
    public Result<List<UserMaterialSelection>> getUserSelections(
            @RequestParam(required = false) Long requirementId,
            @RequestHeader(required = false) Long userId) {
        if (userId == null) {
            userId = 1L;
        }
        return materialService.getUserSelections(userId, requirementId);
    }

    @DeleteMapping("/selection/{id}")
    public Result<Void> cancelSelection(
            @PathVariable Long id,
            @RequestHeader(required = false) Long userId) {
        if (userId == null) {
            userId = 1L;
        }
        return materialService.cancelSelection(id, userId);
    }

    @GetMapping("/recommended")
    public Result<List<Material>> getRecommendedMaterials(
            @RequestParam(defaultValue = "10") Integer limit) {
        return materialService.getRecommendedMaterials(limit);
    }

    @GetMapping("/search")
    public Result<List<Material>> searchMaterials(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "20") Integer size) {
        return materialService.searchMaterials(keyword, categoryId, page, size);
    }
}

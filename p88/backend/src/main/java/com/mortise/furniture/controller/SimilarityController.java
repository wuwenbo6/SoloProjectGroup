package com.mortise.furniture.controller;

import com.mortise.furniture.dto.Result;
import com.mortise.furniture.dto.SimilarFurnitureDTO;
import com.mortise.furniture.entity.ModelFeature;
import com.mortise.furniture.service.ModelSimilarityService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/similarity")
public class SimilarityController {

    @Autowired
    private ModelSimilarityService modelSimilarityService;

    @GetMapping("/furniture/{furnitureId}")
    public Result<List<SimilarFurnitureDTO>> findSimilarFurniture(
            @PathVariable Long furnitureId,
            @RequestParam(defaultValue = "10") Integer topN) {
        return Result.success(modelSimilarityService.findSimilarFurniture(furnitureId, topN));
    }

    @PostMapping("/extract/{furnitureId}")
    public Result<ModelFeature> extractFeatures(@PathVariable Long furnitureId) {
        return Result.success(modelSimilarityService.extractFeatures(furnitureId));
    }

    @GetMapping("/feature/{furnitureId}")
    public Result<ModelFeature> getFeatures(@PathVariable Long furnitureId) {
        return Result.success(modelSimilarityService.extractOrGetFeatures(furnitureId));
    }

    @PostMapping("/clear-cache")
    public Result<Boolean> clearCache() {
        modelSimilarityService.clearCache();
        return Result.success(true);
    }
}

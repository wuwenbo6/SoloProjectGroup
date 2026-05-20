package com.shadowpuppet.backend.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.shadowpuppet.backend.entity.craft.CraftTechnique;
import com.shadowpuppet.backend.service.craft.CraftTechniqueService;
import com.shadowpuppet.backend.util.Result;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/crafts")
public class CraftTechniqueController {

    @Autowired
    private CraftTechniqueService craftTechniqueService;

    @GetMapping
    public Result<Page<CraftTechnique>> listCrafts(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String keyword) {
        return Result.success(craftTechniqueService.listCrafts(page, size, category, keyword));
    }

    @GetMapping("/{id}")
    public Result<CraftTechnique> getCraftById(@PathVariable Long id) {
        CraftTechnique craft = craftTechniqueService.getCraftById(id);
        if (craft == null) {
            return Result.error("工艺说明不存在");
        }
        return Result.success(craft);
    }

    @PostMapping
    public Result<Void> createCraft(@RequestBody CraftTechnique craft) {
        boolean success = craftTechniqueService.createCraft(craft);
        return success ? Result.success() : Result.error("创建失败");
    }

    @PutMapping("/{id}")
    public Result<Void> updateCraft(@PathVariable Long id, @RequestBody CraftTechnique craft) {
        craft.setId(id);
        boolean success = craftTechniqueService.updateCraft(craft);
        return success ? Result.success() : Result.error("更新失败");
    }

    @DeleteMapping("/{id}")
    public Result<Void> deleteCraft(@PathVariable Long id) {
        boolean success = craftTechniqueService.deleteCraft(id);
        return success ? Result.success() : Result.error("删除失败");
    }

    @GetMapping("/author/{authorId}")
    public Result<List<CraftTechnique>> getCraftsByAuthor(@PathVariable Long authorId) {
        return Result.success(craftTechniqueService.getCraftsByAuthor(authorId));
    }
}

package com.shadowpuppet.backend.controller;

import com.shadowpuppet.backend.entity.craft.CraftStep;
import com.shadowpuppet.backend.service.craft.CraftStepService;
import com.shadowpuppet.backend.util.Result;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/craft-steps")
public class CraftStepController {

    @Autowired
    private CraftStepService craftStepService;

    @GetMapping("/craft/{craftId}")
    public Result<List<CraftStep>> getStepsByCraftId(@PathVariable Long craftId) {
        return Result.success(craftStepService.getStepsByCraftId(craftId));
    }

    @PostMapping
    public Result<Void> createStep(@RequestBody CraftStep step) {
        boolean success = craftStepService.createStep(step);
        return success ? Result.success() : Result.error("创建失败");
    }

    @PutMapping("/{id}")
    public Result<Void> updateStep(@PathVariable Long id, @RequestBody CraftStep step) {
        step.setId(id);
        boolean success = craftStepService.updateStep(step);
        return success ? Result.success() : Result.error("更新失败");
    }

    @DeleteMapping("/{id}")
    public Result<Void> deleteStep(@PathVariable Long id) {
        boolean success = craftStepService.deleteStep(id);
        return success ? Result.success() : Result.error("删除失败");
    }

    @PostMapping("/batch/{craftId}")
    public Result<Void> batchSaveSteps(@PathVariable Long craftId, @RequestBody List<CraftStep> steps) {
        boolean success = craftStepService.batchSaveSteps(craftId, steps);
        return success ? Result.success() : Result.error("批量保存失败");
    }
}

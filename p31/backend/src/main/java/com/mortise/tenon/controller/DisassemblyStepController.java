package com.mortise.tenon.controller;

import com.mortise.tenon.common.Result;
import com.mortise.tenon.entity.DisassemblyStep;
import com.mortise.tenon.service.DisassemblyStepService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/step")
@CrossOrigin(origins = "*")
public class DisassemblyStepController {

    @Autowired
    private DisassemblyStepService stepService;

    @GetMapping("/model/{modelId}")
    public Result<List<DisassemblyStep>> getByModelId(@PathVariable Long modelId) {
        return Result.success(stepService.findByModelId(modelId));
    }

    @GetMapping("/model/{modelId}/direction/{isReverse}")
    public Result<List<DisassemblyStep>> getByModelIdAndDirection(
            @PathVariable Long modelId,
            @PathVariable Boolean isReverse) {
        return Result.success(stepService.findByModelIdAndDirection(modelId, isReverse));
    }

    @GetMapping("/{id}")
    public Result<DisassemblyStep> getById(@PathVariable Long id) {
        return stepService.findById(id)
                .map(Result::success)
                .orElse(Result.error("步骤不存在"));
    }

    @PostMapping
    public Result<DisassemblyStep> create(@RequestBody DisassemblyStep step) {
        return Result.success(stepService.save(step));
    }

    @PostMapping("/batch")
    public Result<List<DisassemblyStep>> createBatch(@RequestBody List<DisassemblyStep> steps) {
        return Result.success(stepService.saveAll(steps));
    }

    @PutMapping
    public Result<DisassemblyStep> update(@RequestBody DisassemblyStep step) {
        return Result.success(stepService.save(step));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        stepService.deleteById(id);
        return Result.success();
    }

    @DeleteMapping("/model/{modelId}")
    public Result<Void> deleteByModelId(@PathVariable Long modelId) {
        stepService.deleteByModelId(modelId);
        return Result.success();
    }
}
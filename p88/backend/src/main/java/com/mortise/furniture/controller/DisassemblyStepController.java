package com.mortise.furniture.controller;

import com.mortise.furniture.dto.Result;
import com.mortise.furniture.entity.DisassemblyStep;
import com.mortise.furniture.service.DisassemblyStepService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/disassembly")
public class DisassemblyStepController {

    @Autowired
    private DisassemblyStepService disassemblyStepService;

    @GetMapping("/furniture/{furnitureId}")
    public Result<List<DisassemblyStep>> getByFurnitureId(@PathVariable Long furnitureId) {
        return Result.success(disassemblyStepService.getByFurnitureId(furnitureId));
    }

    @GetMapping("/{id}")
    public Result<DisassemblyStep> getById(@PathVariable Long id) {
        return Result.success(disassemblyStepService.getStepById(id));
    }

    @PostMapping("/save")
    public Result<Boolean> save(@RequestBody DisassemblyStep step) {
        return Result.success(disassemblyStepService.saveStep(step));
    }

    @PostMapping("/batch/{furnitureId}")
    public Result<Boolean> batchSave(@PathVariable Long furnitureId, @RequestBody List<DisassemblyStep> steps) {
        return Result.success(disassemblyStepService.batchSaveSteps(furnitureId, steps));
    }

    @PutMapping("/update")
    public Result<Boolean> update(@RequestBody DisassemblyStep step) {
        return Result.success(disassemblyStepService.updateStep(step));
    }

    @DeleteMapping("/{id}")
    public Result<Boolean> delete(@PathVariable Long id) {
        return Result.success(disassemblyStepService.deleteStep(id));
    }
}

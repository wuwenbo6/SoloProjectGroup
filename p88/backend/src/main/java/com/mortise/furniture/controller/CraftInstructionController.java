package com.mortise.furniture.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.mortise.furniture.dto.CraftDTO;
import com.mortise.furniture.dto.Result;
import com.mortise.furniture.entity.CraftInstruction;
import com.mortise.furniture.service.CraftInstructionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/craft")
public class CraftInstructionController {

    @Autowired
    private CraftInstructionService craftInstructionService;

    @GetMapping("/list")
    public Result<List<CraftInstruction>> list() {
        return Result.success(craftInstructionService.listAll());
    }

    @GetMapping("/{id}")
    public Result<CraftInstruction> getById(@PathVariable Long id) {
        return Result.success(craftInstructionService.getById(id));
    }

    @GetMapping("/furniture/{furnitureId}")
    public Result<List<CraftInstruction>> getByFurnitureId(@PathVariable Long furnitureId,
            @RequestParam(defaultValue = "false") Boolean includeContent,
            @RequestHeader(value = "Accept-Language", defaultValue = "zh") String lang) {
        return Result.success(craftInstructionService.getByFurnitureId(furnitureId, includeContent, lang));
    }

    @GetMapping("/furniture/{furnitureId}/simple")
    public Result<List<CraftDTO>> getByFurnitureIdSimple(@PathVariable Long furnitureId) {
        return Result.success(craftInstructionService.getByFurnitureIdSimple(furnitureId));
    }

    @GetMapping("/furniture/{furnitureId}/page")
    public Result<IPage<CraftDTO>> getByFurnitureIdPage(@PathVariable Long furnitureId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        return Result.success(craftInstructionService.getByFurnitureIdPage(furnitureId, page, pageSize));
    }

    @GetMapping("/mortise/{mortiseId}")
    public Result<List<CraftInstruction>> getByMortiseId(@PathVariable Long mortiseId) {
        return Result.success(craftInstructionService.getByMortiseId(mortiseId));
    }

    @PostMapping("/save")
    public Result<Boolean> save(@RequestBody CraftInstruction instruction) {
        return Result.success(craftInstructionService.saveInstruction(instruction));
    }

    @PutMapping("/update")
    public Result<Boolean> update(@RequestBody CraftInstruction instruction) {
        return Result.success(craftInstructionService.updateInstruction(instruction));
    }

    @DeleteMapping("/{id}")
    public Result<Boolean> delete(@PathVariable Long id) {
        return Result.success(craftInstructionService.deleteInstruction(id));
    }
}

package com.mortise.furniture.controller;

import com.mortise.furniture.dto.Result;
import com.mortise.furniture.entity.MortiseStructure;
import com.mortise.furniture.service.MortiseStructureService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/mortise")
public class MortiseStructureController {

    @Autowired
    private MortiseStructureService mortiseStructureService;

    @GetMapping("/list")
    public Result<List<MortiseStructure>> list() {
        return Result.success(mortiseStructureService.listAll());
    }

    @GetMapping("/{id}")
    public Result<MortiseStructure> getById(@PathVariable Long id) {
        return Result.success(mortiseStructureService.getById(id));
    }

    @GetMapping("/furniture/{furnitureId}")
    public Result<List<MortiseStructure>> getByFurnitureId(@PathVariable Long furnitureId) {
        return Result.success(mortiseStructureService.getByFurnitureId(furnitureId));
    }

    @PostMapping("/save")
    public Result<Boolean> save(@RequestBody MortiseStructure structure) {
        return Result.success(mortiseStructureService.saveStructure(structure));
    }

    @PutMapping("/update")
    public Result<Boolean> update(@RequestBody MortiseStructure structure) {
        return Result.success(mortiseStructureService.updateStructure(structure));
    }

    @DeleteMapping("/{id}")
    public Result<Boolean> delete(@PathVariable Long id) {
        return Result.success(mortiseStructureService.deleteStructure(id));
    }
}

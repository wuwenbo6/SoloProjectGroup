package com.mortise.furniture.controller;

import com.mortise.furniture.dto.Result;
import com.mortise.furniture.entity.Furniture;
import com.mortise.furniture.service.FurnitureService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/furniture")
public class FurnitureController {

    @Autowired
    private FurnitureService furnitureService;

    @GetMapping("/list")
    public Result<List<Furniture>> list() {
        return Result.success(furnitureService.listAll());
    }

    @GetMapping("/{id}")
    public Result<Furniture> getById(@PathVariable Long id) {
        return Result.success(furnitureService.getFurnitureById(id));
    }

    @PostMapping("/save")
    public Result<Boolean> save(@RequestBody Furniture furniture) {
        return Result.success(furnitureService.saveFurniture(furniture));
    }

    @PutMapping("/update")
    public Result<Boolean> update(@RequestBody Furniture furniture) {
        return Result.success(furnitureService.updateFurniture(furniture));
    }

    @DeleteMapping("/{id}")
    public Result<Boolean> delete(@PathVariable Long id) {
        return Result.success(furnitureService.deleteFurniture(id));
    }

    @PostMapping("/upload")
    public Result<String> uploadModel(@RequestParam("file") MultipartFile file) {
        try {
            String path = furnitureService.uploadModel(file);
            return Result.success(path);
        } catch (IOException e) {
            return Result.error("上传失败: " + e.getMessage());
        }
    }

    @GetMapping("/category/{category}")
    public Result<List<Furniture>> searchByCategory(@PathVariable String category) {
        return Result.success(furnitureService.searchByCategory(category));
    }
}

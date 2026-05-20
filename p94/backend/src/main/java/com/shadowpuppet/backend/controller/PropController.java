package com.shadowpuppet.backend.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.shadowpuppet.backend.entity.prop.Prop;
import com.shadowpuppet.backend.service.prop.PropService;
import com.shadowpuppet.backend.util.Result;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/props")
public class PropController {

    @Autowired
    private PropService propService;

    private static final String UPLOAD_DIR = System.getProperty("user.dir") + "/uploads";

    @GetMapping
    public Result<Page<Prop>> listProps(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String keyword) {
        return Result.success(propService.listProps(page, size, category, keyword));
    }

    @GetMapping("/{id}")
    public Result<Prop> getPropById(@PathVariable Long id) {
        Prop prop = propService.getPropById(id);
        if (prop == null) {
            return Result.error("道具不存在");
        }
        return Result.success(prop);
    }

    @PostMapping
    public Result<Void> createProp(@RequestBody Prop prop) {
        boolean success = propService.createProp(prop);
        return success ? Result.success() : Result.error("创建失败");
    }

    @PutMapping("/{id}")
    public Result<Void> updateProp(@PathVariable Long id, @RequestBody Prop prop) {
        prop.setId(id);
        boolean success = propService.updateProp(prop);
        return success ? Result.success() : Result.error("更新失败");
    }

    @DeleteMapping("/{id}")
    public Result<Void> deleteProp(@PathVariable Long id) {
        boolean success = propService.deleteProp(id);
        return success ? Result.success() : Result.error("删除失败");
    }

    @GetMapping("/collector/{collectorId}")
    public Result<List<Prop>> getPropsByCollector(@PathVariable Long collectorId) {
        return Result.success(propService.getPropsByCollector(collectorId));
    }

    @PostMapping("/upload")
    public Result<String> uploadImage(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return Result.error("文件不能为空");
        }

        try {
            Files.createDirectories(Paths.get(UPLOAD_DIR));
            
            String originalFilename = file.getOriginalFilename();
            String extension = originalFilename.substring(originalFilename.lastIndexOf("."));
            String newFilename = UUID.randomUUID().toString() + extension;
            
            Path filePath = Paths.get(UPLOAD_DIR, newFilename);
            file.transferTo(filePath.toFile());
            
            return Result.success("/uploads/" + newFilename);
        } catch (IOException e) {
            return Result.error("文件上传失败: " + e.getMessage());
        }
    }

    @GetMapping("/{id}/similar")
    public Result<List<Prop>> findSimilarProps(@PathVariable Long id) {
        return Result.success(propService.findSimilarProps(id));
    }
}

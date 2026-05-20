package com.heritage.archive.controller;

import com.heritage.common.entity.Archive;
import com.heritage.common.result.Result;
import com.heritage.archive.service.ArchiveService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/archive")
@CrossOrigin
public class ArchiveController {

    @Autowired
    private ArchiveService archiveService;

    @GetMapping
    public Result<List<Archive>> list() {
        try {
            return Result.success(archiveService.list());
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error(500, "查询失败: " + e.getMessage());
        }
    }

    @GetMapping("/{id}")
    public Result<Archive> getById(@PathVariable Long id) {
        try {
            Archive archive = archiveService.getById(id);
            if (archive == null) {
                return Result.error(404, "档案不存在");
            }
            return Result.success(archive);
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error(500, "查询失败: " + e.getMessage());
        }
    }

    @PostMapping
    public Result<Boolean> save(@RequestBody Archive archive) {
        try {
            return Result.success(archiveService.save(archive));
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error(500, "保存失败: " + e.getMessage());
        }
    }

    @PutMapping
    public Result<Boolean> update(@RequestBody Archive archive) {
        try {
            return Result.success(archiveService.updateById(archive));
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error(500, "更新失败: " + e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    public Result<Boolean> delete(@PathVariable Long id) {
        try {
            return Result.success(archiveService.removeById(id));
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error(500, "删除失败: " + e.getMessage());
        }
    }

    @GetMapping("/equipment/{equipmentId}")
    public Result<List<Archive>> getByEquipmentId(@PathVariable Long equipmentId) {
        try {
            return Result.success(archiveService.getByEquipmentId(equipmentId));
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error(500, "查询失败: " + e.getMessage());
        }
    }

    @GetMapping("/type/{archiveType}")
    public Result<List<Archive>> getByType(@PathVariable String archiveType) {
        try {
            return Result.success(archiveService.getByType(archiveType));
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error(500, "查询失败: " + e.getMessage());
        }
    }
}

package com.heritage.database.controller;

import com.heritage.database.common.Result;
import com.heritage.database.entity.HeritageEquipment;
import com.heritage.database.service.HeritageEquipmentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/equipment")
@CrossOrigin(origins = "*")
public class HeritageEquipmentController {
    
    @Autowired
    private HeritageEquipmentService equipmentService;
    
    @GetMapping("/list")
    public Result<List<HeritageEquipment>> listAll() {
        try {
            return Result.success(equipmentService.listAll());
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error("查询失败: " + e.getMessage());
        }
    }
    
    @GetMapping("/category/{category}")
    public Result<List<HeritageEquipment>> listByCategory(@PathVariable String category) {
        try {
            return Result.success(equipmentService.listByCategory(category));
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error("查询失败: " + e.getMessage());
        }
    }
    
    @GetMapping("/search")
    public Result<List<HeritageEquipment>> search(@RequestParam String keyword) {
        try {
            return Result.success(equipmentService.search(keyword));
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error("搜索失败: " + e.getMessage());
        }
    }
    
    @GetMapping("/{id}")
    public Result<HeritageEquipment> getDetail(@PathVariable Long id) {
        try {
            HeritageEquipment equipment = equipmentService.getDetailById(id);
            if (equipment == null) {
                return Result.error(404, "设备不存在");
            }
            return Result.success(equipment);
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error("查询失败: " + e.getMessage());
        }
    }
    
    @PostMapping
    public Result<?> create(@RequestBody HeritageEquipment equipment) {
        try {
            boolean result = equipmentService.saveEquipment(equipment);
            return result ? Result.success() : Result.error("创建失败");
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error("创建失败: " + e.getMessage());
        }
    }
    
    @PutMapping
    public Result<?> update(@RequestBody HeritageEquipment equipment) {
        try {
            boolean result = equipmentService.updateEquipment(equipment);
            return result ? Result.success() : Result.error("更新失败");
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error("更新失败: " + e.getMessage());
        }
    }
    
    @DeleteMapping("/{id}")
    public Result<?> delete(@PathVariable Long id) {
        try {
            boolean result = equipmentService.deleteEquipment(id);
            return result ? Result.success() : Result.error("删除失败");
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error("删除失败: " + e.getMessage());
        }
    }
    
    @GetMapping("/categories")
    public Result<List<String>> getCategories() {
        try {
            return Result.success(equipmentService.getAllCategories());
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error("查询失败: " + e.getMessage());
        }
    }
    
    @GetMapping("/statistics")
    public Result<Map<String, Object>> getStatistics() {
        try {
            return Result.success(equipmentService.getStatistics());
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error("查询失败: " + e.getMessage());
        }
    }
    
    @PostMapping("/sync")
    public Result<?> syncData() {
        try {
            equipmentService.syncExternalData();
            return Result.success();
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error("同步失败: " + e.getMessage());
        }
    }
    
    @PostMapping("/import")
    public Result<?> importData(@RequestBody List<HeritageEquipment> equipmentList) {
        try {
            equipmentService.importFromExternalSource(equipmentList);
            return Result.success();
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error("导入失败: " + e.getMessage());
        }
    }
}
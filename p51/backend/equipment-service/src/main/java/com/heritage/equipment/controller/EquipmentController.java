package com.heritage.equipment.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.heritage.common.entity.DamageMark;
import com.heritage.common.entity.Equipment;
import com.heritage.common.entity.EquipmentPart;
import com.heritage.common.result.Result;
import com.heritage.equipment.service.EquipmentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/equipment")
@CrossOrigin
public class EquipmentController {

    @Autowired
    private EquipmentService equipmentService;

    @GetMapping
    public Result<List<Equipment>> list() {
        try {
            return Result.success(equipmentService.list());
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error(500, "查询失败: " + e.getMessage());
        }
    }

    @GetMapping("/{id}")
    public Result<Equipment> getById(@PathVariable Long id) {
        try {
            Equipment equipment = equipmentService.getDetailById(id);
            if (equipment == null) {
                return Result.error(404, "设备不存在");
            }
            return Result.success(equipment);
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error(500, "查询失败: " + e.getMessage());
        }
    }

    @PostMapping
    public Result<Boolean> save(@RequestBody Equipment equipment) {
        try {
            return Result.success(equipmentService.saveEquipment(equipment));
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error(500, "保存失败: " + e.getMessage());
        }
    }

    @PutMapping
    public Result<Boolean> update(@RequestBody Equipment equipment) {
        try {
            return Result.success(equipmentService.updateById(equipment));
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error(500, "更新失败: " + e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    public Result<Boolean> delete(@PathVariable Long id) {
        try {
            return Result.success(equipmentService.removeById(id));
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error(500, "删除失败: " + e.getMessage());
        }
    }

    @GetMapping("/{id}/parts")
    public Result<List<EquipmentPart>> getParts(@PathVariable Long id) {
        try {
            return Result.success(equipmentService.getPartsByEquipmentId(id));
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error(500, "查询失败: " + e.getMessage());
        }
    }

    @GetMapping("/{id}/damage-marks")
    public Result<List<DamageMark>> getDamageMarks(@PathVariable Long id) {
        try {
            return Result.success(equipmentService.getDamageMarksByEquipmentId(id));
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error(500, "查询失败: " + e.getMessage());
        }
    }

    @PostMapping("/damage-mark")
    public Result<Boolean> saveDamageMark(@RequestBody DamageMark damageMark) {
        try {
            return Result.success(equipmentService.saveDamageMark(damageMark));
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error(500, "保存失败: " + e.getMessage());
        }
    }

    @GetMapping("/search")
    public Result<List<Equipment>> search(@RequestParam(required = false) String keyword,
                                          @RequestParam(required = false) String type) {
        try {
            LambdaQueryWrapper<Equipment> wrapper = new LambdaQueryWrapper<>();
            if (keyword != null && !keyword.isEmpty()) {
                wrapper.like(Equipment::getName, keyword);
            }
            if (type != null && !type.isEmpty()) {
                wrapper.eq(Equipment::getEquipmentType, type);
            }
            return Result.success(equipmentService.list(wrapper));
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error(500, "搜索失败: " + e.getMessage());
        }
    }
}

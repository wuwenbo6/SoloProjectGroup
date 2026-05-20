package com.heritage.restoration.controller;

import com.heritage.common.entity.RestorationPlan;
import com.heritage.common.entity.RestorationProgress;
import com.heritage.common.result.Result;
import com.heritage.restoration.service.RestorationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/restoration")
@CrossOrigin
public class RestorationController {

    @Autowired
    private RestorationService restorationService;

    @GetMapping("/plans")
    public Result<List<RestorationPlan>> listPlans() {
        try {
            return Result.success(restorationService.list());
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error(500, "查询失败: " + e.getMessage());
        }
    }

    @GetMapping("/plans/{id}")
    public Result<RestorationPlan> getPlanById(@PathVariable Long id) {
        try {
            RestorationPlan plan = restorationService.getById(id);
            if (plan == null) {
                return Result.error(404, "复原方案不存在");
            }
            return Result.success(plan);
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error(500, "查询失败: " + e.getMessage());
        }
    }

    @PostMapping("/plans")
    public Result<Boolean> savePlan(@RequestBody RestorationPlan plan) {
        try {
            return Result.success(restorationService.save(plan));
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error(500, "保存失败: " + e.getMessage());
        }
    }

    @PutMapping("/plans")
    public Result<Boolean> updatePlan(@RequestBody RestorationPlan plan) {
        try {
            return Result.success(restorationService.updateById(plan));
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error(500, "更新失败: " + e.getMessage());
        }
    }

    @DeleteMapping("/plans/{id}")
    public Result<Boolean> deletePlan(@PathVariable Long id) {
        try {
            return Result.success(restorationService.removeById(id));
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error(500, "删除失败: " + e.getMessage());
        }
    }

    @GetMapping("/plans/equipment/{equipmentId}")
    public Result<List<RestorationPlan>> getPlansByEquipmentId(@PathVariable Long equipmentId) {
        try {
            return Result.success(restorationService.getByEquipmentId(equipmentId));
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error(500, "查询失败: " + e.getMessage());
        }
    }

    @GetMapping("/progress/plan/{planId}")
    public Result<List<RestorationProgress>> getProgressByPlanId(@PathVariable Long planId) {
        try {
            return Result.success(restorationService.getProgressByPlanId(planId));
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error(500, "查询失败: " + e.getMessage());
        }
    }
}

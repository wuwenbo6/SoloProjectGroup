package com.bamboo.defect.controller;

import com.bamboo.defect.common.Result;
import com.bamboo.defect.entity.ParamHistory;
import com.bamboo.defect.service.ProcessService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/process")
@CrossOrigin
public class ProcessController {
    
    @Autowired
    private ProcessService processService;
    
    @GetMapping("/params")
    public Result<Map<String, Object>> getAllParams() {
        return Result.success(processService.getAllParams());
    }
    
    @GetMapping("/params/detection")
    public Result<Map<String, Object>> getDetectionParams() {
        return Result.success(processService.getDetectionParams());
    }
    
    @GetMapping("/params/camera")
    public Result<Map<String, Object>> getCameraParams() {
        return Result.success(processService.getCameraParams());
    }
    
    @GetMapping("/params/alert")
    public Result<Map<String, Object>> getAlertParams() {
        return Result.success(processService.getAlertParams());
    }
    
    @GetMapping("/params/detail")
    public Result<Map<String, Object>> getParamDetail(
            @RequestParam String paramType,
            @RequestParam String paramName) {
        return Result.success(processService.getParamByName(paramType, paramName));
    }
    
    @PutMapping("/params")
    public Result<Void> updateParams(@RequestBody Map<String, Object> params) {
        String paramType = (String) params.get("paramType");
        String paramName = (String) params.get("paramName");
        String newValue = String.valueOf(params.get("value"));
        String operator = (String) params.getOrDefault("operator", "管理员");
        
        boolean success = processService.updateParam(paramType, paramName, newValue, operator);
        if (success) {
            return Result.success("参数更新成功");
        }
        return Result.error("参数更新失败");
    }
    
    @PutMapping("/params/batch")
    public Result<Map<String, Object>> batchUpdateParams(@RequestBody Map<String, Object> params) {
        String paramType = (String) params.get("paramType");
        String operator = (String) params.getOrDefault("operator", "管理员");
        
        @SuppressWarnings("unchecked")
        Map<String, Object> paramValues = (Map<String, Object>) params.get("params");
        
        Map<String, Object> result = processService.batchUpdateParams(paramType, paramValues, operator);
        return Result.success(result);
    }
    
    @DeleteMapping("/params")
    public Result<Void> deleteParam(
            @RequestParam String paramType,
            @RequestParam String paramName,
            @RequestParam(defaultValue = "管理员") String operator) {
        boolean success = processService.deleteParam(paramType, paramName, operator);
        if (success) {
            return Result.success("参数禁用成功");
        }
        return Result.error("参数禁用失败");
    }
    
    @GetMapping("/history")
    public Result<Page<ParamHistory>> getParamHistory(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String paramType) {
        if (paramType != null && !paramType.isEmpty()) {
            return Result.success(processService.getParamHistoryByType(paramType, page, size));
        }
        return Result.success(processService.getParamHistory(page, size));
    }
    
    @GetMapping("/history/recent")
    public Result<List<ParamHistory>> getRecentParamHistory() {
        return Result.success(processService.getRecentParamHistory());
    }
    
    @GetMapping("/statistics")
    public Result<Map<String, Object>> getParamStatistics() {
        return Result.success(processService.getParamStatistics());
    }
}

package com.bamboo.defect.controller;

import com.bamboo.defect.service.AlertService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.annotation.PostConstruct;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/alert")
@CrossOrigin
public class AlertController {
    
    @Autowired
    private AlertService alertService;
    
    @PostConstruct
    public void init() {
        alertService.initThresholds();
        log.info("预警服务初始化完成");
    }
    
    @GetMapping("/list")
    public Map<String, Object> getActiveAlerts() {
        Map<String, Object> result = new HashMap<>();
        try {
            List<Map<String, Object>> alerts = alertService.getActiveAlerts();
            result.put("success", true);
            result.put("data", alerts);
            result.put("total", alerts.size());
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", e.getMessage());
        }
        return result;
    }
    
    @GetMapping("/statistics")
    public Map<String, Object> getAlertStatistics() {
        Map<String, Object> result = new HashMap<>();
        try {
            Map<String, Object> stats = alertService.getAlertStatistics();
            result.put("success", true);
            result.put("data", stats);
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", e.getMessage());
        }
        return result;
    }
    
    @GetMapping("/check")
    public Map<String, Object> checkAllParams() {
        Map<String, Object> result = new HashMap<>();
        try {
            List<Map<String, Object>> alerts = alertService.checkAllParams();
            result.put("success", true);
            result.put("data", alerts);
            result.put("total", alerts.size());
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", e.getMessage());
        }
        return result;
    }
    
    @PutMapping("/handle/{alertId}")
    public Map<String, Object> handleAlert(
            @PathVariable String alertId,
            @RequestBody Map<String, Object> request) {
        Map<String, Object> result = new HashMap<>();
        try {
            String operator = (String) request.getOrDefault("operator", "系统");
            String remark = (String) request.getOrDefault("remark", "");
            
            boolean success = alertService.handleAlert(alertId, operator, remark);
            result.put("success", success);
            if (success) {
                result.put("message", "告警处理成功");
            } else {
                result.put("message", "告警不存在");
            }
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", e.getMessage());
        }
        return result;
    }
    
    @GetMapping("/thresholds/{paramType}")
    public Map<String, Object> getParamThresholds(@PathVariable String paramType) {
        Map<String, Object> result = new HashMap<>();
        try {
            Map<String, Object> thresholds = alertService.getParamThresholds(paramType);
            result.put("success", true);
            result.put("data", thresholds);
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", e.getMessage());
        }
        return result;
    }
    
    @PutMapping("/thresholds/{paramType}")
    public Map<String, Object> updateParamThreshold(
            @PathVariable String paramType,
            @RequestBody Map<String, Object> request) {
        Map<String, Object> result = new HashMap<>();
        try {
            String paramName = (String) request.get("paramName");
            Double minValue = request.get("minValue") != null ? 
                ((Number) request.get("minValue")).doubleValue() : null;
            Double maxValue = request.get("maxValue") != null ? 
                ((Number) request.get("maxValue")).doubleValue() : null;
            
            boolean success = alertService.updateParamThreshold(paramType, paramName, minValue, maxValue);
            result.put("success", success);
            result.put("message", success ? "阈值更新成功" : "阈值更新失败");
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", e.getMessage());
        }
        return result;
    }
}

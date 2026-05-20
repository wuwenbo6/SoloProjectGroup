package com.bamboo.defect.service;

import com.bamboo.defect.entity.ParamHistory;
import com.bamboo.defect.repository.ParamHistoryRepository;
import com.bamboo.defect.websocket.DetectionWebSocket;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
public class AlertService {
    
    @Autowired
    private ProcessService processService;
    
    @Autowired
    private ParamHistoryRepository paramHistoryRepository;
    
    private Map<String, Map<String, Object>> paramThresholds = new HashMap<>();
    
    private List<Map<String, Object>> activeAlerts = new ArrayList<>();
    
    public void initThresholds() {
        Map<String, Object> detectionThresholds = new HashMap<>();
        detectionThresholds.put("speed_min", 10);
        detectionThresholds.put("speed_max", 120);
        detectionThresholds.put("precision_min", 0.01);
        detectionThresholds.put("precision_max", 1.0);
        detectionThresholds.put("confidenceThreshold_min", 0.5);
        detectionThresholds.put("confidenceThreshold_max", 1.0);
        paramThresholds.put("detection", detectionThresholds);
        
        Map<String, Object> cameraThresholds = new HashMap<>();
        cameraThresholds.put("brightness_min", 20);
        cameraThresholds.put("brightness_max", 90);
        cameraThresholds.put("contrast_min", 20);
        cameraThresholds.put("contrast_max", 90);
        cameraThresholds.put("saturation_min", 20);
        cameraThresholds.put("saturation_max", 90);
        cameraThresholds.put("sharpness_min", 20);
        cameraThresholds.put("sharpness_max", 90);
        paramThresholds.put("camera", cameraThresholds);
        
        Map<String, Object> alertThresholds = new HashMap<>();
        alertThresholds.put("consecutiveThreshold_min", 1);
        alertThresholds.put("consecutiveThreshold_max", 100);
        paramThresholds.put("alert", alertThresholds);
    }
    
    public List<Map<String, Object>> checkAllParams() {
        List<Map<String, Object>> alerts = new ArrayList<>();
        
        Map<String, Object> allParams = processService.getAllParams();
        
        for (Map.Entry<String, Object> entry : allParams.entrySet()) {
            String paramType = entry.getKey();
            if (entry.getValue() instanceof Map) {
                Map<String, Object> params = (Map<String, Object>) entry.getValue();
                for (Map.Entry<String, Object> paramEntry : params.entrySet()) {
                    String paramName = paramEntry.getKey();
                    Object value = paramEntry.getValue();
                    
                    Map<String, Object> alert = checkParam(paramType, paramName, value);
                    if (alert != null) {
                        alerts.add(alert);
                    }
                }
            }
        }
        
        return alerts;
    }
    
    public Map<String, Object> checkParam(String paramType, String paramName, Object value) {
        if (!paramThresholds.containsKey(paramType)) {
            return null;
        }
        
        Map<String, Object> thresholds = paramThresholds.get(paramType);
        Double minValue = getThresholdValue(thresholds, paramName + "_min");
        Double maxValue = getThresholdValue(thresholds, paramName + "_max");
        
        if (minValue == null && maxValue == null) {
            return null;
        }
        
        Double numericValue = toDouble(value);
        if (numericValue == null) {
            return null;
        }
        
        boolean isAbnormal = false;
        String alertType = null;
        Double deviation = null;
        
        if (minValue != null && numericValue < minValue) {
            isAbnormal = true;
            alertType = "LOW";
            deviation = ((minValue - numericValue) / minValue) * 100;
        } else if (maxValue != null && numericValue > maxValue) {
            isAbnormal = true;
            alertType = "HIGH";
            deviation = ((numericValue - maxValue) / maxValue) * 100;
        }
        
        if (isAbnormal) {
            Map<String, Object> alert = new HashMap<>();
            alert.put("id", UUID.randomUUID().toString());
            alert.put("paramType", paramType);
            alert.put("paramName", paramName);
            alert.put("currentValue", numericValue);
            alert.put("minValue", minValue);
            alert.put("maxValue", maxValue);
            alert.put("alertType", alertType);
            alert.put("deviation", Math.round(deviation * 100.0) / 100.0);
            alert.put("level", deviation > 20 ? "serious" : (deviation > 10 ? "warning" : "notice"));
            alert.put("timestamp", LocalDateTime.now());
            alert.put("handled", false);
            alert.put("message", generateAlertMessage(paramType, paramName, alertType, numericValue, minValue, maxValue));
            
            return alert;
        }
        
        return null;
    }
    
    public List<Map<String, Object>> getActiveAlerts() {
        List<Map<String, Object>> unhandledAlerts = new ArrayList<>();
        for (Map<String, Object> alert : activeAlerts) {
            if (!(Boolean) alert.getOrDefault("handled", false)) {
                unhandledAlerts.add(alert);
            }
        }
        unhandledAlerts.sort((a, b) -> {
            LocalDateTime timeA = (LocalDateTime) a.get("timestamp");
            LocalDateTime timeB = (LocalDateTime) b.get("timestamp");
            return timeB.compareTo(timeA);
        });
        return unhandledAlerts;
    }
    
    public boolean handleAlert(String alertId, String operator, String remark) {
        for (Map<String, Object> alert : activeAlerts) {
            if (alertId.equals(alert.get("id"))) {
                alert.put("handled", true);
                alert.put("handleTime", LocalDateTime.now());
                alert.put("handler", operator);
                alert.put("remark", remark);
                return true;
            }
        }
        return false;
    }
    
    public Map<String, Object> getAlertStatistics() {
        Map<String, Object> stats = new HashMap<>();
        
        long totalAlerts = activeAlerts.size();
        long unhandledAlerts = activeAlerts.stream()
            .filter(a -> !(Boolean) a.getOrDefault("handled", false))
            .count();
        long seriousAlerts = activeAlerts.stream()
            .filter(a -> "serious".equals(a.get("level")) && !(Boolean) a.getOrDefault("handled", false))
            .count();
        long warningAlerts = activeAlerts.stream()
            .filter(a -> "warning".equals(a.get("level")) && !(Boolean) a.getOrDefault("handled", false))
            .count();
        
        stats.put("totalAlerts", totalAlerts);
        stats.put("unhandledAlerts", unhandledAlerts);
        stats.put("seriousAlerts", seriousAlerts);
        stats.put("warningAlerts", warningAlerts);
        stats.put("noticeAlerts", unhandledAlerts - seriousAlerts - warningAlerts);
        
        return stats;
    }
    
    public Map<String, Object> getParamThresholds(String paramType) {
        return paramThresholds.getOrDefault(paramType, new HashMap<>());
    }
    
    public boolean updateParamThreshold(String paramType, String paramName, Double minValue, Double maxValue) {
        if (!paramThresholds.containsKey(paramType)) {
            paramThresholds.put(paramType, new HashMap<>());
        }
        
        Map<String, Object> thresholds = paramThresholds.get(paramType);
        if (minValue != null) {
            thresholds.put(paramName + "_min", minValue);
        }
        if (maxValue != null) {
            thresholds.put(paramName + "_max", maxValue);
        }
        
        return true;
    }
    
    @Scheduled(fixedRate = 30000)
    public void scheduledCheck() {
        List<Map<String, Object>> newAlerts = checkAllParams();
        
        for (Map<String, Object> alert : newAlerts) {
            boolean isDuplicate = activeAlerts.stream()
                .anyMatch(a -> 
                    a.get("paramType").equals(alert.get("paramType")) &&
                    a.get("paramName").equals(alert.get("paramName")) &&
                    a.get("alertType").equals(alert.get("alertType")) &&
                    !(Boolean) a.getOrDefault("handled", false)
                );
            
            if (!isDuplicate) {
                activeAlerts.add(alert);
                pushAlert(alert);
                log.warn("参数异常告警: {}", alert.get("message"));
            }
        }
        
        if (activeAlerts.size() > 1000) {
            activeAlerts = activeAlerts.subList(activeAlerts.size() - 500, activeAlerts.size());
        }
    }
    
    private void pushAlert(Map<String, Object> alert) {
        Map<String, Object> message = new HashMap<>();
        message.put("type", "alert");
        message.put("data", alert);
        DetectionWebSocket.sendDetectionResult(message);
    }
    
    private String generateAlertMessage(String paramType, String paramName, String alertType, 
                                        Double currentValue, Double minValue, Double maxValue) {
        Map<String, String> typeNames = new HashMap<>();
        typeNames.put("detection", "检测参数");
        typeNames.put("camera", "相机参数");
        typeNames.put("alert", "预警配置");
        
        Map<String, String> paramNames = new HashMap<>();
        paramNames.put("speed", "检测速度");
        paramNames.put("precision", "检测精度");
        paramNames.put("confidenceThreshold", "置信度阈值");
        paramNames.put("brightness", "亮度");
        paramNames.put("contrast", "对比度");
        paramNames.put("saturation", "饱和度");
        paramNames.put("sharpness", "锐度");
        paramNames.put("consecutiveThreshold", "连续缺陷阈值");
        
        String typeName = typeNames.getOrDefault(paramType, paramType);
        String name = paramNames.getOrDefault(paramName, paramName);
        
        if ("LOW".equals(alertType)) {
            return String.format("%s - %s 低于阈值: 当前值=%.2f, 最小值=%.2f", typeName, name, currentValue, minValue);
        } else {
            return String.format("%s - %s 高于阈值: 当前值=%.2f, 最大值=%.2f", typeName, name, currentValue, maxValue);
        }
    }
    
    private Double getThresholdValue(Map<String, Object> thresholds, String key) {
        Object value = thresholds.get(key);
        return toDouble(value);
    }
    
    private Double toDouble(Object value) {
        if (value == null) return null;
        if (value instanceof Number) {
            return ((Number) value).doubleValue();
        }
        try {
            return Double.parseDouble(value.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}

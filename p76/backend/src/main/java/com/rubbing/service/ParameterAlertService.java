package com.rubbing.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class ParameterAlertService {

    private final SimpMessagingTemplate messagingTemplate;
    
    private final List<AlertRecord> alertHistory = new ArrayList<>();
    private final Map<String, ParameterThreshold> thresholds = new ConcurrentHashMap<>();
    
    private static final int MAX_ALERT_HISTORY = 100;

    static {
        ParameterThreshold brightnessThreshold = new ParameterThreshold();
        brightnessThreshold.setParamName("brightness");
        brightnessThreshold.setMinValue(20);
        brightnessThreshold.setMaxValue(80);
        brightnessThreshold.setWarningMinValue(30);
        brightnessThreshold.setWarningMaxValue(70);
        
        ParameterThreshold contrastThreshold = new ParameterThreshold();
        contrastThreshold.setParamName("contrast");
        contrastThreshold.setMinValue(20);
        contrastThreshold.setMaxValue(80);
        contrastThreshold.setWarningMinValue(30);
        contrastThreshold.setWarningMaxValue(70);
        
        ParameterThreshold sharpnessThreshold = new ParameterThreshold();
        sharpnessThreshold.setParamName("sharpness");
        sharpnessThreshold.setMinValue(0);
        sharpnessThreshold.setMaxValue(100);
        sharpnessThreshold.setWarningMinValue(20);
        sharpnessThreshold.setWarningMaxValue(90);
        
        ParameterThreshold qualityThreshold = new ParameterThreshold();
        qualityThreshold.setParamName("qualityScore");
        qualityThreshold.setMinValue(0);
        qualityThreshold.setMaxValue(100);
        qualityThreshold.setWarningMinValue(60);
        qualityThreshold.setWarningMaxValue(100);
        
        Map<String, ParameterThreshold> defaultThresholds = Map.of(
            "brightness", brightnessThreshold,
            "contrast", contrastThreshold,
            "sharpness", sharpnessThreshold,
            "qualityScore", qualityThreshold
        );
    }

    public static class ParameterThreshold {
        private String paramName;
        private int minValue;
        private int maxValue;
        private int warningMinValue;
        private int warningMaxValue;

        public String getParamName() { return paramName; }
        public void setParamName(String paramName) { this.paramName = paramName; }
        public int getMinValue() { return minValue; }
        public void setMinValue(int minValue) { this.minValue = minValue; }
        public int getMaxValue() { return maxValue; }
        public void setMaxValue(int maxValue) { this.maxValue = maxValue; }
        public int getWarningMinValue() { return warningMinValue; }
        public void setWarningMinValue(int warningMinValue) { this.warningMinValue = warningMinValue; }
        public int getWarningMaxValue() { return warningMaxValue; }
        public void setWarningMaxValue(int warningMaxValue) { this.warningMaxValue = warningMaxValue; }
    }

    public static class AlertRecord {
        private String id;
        private String paramName;
        private String paramLabel;
        private int currentValue;
        private int thresholdValue;
        private String level;
        private String message;
        private LocalDateTime timestamp;

        public AlertRecord(String paramName, String paramLabel, int currentValue, int thresholdValue, String level, String message) {
            this.id = java.util.UUID.randomUUID().toString();
            this.paramName = paramName;
            this.paramLabel = paramLabel;
            this.currentValue = currentValue;
            this.thresholdValue = thresholdValue;
            this.level = level;
            this.message = message;
            this.timestamp = LocalDateTime.now();
        }

        public String getId() { return id; }
        public String getParamName() { return paramName; }
        public String getParamLabel() { return paramLabel; }
        public int getCurrentValue() { return currentValue; }
        public int getThresholdValue() { return thresholdValue; }
        public String getLevel() { return level; }
        public String getMessage() { return message; }
        public LocalDateTime getTimestamp() { return timestamp; }
    }

    public void checkParameters(Map<String, Integer> params) {
        List<AlertRecord> alerts = new ArrayList<>();
        
        params.forEach((paramName, value) -> {
            String level = checkParameter(paramName, value);
            if (level != null) {
                String paramLabel = getParamLabel(paramName);
                int threshold = getThresholdValue(paramName, level, value);
                String message = generateAlertMessage(paramLabel, value, level, threshold);
                
                AlertRecord alert = new AlertRecord(paramName, paramLabel, value, threshold, level, message);
                alerts.add(alert);
                addAlertToHistory(alert);
            }
        });
        
        if (!alerts.isEmpty()) {
            sendAlertNotification(alerts);
        }
    }

    private String checkParameter(String paramName, int value) {
        ParameterThreshold threshold = getThreshold(paramName);
        if (threshold == null) return null;
        
        if (value < threshold.getMinValue() || value > threshold.getMaxValue()) {
            return "ERROR";
        }
        if (value < threshold.getWarningMinValue() || value > threshold.getWarningMaxValue()) {
            return "WARNING";
        }
        return null;
    }

    private int getThresholdValue(String paramName, String level, int value) {
        ParameterThreshold threshold = getThreshold(paramName);
        if (threshold == null) return 0;
        
        if ("ERROR".equals(level)) {
            return value < threshold.getMinValue() ? threshold.getMinValue() : threshold.getMaxValue();
        } else {
            return value < threshold.getWarningMinValue() ? threshold.getWarningMinValue() : threshold.getWarningMaxValue();
        }
    }

    private String generateAlertMessage(String paramLabel, int value, String level, int threshold) {
        String levelText = "ERROR".equals(level) ? "严重异常" : "警告";
        String direction = value < threshold ? "过低" : "过高";
        return String.format("%s参数%s: 当前值=%d, 阈值=%d", paramLabel, direction, value, threshold);
    }

    private String getParamLabel(String paramName) {
        Map<String, String> labels = Map.of(
            "brightness", "亮度",
            "contrast", "对比度",
            "sharpness", "锐化强度",
            "qualityScore", "质量评分"
        );
        return labels.getOrDefault(paramName, paramName);
    }

    private ParameterThreshold getThreshold(String paramName) {
        return thresholds.get(paramName);
    }

    private void addAlertToHistory(AlertRecord alert) {
        alertHistory.add(0, alert);
        if (alertHistory.size() > MAX_ALERT_HISTORY) {
            alertHistory.remove(alertHistory.size() - 1);
        }
    }

    private void sendAlertNotification(List<AlertRecord> alerts) {
        try {
            messagingTemplate.convertAndSend("/topic/alerts", Map.of(
                "alerts", alerts,
                "timestamp", LocalDateTime.now().toString()
            ));
            log.info("发送参数预警通知: {}条", alerts.size());
        } catch (Exception e) {
            log.error("发送预警通知失败: {}", e.getMessage());
        }
    }

    public void updateThreshold(String paramName, ParameterThreshold threshold) {
        thresholds.put(paramName, threshold);
        log.info("更新参数阈值: {}", paramName);
    }

    public Map<String, ParameterThreshold> getAllThresholds() {
        return new ConcurrentHashMap<>(thresholds);
    }

    public List<AlertRecord> getAlertHistory() {
        return new ArrayList<>(alertHistory);
    }

    public void clearAlertHistory() {
        alertHistory.clear();
        log.info("预警历史已清空");
    }
}

package com.bamboo.defect.service;

import com.bamboo.defect.entity.ParamHistory;
import com.bamboo.defect.entity.ProcessParams;
import com.bamboo.defect.repository.ParamHistoryRepository;
import com.bamboo.defect.repository.ProcessParamsRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.annotation.PostConstruct;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
public class ProcessService {
    
    @Autowired
    private ProcessParamsRepository processParamsRepository;
    
    @Autowired
    private ParamHistoryRepository paramHistoryRepository;
    
    @PostConstruct
    public void initDefaultParams() {
        if (processParamsRepository.count() == 0) {
            log.info("初始化工艺参数...");
            
            saveParam("detection", "speed", "60", "件/分钟", "检测速度");
            saveParam("detection", "precision", "0.1", "mm", "检测精度");
            saveParam("detection", "confidenceThreshold", "0.75", "", "置信度阈值");
            saveParam("detection", "level1Threshold", "3", "mm", "轻微缺陷阈值");
            saveParam("detection", "level2Threshold", "8", "mm", "一般缺陷阈值");
            saveParam("detection", "mode", "auto", "", "运行模式");
            
            saveParam("camera", "brightness", "80", "", "亮度");
            saveParam("camera", "contrast", "50", "", "对比度");
            saveParam("camera", "saturation", "50", "", "饱和度");
            saveParam("camera", "sharpness", "60", "", "锐度");
            saveParam("camera", "exposureMode", "auto", "", "曝光模式");
            saveParam("camera", "resolution", "1920x1080", "", "分辨率");
            
            saveParam("alert", "soundEnabled", "true", "", "声音预警");
            saveParam("alert", "popupEnabled", "true", "", "弹窗预警");
            saveParam("alert", "alertLevel", "2", "", "预警等级");
            saveParam("alert", "consecutiveThreshold", "5", "", "连续缺陷预警数");
            saveParam("alert", "emailEnabled", "false", "", "邮件通知");
            saveParam("alert", "email", "admin@bamboo.com", "", "通知邮箱");
        }
    }
    
    private void saveParam(String type, String name, String value, String unit, String description) {
        ProcessParams param = new ProcessParams();
        param.setParamType(type);
        param.setParamName(name);
        param.setParamValue(value);
        param.setUnit(unit);
        param.setDescription(description);
        param.setOperator("系统");
        processParamsRepository.save(param);
    }
    
    public Map<String, Object> getAllParams() {
        Map<String, Object> result = new HashMap<>();
        
        List<ProcessParams> allParams = processParamsRepository.findAll();
        
        Map<String, Map<String, Object>> typeMap = new HashMap<>();
        typeMap.put("detection", new HashMap<>());
        typeMap.put("camera", new HashMap<>());
        typeMap.put("alert", new HashMap<>());
        
        for (ProcessParams param : allParams) {
            Map<String, Object> paramMap = typeMap.get(param.getParamType());
            if (paramMap != null) {
                Object value = parseValue(param.getParamValue());
                paramMap.put(param.getParamName(), value);
            }
        }
        
        result.putAll(typeMap);
        return result;
    }

    public Map<String, Object> getCameraParams() {
        Map<String, Object> result = new HashMap<>();
        List<ProcessParams> cameraParams = processParamsRepository.findByParamType("camera");
        
        for (ProcessParams param : cameraParams) {
            result.put(param.getParamName(), parseValue(param.getParamValue()));
        }
        
        if (result.isEmpty()) {
            result.put("brightness", 80);
            result.put("contrast", 50);
            result.put("saturation", 50);
            result.put("sharpness", 60);
            result.put("exposureMode", "auto");
            result.put("resolution", "1920x1080");
        }
        
        return result;
    }

    public void updateCameraParams(Map<String, Object> params) {
        for (Map.Entry<String, Object> entry : params.entrySet()) {
            String paramName = entry.getKey();
            String paramValue = String.valueOf(entry.getValue());
            updateParam("camera", paramName, paramValue, "系统");
        }
    }
    
    private Object parseValue(String value) {
        if ("true".equalsIgnoreCase(value) || "false".equalsIgnoreCase(value)) {
            return Boolean.parseBoolean(value);
        }
        try {
            if (value.contains(".")) {
                return Double.parseDouble(value);
            }
            return Integer.parseInt(value);
        } catch (NumberFormatException e) {
            return value;
        }
    }
    
    @Transactional
    public boolean updateParam(String paramType, String paramName, String newValue, String operator) {
        ProcessParams param = processParamsRepository.findByParamTypeAndParamName(paramType, paramName);
        
        String oldValue;
        boolean isNewParam = false;
        
        if (param != null) {
            oldValue = param.getParamValue();
            if (oldValue.equals(newValue)) {
                log.debug("参数值未变化: {} - {} = {}", paramType, paramName, newValue);
                return true;
            }
        } else {
            param = new ProcessParams();
            param.setParamType(paramType);
            param.setParamName(paramName);
            param.setUnit("");
            param.setDescription("自动创建的参数");
            oldValue = "";
            isNewParam = true;
        }
        
        param.setParamValue(newValue);
        param.setOperator(operator);
        param.setEnabled(true);
        processParamsRepository.save(param);
        
        ParamHistory history = new ParamHistory();
        history.setParamType(paramType);
        history.setParamName(paramName);
        history.setOldValue(oldValue);
        history.setNewValue(newValue);
        history.setOperator(operator);
        history.setRemark(isNewParam ? "新建参数" : "参数修改");
        paramHistoryRepository.save(history);
        
        log.info("参数更新: {} - {} 从 {} 变为 {} (操作人: {})", paramType, paramName, oldValue, newValue, operator);
        return true;
    }
    
    @Transactional
    public Map<String, Object> batchUpdateParams(String paramType, Map<String, Object> params, String operator) {
        Map<String, Object> result = new HashMap<>();
        List<String> updatedParams = new ArrayList<>();
        List<String> failedParams = new ArrayList<>();
        
        for (Map.Entry<String, Object> entry : params.entrySet()) {
            String paramName = entry.getKey();
            String paramValue = String.valueOf(entry.getValue());
            
            try {
                boolean success = updateParam(paramType, paramName, paramValue, operator);
                if (success) {
                    updatedParams.add(paramName);
                } else {
                    failedParams.add(paramName);
                }
            } catch (Exception e) {
                failedParams.add(paramName);
                log.error("更新参数失败: {} - {}, 错误: {}", paramType, paramName, e.getMessage());
            }
        }
        
        result.put("success", true);
        result.put("updatedCount", updatedParams.size());
        result.put("failedCount", failedParams.size());
        result.put("updatedParams", updatedParams);
        result.put("failedParams", failedParams);
        result.put("message", String.format("批量更新完成：成功 %d 个，失败 %d 个", updatedParams.size(), failedParams.size()));
        
        return result;
    }
    
    public Map<String, Object> getParamByName(String paramType, String paramName) {
        Map<String, Object> result = new HashMap<>();
        ProcessParams param = processParamsRepository.findByParamTypeAndParamName(paramType, paramName);
        
        if (param != null) {
            result.put("paramType", param.getParamType());
            result.put("paramName", param.getParamName());
            result.put("paramValue", parseValue(param.getParamValue()));
            result.put("unit", param.getUnit());
            result.put("description", param.getDescription());
            result.put("enabled", param.getEnabled());
            result.put("updateTime", param.getUpdateTime());
            result.put("operator", param.getOperator());
        }
        
        return result;
    }
    
    public Map<String, Object> getDetectionParams() {
        Map<String, Object> result = new HashMap<>();
        List<ProcessParams> detectionParams = processParamsRepository.findByParamType("detection");
        
        for (ProcessParams param : detectionParams) {
            result.put(param.getParamName(), parseValue(param.getParamValue()));
        }
        
        if (result.isEmpty()) {
            result.put("speed", 60);
            result.put("precision", 0.1);
            result.put("confidenceThreshold", 0.75);
            result.put("level1Threshold", 3);
            result.put("level2Threshold", 8);
            result.put("mode", "auto");
        }
        
        return result;
    }
    
    public Map<String, Object> getAlertParams() {
        Map<String, Object> result = new HashMap<>();
        List<ProcessParams> alertParams = processParamsRepository.findByParamType("alert");
        
        for (ProcessParams param : alertParams) {
            result.put(param.getParamName(), parseValue(param.getParamValue()));
        }
        
        if (result.isEmpty()) {
            result.put("soundEnabled", true);
            result.put("popupEnabled", true);
            result.put("alertLevel", 2);
            result.put("consecutiveThreshold", 5);
            result.put("emailEnabled", false);
            result.put("email", "admin@bamboo.com");
        }
        
        return result;
    }
    
    public Page<ParamHistory> getParamHistory(int page, int size) {
        Pageable pageable = PageRequest.of(page - 1, size);
        return paramHistoryRepository.findAllByOrderByTimestampDesc(pageable);
    }
    
    public Page<ParamHistory> getParamHistoryByType(String paramType, int page, int size) {
        Pageable pageable = PageRequest.of(page - 1, size);
        return paramHistoryRepository.findByParamTypeOrderByTimestampDesc(paramType, pageable);
    }
    
    public List<ParamHistory> getRecentParamHistory() {
        return paramHistoryRepository.findTop10ByOrderByTimestampDesc();
    }
    
    public Map<String, Object> getParamStatistics() {
        Map<String, Object> stats = new HashMap<>();
        
        List<ProcessParams> allParams = processParamsRepository.findAll();
        stats.put("totalParams", allParams.size());
        
        Map<String, Integer> typeCount = new HashMap<>();
        for (ProcessParams param : allParams) {
            typeCount.merge(param.getParamType(), 1, Integer::sum);
        }
        stats.put("paramsByType", typeCount);
        
        long enabledCount = allParams.stream().filter(ProcessParams::getEnabled).count();
        stats.put("enabledCount", enabledCount);
        
        long historyCount = paramHistoryRepository.count();
        stats.put("totalChanges", historyCount);
        
        List<ParamHistory> recent = paramHistoryRepository.findTop10ByOrderByTimestampDesc();
        if (!recent.isEmpty()) {
            stats.put("lastChangeTime", recent.get(0).getTimestamp());
            stats.put("lastOperator", recent.get(0).getOperator());
        }
        
        return stats;
    }
    
    @Transactional
    public boolean deleteParam(String paramType, String paramName, String operator) {
        ProcessParams param = processParamsRepository.findByParamTypeAndParamName(paramType, paramName);
        if (param != null) {
            String oldValue = param.getParamValue();
            
            param.setEnabled(false);
            param.setOperator(operator);
            processParamsRepository.save(param);
            
            ParamHistory history = new ParamHistory();
            history.setParamType(paramType);
            history.setParamName(paramName);
            history.setOldValue(oldValue);
            history.setNewValue("(已禁用)");
            history.setOperator(operator);
            history.setRemark("参数禁用");
            paramHistoryRepository.save(history);
            
            log.info("参数已禁用: {} - {} (操作人: {})", paramType, paramName, operator);
            return true;
        }
        return false;
    }
}

package com.ancient.book.database.service;

import com.ancient.book.common.entity.AuditLog;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import jakarta.annotation.PostConstruct;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final Map<Long, AuditLog> logs = new ConcurrentHashMap<>();
    private final Map<String, List<AuditLog>> traceIndex = new ConcurrentHashMap<>();
    private final Map<Long, List<AuditLog>> userIndex = new ConcurrentHashMap<>();
    private final Map<String, List<AuditLog>> resourceIndex = new ConcurrentHashMap<>();
    private final Queue<AuditLog> recentLogs = new ConcurrentLinkedQueue<>();

    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final int MAX_RECENT_LOGS = 10000;
    private static final String[] RISK_OPERATIONS = {
            "DELETE", "REMOVE", "EXPORT_ALL", "CHANGE_PERMISSION", "LOCK_USER"
    };

    @PostConstruct
    public void init() {
        log.info("初始化审计日志服务...");
        generateSampleLogs();
        log.info("审计日志服务初始化完成，当前日志数量: {}", logs.size());
    }

    private void generateSampleLogs() {
        String[][] sampleData = {
                {"1", "张三", "RESTORATION", "图像上传", "UPLOAD", "IMAGE", "1001", "宋刻本论语", "POST", "/api/images/upload", "200", "NORMAL", "5"},
                {"2", "张三", "RESTORATION", "破损修复", "UPDATE", "IMAGE", "1001", "宋刻本论语", "PUT", "/api/images/1001/restore", "200", "MEDIUM", "120"},
                {"3", "王校对", "PROOFREAD", "文字校对", "UPDATE", "TEXT", "2001", "卷一·学而", "PUT", "/api/text/2001/proofread", "200", "LOW", "45"},
                {"4", "李修复", "RESTORATION", "污渍清除", "UPDATE", "IMAGE", "1002", "元刻本孟子", "PUT", "/api/images/1002/clean", "200", "MEDIUM", "85"},
                {"5", "赵审核", "REVIEW", "修复审核", "APPROVE", "TASK", "3001", "论语修复任务", "POST", "/api/tasks/3001/approve", "200", "HIGH", "2"},
                {"6", "系统管理员", "SYSTEM", "用户创建", "CREATE", "USER", "2", "张三", "POST", "/api/users", "200", "HIGH", "10"},
                {"7", "系统管理员", "SYSTEM", "权限变更", "UPDATE", "ROLE", "2", "修复师", "PUT", "/api/roles/2", "200", "CRITICAL", "8"},
                {"8", "张三", "EXPORT", "古籍导出", "EXPORT", "BOOK", "5001", "论语", "POST", "/api/export", "200", "MEDIUM", "120"},
                {"9", "王校对", "DIALECT", "异体字转换", "PROCESS", "TEXT", "2002", "卷二·为政", "POST", "/api/dialect/recognize", "200", "LOW", "15"},
                {"10", "李修复", "OCR", "文字识别", "PROCESS", "IMAGE", "1003", "明刻本大学", "POST", "/api/ocr/recognize", "200", "LOW", "60"},
        };

        for (String[] data : sampleData) {
            AuditLog auditLog = new AuditLog();
            auditLog.setId(Long.parseLong(data[0]));
            auditLog.setTraceId("TRACE-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 8));
            auditLog.setUserId(Long.parseLong(data[0]) + 100L);
            auditLog.setUsername("user_" + data[0]);
            auditLog.setUserRealName(data[1]);
            auditLog.setModule(data[2]);
            auditLog.setOperation(data[3]);
            auditLog.setOperationType(data[4]);
            auditLog.setResourceType(data[5]);
            auditLog.setResourceId(Long.parseLong(data[6]));
            auditLog.setResourceName(data[7]);
            auditLog.setMethod(data[8]);
            auditLog.setRequestPath(data[9]);
            auditLog.setStatusCode(Integer.parseInt(data[10]));
            auditLog.setRiskLevel(data[11]);
            auditLog.setExecutionTime(Long.parseLong(data[12]));
            auditLog.setClientIp("192.168.1." + (10 + Integer.parseInt(data[0])));
            auditLog.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
            auditLog.setStatus("SUCCESS");
            auditLog.setCreateTime(LocalDateTime.now().minusMinutes(Integer.parseInt(data[0]) * 30L));

            saveLogInternal(auditLog);
        }
    }

    private void saveLogInternal(AuditLog auditLog) {
        logs.put(auditLog.getId(), auditLog);
        traceIndex.computeIfAbsent(auditLog.getTraceId(), k -> new ArrayList<>()).add(auditLog);
        userIndex.computeIfAbsent(auditLog.getUserId(), k -> new ArrayList<>()).add(auditLog);
        String resourceKey = auditLog.getResourceType() + ":" + auditLog.getResourceId();
        resourceIndex.computeIfAbsent(resourceKey, k -> new ArrayList<>()).add(auditLog);

        recentLogs.offer(auditLog);
        while (recentLogs.size() > MAX_RECENT_LOGS) {
            recentLogs.poll();
        }
    }

    @Async
    public void log(AuditLog auditLog) {
        if (auditLog.getId() == null) {
            auditLog.setId(System.currentTimeMillis());
        }
        if (auditLog.getTraceId() == null) {
            auditLog.setTraceId("TRACE-" + System.currentTimeMillis() + "-" +
                    UUID.randomUUID().toString().substring(0, 8));
        }
        if (auditLog.getCreateTime() == null) {
            auditLog.setCreateTime(LocalDateTime.now());
        }

        if (auditLog.getRiskLevel() == null) {
            auditLog.setRiskLevel(calculateRiskLevel(auditLog));
        }

        saveLogInternal(auditLog);

        if ("CRITICAL".equals(auditLog.getRiskLevel()) || "HIGH".equals(auditLog.getRiskLevel())) {
            log.warn("高风险操作记录: 用户={}, 操作={}, 资源={}, 风险等级={}",
                    auditLog.getUserRealName(), auditLog.getOperation(),
                    auditLog.getResourceName(), auditLog.getRiskLevel());
        }
    }

    private String calculateRiskLevel(AuditLog auditLog) {
        String operationType = auditLog.getOperationType() != null ?
                auditLog.getOperationType().toUpperCase() : "";

        for (String riskOp : RISK_OPERATIONS) {
            if (operationType.contains(riskOp)) {
                return "CRITICAL";
            }
        }

        if ("DELETE".equals(operationType) || "EXPORT".equals(operationType)) {
            return "HIGH";
        }

        if ("UPDATE".equals(operationType) || "APPROVE".equals(operationType)) {
            return "MEDIUM";
        }

        return "LOW";
    }

    public AuditLog createLog(Long userId, String username, String userRealName,
                               String module, String operation, String operationType,
                               String resourceType, Long resourceId, String resourceName,
                               String method, String requestPath, Integer statusCode,
                               Long executionTime, String clientIp, String userAgent) {
        AuditLog auditLog = new AuditLog();
        auditLog.setUserId(userId);
        auditLog.setUsername(username);
        auditLog.setUserRealName(userRealName);
        auditLog.setModule(module);
        auditLog.setOperation(operation);
        auditLog.setOperationType(operationType);
        auditLog.setResourceType(resourceType);
        auditLog.setResourceId(resourceId);
        auditLog.setResourceName(resourceName);
        auditLog.setMethod(method);
        auditLog.setRequestPath(requestPath);
        auditLog.setStatusCode(statusCode);
        auditLog.setExecutionTime(executionTime);
        auditLog.setClientIp(clientIp);
        auditLog.setUserAgent(userAgent);
        auditLog.setStatus(statusCode >= 200 && statusCode < 300 ? "SUCCESS" : "FAILED");

        log(auditLog);
        return auditLog;
    }

    public AuditLog getLogById(Long id) {
        return logs.get(id);
    }

    public List<AuditLog> getLogsByTraceId(String traceId) {
        return traceIndex.getOrDefault(traceId, Collections.emptyList());
    }

    public List<AuditLog> getLogsByUserId(Long userId) {
        return userIndex.getOrDefault(userId, Collections.emptyList());
    }

    public List<AuditLog> getLogsByResource(String resourceType, Long resourceId) {
        String key = resourceType + ":" + resourceId;
        return resourceIndex.getOrDefault(key, Collections.emptyList());
    }

    public List<AuditLog> searchLogs(String keyword, String module, String operationType,
                                      String riskLevel, String status, Long userId,
                                      LocalDateTime startTime, LocalDateTime endTime,
                                      int page, int size) {
        return logs.values().stream()
                .filter(l -> keyword == null || keyword.isEmpty() ||
                        (l.getOperation() != null && l.getOperation().contains(keyword)) ||
                        (l.getResourceName() != null && l.getResourceName().contains(keyword)) ||
                        (l.getUserRealName() != null && l.getUserRealName().contains(keyword)))
                .filter(l -> module == null || module.isEmpty() || module.equals(l.getModule()))
                .filter(l -> operationType == null || operationType.isEmpty() || operationType.equals(l.getOperationType()))
                .filter(l -> riskLevel == null || riskLevel.isEmpty() || riskLevel.equals(l.getRiskLevel()))
                .filter(l -> status == null || status.isEmpty() || status.equals(l.getStatus()))
                .filter(l -> userId == null || userId.equals(l.getUserId()))
                .filter(l -> startTime == null || l.getCreateTime().isAfter(startTime))
                .filter(l -> endTime == null || l.getCreateTime().isBefore(endTime))
                .sorted((a, b) -> b.getCreateTime().compareTo(a.getCreateTime()))
                .skip((long) page * size)
                .limit(size)
                .collect(Collectors.toList());
    }

    public Map<String, Object> getStatistics() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalLogs", logs.size());

        Map<String, Long> logsByModule = logs.values().stream()
                .collect(Collectors.groupingBy(AuditLog::getModule, Collectors.counting()));
        stats.put("logsByModule", logsByModule);

        Map<String, Long> logsByOperation = logs.values().stream()
                .collect(Collectors.groupingBy(AuditLog::getOperationType, Collectors.counting()));
        stats.put("logsByOperationType", logsByOperation);

        Map<String, Long> logsByRisk = logs.values().stream()
                .collect(Collectors.groupingBy(AuditLog::getRiskLevel, Collectors.counting()));
        stats.put("logsByRiskLevel", logsByRisk);

        Map<String, Long> logsByStatus = logs.values().stream()
                .collect(Collectors.groupingBy(AuditLog::getStatus, Collectors.counting()));
        stats.put("logsByStatus", logsByStatus);

        Map<Long, Long> logsByUser = logs.values().stream()
                .collect(Collectors.groupingBy(AuditLog::getUserId, Collectors.counting()));
        stats.put("logsByUser", logsByUser);

        Double avgExecutionTime = logs.values().stream()
                .mapToLong(AuditLog::getExecutionTime)
                .average()
                .orElse(0.0);
        stats.put("avgExecutionTimeMs", avgExecutionTime);

        return stats;
    }

    public List<Map<String, Object>> getRecentActivities(int limit) {
        return recentLogs.stream()
                .sorted((a, b) -> b.getCreateTime().compareTo(a.getCreateTime()))
                .limit(limit)
                .map(this::toActivityMap)
                .collect(Collectors.toList());
    }

    private Map<String, Object> toActivityMap(AuditLog log) {
        Map<String, Object> activity = new HashMap<>();
        activity.put("id", log.getId());
        activity.put("user", log.getUserRealName());
        activity.put("action", log.getOperation());
        activity.put("resource", log.getResourceName());
        activity.put("module", log.getModule());
        activity.put("time", log.getCreateTime());
        activity.put("riskLevel", log.getRiskLevel());
        activity.put("status", log.getStatus());
        return activity;
    }

    public List<Map<String, Object>> getOperationHistory(String resourceType, Long resourceId) {
        String key = resourceType + ":" + resourceId;
        return resourceIndex.getOrDefault(key, Collections.emptyList()).stream()
                .sorted((a, b) -> a.getCreateTime().compareTo(b.getCreateTime()))
                .map(log -> {
                    Map<String, Object> history = new HashMap<>();
                    history.put("timestamp", log.getCreateTime());
                    history.put("operator", log.getUserRealName());
                    history.put("operation", log.getOperation());
                    history.put("detail", log.getChangeDescription());
                    history.put("riskLevel", log.getRiskLevel());
                    return history;
                })
                .collect(Collectors.toList());
    }

    public Map<String, Object> getUserActivityReport(Long userId, LocalDateTime startTime, LocalDateTime endTime) {
        List<AuditLog> userLogs = userIndex.getOrDefault(userId, Collections.emptyList()).stream()
                .filter(l -> startTime == null || l.getCreateTime().isAfter(startTime))
                .filter(l -> endTime == null || l.getCreateTime().isBefore(endTime))
                .collect(Collectors.toList());

        Map<String, Object> report = new HashMap<>();
        report.put("userId", userId);
        report.put("totalOperations", userLogs.size());

        Map<String, Long> byModule = userLogs.stream()
                .collect(Collectors.groupingBy(AuditLog::getModule, Collectors.counting()));
        report.put("operationsByModule", byModule);

        Map<String, Long> byType = userLogs.stream()
                .collect(Collectors.groupingBy(AuditLog::getOperationType, Collectors.counting()));
        report.put("operationsByType", byType);

        long successCount = userLogs.stream().filter(l -> "SUCCESS".equals(l.getStatus())).count();
        report.put("successRate", userLogs.isEmpty() ? 100.0 : (double) successCount / userLogs.size() * 100);

        long highRiskCount = userLogs.stream()
                .filter(l -> "HIGH".equals(l.getRiskLevel()) || "CRITICAL".equals(l.getRiskLevel()))
                .count();
        report.put("highRiskOperations", highRiskCount);

        return report;
    }

    public List<Map<String, Object>> getHighRiskAlerts(int limit) {
        return logs.values().stream()
                .filter(l -> "HIGH".equals(l.getRiskLevel()) || "CRITICAL".equals(l.getRiskLevel()))
                .sorted((a, b) -> b.getCreateTime().compareTo(a.getCreateTime()))
                .limit(limit)
                .map(log -> {
                    Map<String, Object> alert = new HashMap<>();
                    alert.put("id", log.getId());
                    alert.put("traceId", log.getTraceId());
                    alert.put("user", log.getUserRealName());
                    alert.put("operation", log.getOperation());
                    alert.put("resource", log.getResourceName());
                    alert.put("riskLevel", log.getRiskLevel());
                    alert.put("time", log.getCreateTime());
                    alert.put("clientIp", log.getClientIp());
                    return alert;
                })
                .collect(Collectors.toList());
    }

    public void recordChange(Long userId, String username, String userRealName,
                             String resourceType, Long resourceId, String resourceName,
                             String operation, String beforeData, String afterData,
                             String changeDescription) {
        AuditLog auditLog = new AuditLog();
        auditLog.setUserId(userId);
        auditLog.setUsername(username);
        auditLog.setUserRealName(userRealName);
        auditLog.setModule(resourceType);
        auditLog.setOperation(operation);
        auditLog.setOperationType("UPDATE");
        auditLog.setResourceType(resourceType);
        auditLog.setResourceId(resourceId);
        auditLog.setResourceName(resourceName);
        auditLog.setBeforeData(beforeData);
        auditLog.setAfterData(afterData);
        auditLog.setChangeDescription(changeDescription);
        auditLog.setStatus("SUCCESS");
        auditLog.setStatusCode(200);

        log(auditLog);
    }

    public void recordError(Long userId, String username, String userRealName,
                            String requestPath, String method, Integer statusCode,
                            String errorMessage, String errorStack,
                            Long executionTime, String clientIp, String userAgent) {
        AuditLog auditLog = new AuditLog();
        auditLog.setUserId(userId);
        auditLog.setUsername(username);
        auditLog.setUserRealName(userRealName);
        auditLog.setModule("SYSTEM");
        auditLog.setOperation("错误发生");
        auditLog.setOperationType("ERROR");
        auditLog.setMethod(method);
        auditLog.setRequestPath(requestPath);
        auditLog.setStatusCode(statusCode);
        auditLog.setErrorMessage(errorMessage);
        auditLog.setErrorStack(errorStack);
        auditLog.setExecutionTime(executionTime);
        auditLog.setClientIp(clientIp);
        auditLog.setUserAgent(userAgent);
        auditLog.setStatus("FAILED");
        auditLog.setRiskLevel("HIGH");

        log(auditLog);
    }

    public List<AuditLog> getRecentLogs(int limit) {
        return recentLogs.stream()
                .sorted((a, b) -> b.getCreateTime().compareTo(a.getCreateTime()))
                .limit(limit)
                .collect(Collectors.toList());
    }

    public long countLogs() {
        return logs.size();
    }

    public void clearOldLogs(LocalDateTime before) {
        int beforeSize = logs.size();
        logs.entrySet().removeIf(entry -> entry.getValue().getCreateTime().isBefore(before));
        int removed = beforeSize - logs.size();
        log.info("清理 {} 之前的审计日志，共删除 {} 条", before, removed);
    }
}

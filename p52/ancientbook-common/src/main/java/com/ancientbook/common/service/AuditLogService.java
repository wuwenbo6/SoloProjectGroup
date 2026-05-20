package com.ancientbook.common.service;

import com.ancientbook.common.entity.AuditLog;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final Map<String, AuditLog> logStore = new ConcurrentHashMap<>();

    public void saveAuditLog(AuditLog auditLog) {
        logStore.put(auditLog.getLogId(), auditLog);
    }

    public AuditLog createAuditLog(String module, String operation, String method,
                                    String url, String ipAddress, Long userId, String username) {
        AuditLog auditLog = new AuditLog();
        auditLog.setLogId(UUID.randomUUID().toString());
        auditLog.setTraceId(UUID.randomUUID().toString().substring(0, 16));
        auditLog.setModule(module);
        auditLog.setOperation(operation);
        auditLog.setMethod(method);
        auditLog.setUrl(url);
        auditLog.setIpAddress(ipAddress);
        auditLog.setUserId(userId);
        auditLog.setUsername(username);
        auditLog.setRequestTime(LocalDateTime.now());
        auditLog.setStatus(1);
        return auditLog;
    }

    public void completeAuditLog(String logId, String responseResult, Integer status,
                                 String errorMessage, long duration) {
        AuditLog auditLog = logStore.get(logId);
        if (auditLog != null) {
            auditLog.setResponseResult(responseResult);
            auditLog.setStatus(status);
            auditLog.setErrorMessage(errorMessage);
            auditLog.setDuration(duration);
            auditLog.setResponseTime(LocalDateTime.now());
        }
    }

    public List<AuditLog> queryLogs(String module, String operation, Long userId,
                                     String bookCode, Long workerId, String operationType,
                                     LocalDateTime startTime, LocalDateTime endTime,
                                     Integer status, int pageNum, int pageSize) {
        return logStore.values().stream()
                .filter(l -> module == null || module.isEmpty() || module.equals(l.getModule()))
                .filter(l -> operation == null || operation.isEmpty() || operation.equals(l.getOperation()))
                .filter(l -> userId == null || userId.equals(l.getUserId()))
                .filter(l -> bookCode == null || bookCode.isEmpty() || bookCode.equals(l.getBookCode()))
                .filter(l -> workerId == null || workerId.equals(l.getWorkerId()))
                .filter(l -> operationType == null || operationType.isEmpty() || operationType.equals(l.getOperationType()))
                .filter(l -> status == null || status.equals(l.getStatus()))
                .filter(l -> startTime == null || l.getRequestTime() == null || !l.getRequestTime().isBefore(startTime))
                .filter(l -> endTime == null || l.getRequestTime() == null || !l.getRequestTime().isAfter(endTime))
                .sorted((a, b) -> b.getRequestTime().compareTo(a.getRequestTime()))
                .skip((long) (pageNum - 1) * pageSize)
                .limit(pageSize)
                .collect(Collectors.toList());
    }

    public long countLogs(String module, String operation, Long userId,
                          String bookCode, Long workerId, String operationType,
                          LocalDateTime startTime, LocalDateTime endTime, Integer status) {
        return logStore.values().stream()
                .filter(l -> module == null || module.isEmpty() || module.equals(l.getModule()))
                .filter(l -> operation == null || operation.isEmpty() || operation.equals(l.getOperation()))
                .filter(l -> userId == null || userId.equals(l.getUserId()))
                .filter(l -> bookCode == null || bookCode.isEmpty() || bookCode.equals(l.getBookCode()))
                .filter(l -> workerId == null || workerId.equals(l.getWorkerId()))
                .filter(l -> operationType == null || operationType.isEmpty() || operationType.equals(l.getOperationType()))
                .filter(l -> status == null || status.equals(l.getStatus()))
                .filter(l -> startTime == null || l.getRequestTime() == null || !l.getRequestTime().isBefore(startTime))
                .filter(l -> endTime == null || l.getRequestTime() == null || !l.getRequestTime().isAfter(endTime))
                .count();
    }

    public AuditLog getLogById(String logId) {
        return logStore.get(logId);
    }

    public Map<String, Object> getAuditStatistics() {
        Map<String, Object> stats = new LinkedHashMap<>();

        stats.put("totalLogs", logStore.size());

        Map<String, Long> moduleStats = logStore.values().stream()
                .collect(Collectors.groupingBy(AuditLog::getModule, Collectors.counting()));
        stats.put("moduleDistribution", moduleStats);

        Map<String, Long> operationStats = logStore.values().stream()
                .collect(Collectors.groupingBy(AuditLog::getOperation, Collectors.counting()));
        stats.put("operationDistribution", operationStats);

        Map<String, Long> operationTypeStats = logStore.values().stream()
                .filter(l -> l.getOperationType() != null)
                .collect(Collectors.groupingBy(AuditLog::getOperationType, Collectors.counting()));
        stats.put("operationTypeDistribution", operationTypeStats);

        long successCount = logStore.values().stream().filter(l -> Integer.valueOf(1).equals(l.getStatus())).count();
        long errorCount = logStore.values().stream().filter(l -> Integer.valueOf(0).equals(l.getStatus())).count();
        stats.put("successCount", successCount);
        stats.put("errorCount", errorCount);
        stats.put("successRate", logStore.size() > 0 ? Math.round(successCount * 10000.0 / logStore.size()) / 100.0 : 0);

        Double avgDuration = logStore.values().stream()
                .filter(l -> l.getDuration() != null)
                .mapToLong(AuditLog::getDuration)
                .average()
                .orElse(0.0);
        stats.put("avgDurationMs", Math.round(avgDuration));

        return stats;
    }

    public void generateMockData(int count) {
        String[] modules = {"rarebook", "progress", "process", "auth", "detection", "archive"};
        String[] operations = {"create", "update", "delete", "query", "export", "import", "audit"};
        String[] operationTypes = {"修复登记", "工序更新", "质量检测", "档案归档", "状态变更", "数据导出"};
        String[] usernames = {"张修复师", "李修复师", "王管理员", "赵检测员", "陈档案员"};
        Long[] userIds = {1L, 2L, 3L, 4L, 5L};

        Random random = new Random();

        for (int i = 0; i < count; i++) {
            AuditLog log = new AuditLog();
            log.setLogId(UUID.randomUUID().toString());
            log.setTraceId(UUID.randomUUID().toString().substring(0, 16));

            String module = modules[random.nextInt(modules.length)];
            log.setModule(module);
            log.setOperation(operations[random.nextInt(operations.length)]);

            log.setMethod(new String[]{"GET", "POST", "PUT", "DELETE"}[random.nextInt(4)]);
            log.setUrl("/api/" + module + "/" + log.getOperation());
            log.setIpAddress("192.168." + random.nextInt(256) + "." + random.nextInt(256));
            log.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");

            int userIdx = random.nextInt(usernames.length);
            log.setUserId(userIds[userIdx]);
            log.setUsername(usernames[userIdx]);
            log.setWorkerId(userIds[userIdx]);
            log.setWorkerName(usernames[userIdx]);

            log.setBookCode("BOOK_" + (1000 + random.nextInt(500)));
            log.setOperationType(operationTypes[random.nextInt(operationTypes.length)]);

            log.setRequestParams("{\"pageNum\": 1, \"pageSize\": 20}");
            log.setResponseResult("{\"code\": 200, \"message\": \"success\"}");

            int status = random.nextInt(100) < 95 ? 1 : 0;
            log.setStatus(status);
            if (status == 0) {
                log.setErrorMessage("系统异常，请稍后重试");
            }

            long duration = 10 + random.nextInt(1000);
            log.setDuration(duration);

            LocalDateTime requestTime = LocalDateTime.now().minusDays(random.nextInt(30))
                    .minusHours(random.nextInt(24)).minusMinutes(random.nextInt(60));
            log.setRequestTime(requestTime);
            log.setResponseTime(requestTime.plusNanos(duration * 1_000_000));

            logStore.put(log.getLogId(), log);
        }

        log.info("生成{}条审计日志模拟数据完成", count);
    }

    public List<Map<String, Object>> getWorkerOperationStats(Long workerId, int days) {
        LocalDateTime startTime = LocalDateTime.now().minusDays(days);

        List<Map<String, Object>> stats = new ArrayList<>();

        for (int i = 0; i < days; i++) {
            LocalDateTime dayStart = startTime.plusDays(i).withHour(0).withMinute(0).withSecond(0).withNano(0);
            LocalDateTime dayEnd = dayStart.plusDays(1).minusNanos(1);

            final int dayIdx = i;
            long dayCount = logStore.values().stream()
                    .filter(l -> workerId == null || workerId.equals(l.getWorkerId()))
                    .filter(l -> l.getRequestTime() != null && !l.getRequestTime().isBefore(dayStart) && !l.getRequestTime().isAfter(dayEnd))
                    .count();

            Map<String, Object> dayStat = new LinkedHashMap<>();
            dayStat.put("date", dayStart.toLocalDate().toString());
            dayStat.put("day", "第" + (dayIdx + 1) + "天");
            dayStat.put("operationCount", dayCount);
            stats.add(dayStat);
        }

        return stats;
    }

    public List<Map<String, Object>> getBookRepairHistory(String bookCode) {
        return logStore.values().stream()
                .filter(l -> bookCode != null && bookCode.equals(l.getBookCode()))
                .sorted((a, b) -> b.getRequestTime().compareTo(a.getRequestTime()))
                .map(l -> {
                    Map<String, Object> record = new LinkedHashMap<>();
                    record.put("logId", l.getLogId());
                    record.put("operation", l.getOperation());
                    record.put("operationType", l.getOperationType());
                    record.put("workerName", l.getWorkerName());
                    record.put("requestTime", l.getRequestTime());
                    record.put("status", l.getStatus());
                    record.put("duration", l.getDuration());
                    return record;
                })
                .collect(Collectors.toList());
    }
}

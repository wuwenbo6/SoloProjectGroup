package com.ancient.book.database.controller;

import com.ancient.book.common.entity.AuditLog;
import com.ancient.book.database.service.AuditLogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/logs")
@RequiredArgsConstructor
public class AuditLogController {

    private final AuditLogService auditLogService;

    @PostMapping
    public ResponseEntity<AuditLog> createLog(@RequestBody AuditLog auditLog) {
        log.info("创建审计日志: {} - {}", auditLog.getOperation(), auditLog.getResourceName());
        auditLogService.log(auditLog);
        return ResponseEntity.ok(auditLog);
    }

    @GetMapping("/{id}")
    public ResponseEntity<AuditLog> getLogById(@PathVariable Long id) {
        log.info("获取日志详情: {}", id);
        AuditLog auditLog = auditLogService.getLogById(id);
        return ResponseEntity.ok(auditLog);
    }

    @GetMapping("/trace/{traceId}")
    public ResponseEntity<List<AuditLog>> getLogsByTraceId(@PathVariable String traceId) {
        log.info("获取追踪ID关联日志: {}", traceId);
        List<AuditLog> logs = auditLogService.getLogsByTraceId(traceId);
        return ResponseEntity.ok(logs);
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<AuditLog>> getLogsByUserId(@PathVariable Long userId) {
        log.info("获取用户操作日志: {}", userId);
        List<AuditLog> logs = auditLogService.getLogsByUserId(userId);
        return ResponseEntity.ok(logs);
    }

    @GetMapping("/resource/{resourceType}/{resourceId}")
    public ResponseEntity<List<AuditLog>> getLogsByResource(@PathVariable String resourceType,
                                                              @PathVariable Long resourceId) {
        log.info("获取资源操作历史: {} - {}", resourceType, resourceId);
        List<AuditLog> logs = auditLogService.getLogsByResource(resourceType, resourceId);
        return ResponseEntity.ok(logs);
    }

    @GetMapping("/search")
    public ResponseEntity<List<AuditLog>> searchLogs(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String module,
            @RequestParam(required = false) String operationType,
            @RequestParam(required = false) String riskLevel,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startTime,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endTime,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        log.info("搜索审计日志: keyword={}, module={}, page={}, size={}",
                keyword, module, page, size);
        List<AuditLog> logs = auditLogService.searchLogs(
                keyword, module, operationType, riskLevel, status, userId, startTime, endTime, page, size
        );
        return ResponseEntity.ok(logs);
    }

    @GetMapping("/statistics")
    public ResponseEntity<Map<String, Object>> getStatistics() {
        log.info("获取日志统计信息");
        Map<String, Object> stats = auditLogService.getStatistics();
        return ResponseEntity.ok(stats);
    }

    @GetMapping("/recent-activities")
    public ResponseEntity<List<Map<String, Object>>> getRecentActivities(
            @RequestParam(defaultValue = "50") int limit) {
        log.info("获取最近活动: limit={}", limit);
        List<Map<String, Object>> activities = auditLogService.getRecentActivities(limit);
        return ResponseEntity.ok(activities);
    }

    @GetMapping("/history/{resourceType}/{resourceId}")
    public ResponseEntity<List<Map<String, Object>>> getOperationHistory(
            @PathVariable String resourceType,
            @PathVariable Long resourceId) {
        log.info("获取资源操作历史: {} - {}", resourceType, resourceId);
        List<Map<String, Object>> history = auditLogService.getOperationHistory(resourceType, resourceId);
        return ResponseEntity.ok(history);
    }

    @GetMapping("/user/{userId}/report")
    public ResponseEntity<Map<String, Object>> getUserActivityReport(
            @PathVariable Long userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startTime,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endTime) {
        log.info("获取用户活动报告: userId={}", userId);
        Map<String, Object> report = auditLogService.getUserActivityReport(userId, startTime, endTime);
        return ResponseEntity.ok(report);
    }

    @GetMapping("/alerts/high-risk")
    public ResponseEntity<List<Map<String, Object>>> getHighRiskAlerts(
            @RequestParam(defaultValue = "100") int limit) {
        log.info("获取高风险操作告警: limit={}", limit);
        List<Map<String, Object>> alerts = auditLogService.getHighRiskAlerts(limit);
        return ResponseEntity.ok(alerts);
    }

    @PostMapping("/change")
    public ResponseEntity<Map<String, Object>> recordChange(@RequestBody Map<String, Object> request) {
        Long userId = Long.parseLong(request.get("userId").toString());
        String username = (String) request.get("username");
        String userRealName = (String) request.get("userRealName");
        String resourceType = (String) request.get("resourceType");
        Long resourceId = Long.parseLong(request.get("resourceId").toString());
        String resourceName = (String) request.get("resourceName");
        String operation = (String) request.get("operation");
        String beforeData = (String) request.get("beforeData");
        String afterData = (String) request.get("afterData");
        String changeDescription = (String) request.get("changeDescription");

        log.info("记录数据变更: {} - {}", operation, resourceName);
        auditLogService.recordChange(userId, username, userRealName, resourceType, resourceId,
                resourceName, operation, beforeData, afterData, changeDescription);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "变更记录已保存"
        ));
    }

    @PostMapping("/error")
    public ResponseEntity<Map<String, Object>> recordError(@RequestBody Map<String, Object> request) {
        Long userId = request.get("userId") != null ? Long.parseLong(request.get("userId").toString()) : null;
        String username = (String) request.get("username");
        String userRealName = (String) request.get("userRealName");
        String requestPath = (String) request.get("requestPath");
        String method = (String) request.get("method");
        Integer statusCode = request.get("statusCode") != null ?
                Integer.parseInt(request.get("statusCode").toString()) : 500;
        String errorMessage = (String) request.get("errorMessage");
        String errorStack = (String) request.get("errorStack");
        Long executionTime = request.get("executionTime") != null ?
                Long.parseLong(request.get("executionTime").toString()) : 0L;
        String clientIp = (String) request.get("clientIp");
        String userAgent = (String) request.get("userAgent");

        log.info("记录错误日志: {} - {}", requestPath, errorMessage);
        auditLogService.recordError(userId, username, userRealName, requestPath, method,
                statusCode, errorMessage, errorStack, executionTime, clientIp, userAgent);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "错误日志已保存"
        ));
    }

    @GetMapping("/recent")
    public ResponseEntity<List<AuditLog>> getRecentLogs(
            @RequestParam(defaultValue = "100") int limit) {
        log.info("获取最近日志: limit={}", limit);
        List<AuditLog> logs = auditLogService.getRecentLogs(limit);
        return ResponseEntity.ok(logs);
    }

    @DeleteMapping("/cleanup")
    public ResponseEntity<Map<String, Object>> cleanupOldLogs(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime before) {
        log.info("清理 {} 之前的日志", before);
        auditLogService.clearOldLogs(before);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "日志清理完成",
                "before", before.toString()
        ));
    }
}

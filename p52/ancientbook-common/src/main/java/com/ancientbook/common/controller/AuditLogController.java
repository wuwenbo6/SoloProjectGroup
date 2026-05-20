package com.ancientbook.common.controller;

import com.ancientbook.common.entity.AuditLog;
import com.ancientbook.common.service.AuditLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/audit")
@RequiredArgsConstructor
public class AuditLogController {

    private final AuditLogService auditLogService;

    @GetMapping("/logs")
    public Map<String, Object> queryLogs(
            @RequestParam(required = false) String module,
            @RequestParam(required = false) String operation,
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) String bookCode,
            @RequestParam(required = false) Long workerId,
            @RequestParam(required = false) String operationType,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss") LocalDateTime startTime,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss") LocalDateTime endTime,
            @RequestParam(required = false) Integer status,
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "20") Integer pageSize) {

        List<AuditLog> logs = auditLogService.queryLogs(
                module, operation, userId, bookCode, workerId, operationType,
                startTime, endTime, status, pageNum, pageSize);
        long total = auditLogService.countLogs(
                module, operation, userId, bookCode, workerId, operationType,
                startTime, endTime, status);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("logs", logs);
        result.put("total", total);
        result.put("pageNum", pageNum);
        result.put("pageSize", pageSize);
        return result;
    }

    @GetMapping("/logs/{logId}")
    public AuditLog getLogById(@PathVariable String logId) {
        return auditLogService.getLogById(logId);
    }

    @GetMapping("/statistics")
    public Map<String, Object> getAuditStatistics() {
        return auditLogService.getAuditStatistics();
    }

    @GetMapping("/worker-stats")
    public List<Map<String, Object>> getWorkerOperationStats(
            @RequestParam(required = false) Long workerId,
            @RequestParam(defaultValue = "30") int days) {
        return auditLogService.getWorkerOperationStats(workerId, days);
    }

    @GetMapping("/book-history/{bookCode}")
    public List<Map<String, Object>> getBookRepairHistory(@PathVariable String bookCode) {
        return auditLogService.getBookRepairHistory(bookCode);
    }

    @PostMapping("/mock-data")
    public Map<String, Object> generateMockData(@RequestParam(defaultValue = "500") int count) {
        auditLogService.generateMockData(count);
        return Map.of(
                "success", true,
                "message", "成功生成" + count + "条模拟审计日志"
        );
    }
}

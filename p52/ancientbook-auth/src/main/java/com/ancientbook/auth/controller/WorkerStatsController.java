package com.ancientbook.auth.controller;

import com.ancientbook.auth.dto.TaskRecordDTO;
import com.ancientbook.auth.dto.WorkerStatsDTO;
import com.ancientbook.auth.service.WorkerStatsService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/stats/worker")
@RequiredArgsConstructor
public class WorkerStatsController {

    private final WorkerStatsService workerStatsService;

    @GetMapping("/list")
    public List<WorkerStatsDTO> getAllWorkerStats() {
        return workerStatsService.getAllWorkerStats();
    }

    @GetMapping("/{workerId}")
    public WorkerStatsDTO getWorkerStatsById(@PathVariable Long workerId) {
        return workerStatsService.getWorkerStatsById(workerId);
    }

    @GetMapping("/records")
    public Map<String, Object> queryTaskRecords(
            @RequestParam(required = false) Long workerId,
            @RequestParam(required = false) String bookType,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss") LocalDateTime startTime,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss") LocalDateTime endTime,
            @RequestParam(required = false) Integer processType,
            @RequestParam(required = false) Integer status,
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "20") Integer pageSize) {

        List<TaskRecordDTO> records = workerStatsService.queryTaskRecords(
                workerId, bookType, startTime, endTime, processType, status, pageNum, pageSize);
        long total = workerStatsService.countTaskRecords(
                workerId, bookType, startTime, endTime, processType, status);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("records", records);
        result.put("total", total);
        result.put("pageNum", pageNum);
        result.put("pageSize", pageSize);
        return result;
    }

    @GetMapping("/summary")
    public Map<String, Object> getStatsSummary() {
        return workerStatsService.getStatsSummary();
    }

    @GetMapping("/trend")
    public List<Map<String, Object>> getMonthlyTrend(
            @RequestParam(defaultValue = "12") int months) {
        return workerStatsService.getMonthlyTrend(months);
    }
}

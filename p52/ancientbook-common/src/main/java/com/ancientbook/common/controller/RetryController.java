package com.ancientbook.common.controller;

import com.ancientbook.common.retry.RetryableExecutor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/retry")
@RequiredArgsConstructor
public class RetryController {

    private final RetryableExecutor retryableExecutor;

    @GetMapping("/circuit-breakers")
    public Map<String, Object> getCircuitBreakers() {
        Map<String, RetryableExecutor.CircuitBreakerStats> stats = retryableExecutor.getCircuitBreakerStats();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalBreakers", stats.size());
        result.put("breakerStats", stats);

        long openCount = stats.values().stream().filter(s -> "OPEN".equals(s.state())).count();
        long halfOpenCount = stats.values().stream().filter(s -> "HALF_OPEN".equals(s.state())).count();
        long closedCount = stats.values().stream().filter(s -> "CLOSED".equals(s.state())).count();

        result.put("openCount", openCount);
        result.put("halfOpenCount", halfOpenCount);
        result.put("closedCount", closedCount);

        return result;
    }

    @PostMapping("/circuit-breakers/{operationName}/reset")
    public Map<String, Object> resetCircuitBreaker(@PathVariable String operationName) {
        retryableExecutor.resetCircuitBreaker(operationName);
        return Map.of(
                "success", true,
                "message", "熔断器已重置: " + operationName
        );
    }

    @GetMapping("/strategies")
    public Map<String, Object> getRetryStrategies() {
        Map<String, Object> strategies = new LinkedHashMap<>();

        strategies.put("default", Map.of(
                "maxRetries", 3,
                "initialDelay", "100ms",
                "maxDelay", "5000ms",
                "backoffStrategy", "EXPONENTIAL"
        ));

        strategies.put("aggressive", Map.of(
                "maxRetries", 5,
                "initialDelay", "50ms",
                "maxDelay", "2000ms",
                "backoffStrategy", "LINEAR"
        ));

        strategies.put("conservative", Map.of(
                "maxRetries", 2,
                "initialDelay", "500ms",
                "maxDelay", "10000ms",
                "backoffStrategy", "FIXED"
        ));

        strategies.put("backoffTypes", RetryableExecutor.BackoffStrategy.values());

        return strategies;
    }

    @PostMapping("/test")
    public Map<String, Object> testRetry(
            @RequestParam(defaultValue = "3") int failCount,
            @RequestParam(defaultValue = "test-operation") String operationName) {

        int[] counter = {0};
        long startTime = System.currentTimeMillis();

        try {
            String result = retryableExecutor.executeWithRetry(() -> {
                counter[0]++;
                if (counter[0] <= failCount) {
                    throw new RuntimeException("模拟失败，第 " + counter[0] + " 次");
                }
                return "操作成功，共尝试 " + counter[0] + " 次";
            }, operationName);

            long totalTime = System.currentTimeMillis() - startTime;

            return Map.of(
                    "success", true,
                    "result", result,
                    "attempts", counter[0],
                    "totalTimeMs", totalTime
            );

        } catch (Exception e) {
            return Map.of(
                    "success", false,
                    "error", e.getMessage(),
                    "attempts", counter[0]
            );
        }
    }

    @PostMapping("/test-circuit")
    public Map<String, Object> testCircuitBreaker(
            @RequestParam(defaultValue = "15") int failCount,
            @RequestParam(defaultValue = "test-circuit") String operationName) {

        int successCount = 0;
        int rejectedCount = 0;

        for (int i = 0; i < failCount; i++) {
            try {
                retryableExecutor.executeWithRetry(() -> {
                    throw new RuntimeException("模拟失败");
                }, operationName);
            } catch (RetryableExecutor.CircuitBreakerOpenException e) {
                rejectedCount++;
            } catch (Exception e) {
                successCount++;
            }
        }

        Map<String, RetryableExecutor.CircuitBreakerStats> stats = retryableExecutor.getCircuitBreakerStats();
        RetryableExecutor.CircuitBreakerStats breakerStats = stats.get(operationName);

        return Map.of(
                "operationName", operationName,
                "totalAttempts", failCount,
                "failedBeforeOpen", successCount,
                "rejectedAfterOpen", rejectedCount,
                "breakerState", breakerStats != null ? breakerStats.state() : "UNKNOWN"
        );
    }
}

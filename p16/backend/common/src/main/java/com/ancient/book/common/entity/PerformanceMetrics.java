package com.ancient.book.common.entity;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Data
public class PerformanceMetrics {

    private LocalDateTime timestamp;
    private Map<String, ServiceMetrics> serviceMetrics = new ConcurrentHashMap<>();
    private MemoryMetrics memoryMetrics;
    private ThreadMetrics threadMetrics;
    private GarbageCollectionMetrics gcMetrics;

    @Data
    public static class ServiceMetrics {
        private String serviceName;
        private AtomicLong totalRequests = new AtomicLong(0);
        private AtomicLong successCount = new AtomicLong(0);
        private AtomicLong failureCount = new AtomicLong(0);
        private AtomicLong totalLatency = new AtomicLong(0);
        private AtomicLong maxLatency = new AtomicLong(0);
        private AtomicLong minLatency = new AtomicLong(Long.MAX_VALUE);
        private double avgLatency;
        private double p50Latency;
        private double p95Latency;
        private double p99Latency;
        private double errorRate;
        private double requestsPerSecond;
    }

    @Data
    public static class MemoryMetrics {
        private long totalMemory;
        private long freeMemory;
        private long usedMemory;
        private long maxMemory;
        private double usagePercent;
        private long offHeapUsed;
    }

    @Data
    public static class ThreadMetrics {
        private int totalThreads;
        private int activeThreads;
        private int peakThreads;
        private int daemonThreads;
        private int deadlockedThreads;
    }

    @Data
    public static class GarbageCollectionMetrics {
        private long youngGcCount;
        private long youngGcTime;
        private long oldGcCount;
        private long oldGcTime;
        private long totalGcTime;
        private double avgGcTime;
    }

    public void recordRequest(String serviceName, long latency, boolean success) {
        ServiceMetrics metrics = serviceMetrics.computeIfAbsent(
                serviceName, k -> new ServiceMetrics()
        );

        metrics.getTotalRequests().incrementAndGet();
        metrics.getTotalLatency().addAndGet(latency);

        if (success) {
            metrics.getSuccessCount().incrementAndGet();
        } else {
            metrics.getFailureCount().incrementAndGet();
        }

        metrics.getMaxLatency().accumulateAndGet(latency, Math::max);
        metrics.getMinLatency().accumulateAndGet(latency, Math::min);

        calculateDerivedMetrics(metrics);
    }

    private void calculateDerivedMetrics(ServiceMetrics metrics) {
        long total = metrics.getTotalRequests().get();
        long success = metrics.getSuccessCount().get();
        long latency = metrics.getTotalLatency().get();

        if (total > 0) {
            metrics.setAvgLatency((double) latency / total);
            metrics.setErrorRate((double) (total - success) / total * 100);
        }
    }
}

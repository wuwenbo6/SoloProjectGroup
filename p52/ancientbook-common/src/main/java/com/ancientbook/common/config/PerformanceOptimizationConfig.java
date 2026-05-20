package com.ancientbook.common.config;

import com.ancientbook.common.async.AsyncTaskExecutor;
import com.ancientbook.common.cache.MultiLevelCacheManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.annotation.PostConstruct;
import java.util.LinkedHashMap;
import java.util.Map;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class PerformanceOptimizationConfig {

    private final MultiLevelCacheManager cacheManager;
    private final AsyncTaskExecutor asyncExecutor;

    @PostConstruct
    public void init() {
        log.info("性能优化组件初始化完成");
        log.info("多级缓存: L1=10000, L2=50000");
        log.info("异步线程池: 核心={}, IO={}",
                Runtime.getRuntime().availableProcessors() * 2,
                Runtime.getRuntime().availableProcessors() * 4);
    }

    @RestController
    @RequestMapping("/api/performance")
    @RequiredArgsConstructor
    public static class PerformanceController {

        private final MultiLevelCacheManager cacheManager;
        private final AsyncTaskExecutor asyncExecutor;

        @GetMapping("/cache-stats")
        public Map<String, Object> getCacheStats() {
            MultiLevelCacheManager.CacheStats stats = cacheManager.getStats();
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("l1CacheSize", stats.l1Size());
            result.put("l2CacheSize", stats.l2Size());
            result.put("hitCount", stats.hitCount());
            result.put("missCount", stats.missCount());
            result.put("hitRate", String.format("%.2f%%", stats.hitRate()));
            result.put("totalRequests", stats.hitCount() + stats.missCount());
            return result;
        }

        @GetMapping("/executor-stats")
        public Map<String, Object> getExecutorStats() {
            AsyncTaskExecutor.ExecutorStats stats = asyncExecutor.getStats();
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("coreActiveCount", stats.coreActiveCount());
            result.put("coreQueueSize", stats.coreQueueSize());
            result.put("coreCompletedTasks", stats.coreCompletedTasks());
            result.put("ioActiveCount", stats.ioActiveCount());
            result.put("ioQueueSize", stats.ioQueueSize());
            result.put("ioCompletedTasks", stats.ioCompletedTasks());
            result.put("totalTasks", stats.totalTasks());
            result.put("failedTasks", stats.failedTasks());
            result.put("successRate", stats.totalTasks() > 0 ?
                    String.format("%.2f%%", (double) (stats.totalTasks() - stats.failedTasks()) / stats.totalTasks() * 100) :
                    "100.00%");
            return result;
        }

        @GetMapping("/task-stats")
        public Map<String, AsyncTaskExecutor.TaskStats> getTaskStats() {
            return asyncExecutor.getTaskStats();
        }

        @GetMapping("/optimization-summary")
        public Map<String, Object> getOptimizationSummary() {
            Map<String, Object> summary = new LinkedHashMap<>();

            MultiLevelCacheManager.CacheStats cacheStats = cacheManager.getStats();
            AsyncTaskExecutor.ExecutorStats executorStats = asyncExecutor.getStats();

            Map<String, Object> cacheInfo = new LinkedHashMap<>();
            cacheInfo.put("levels", "L1+L2");
            cacheInfo.put("l1Capacity", 10000);
            cacheInfo.put("l2Capacity", 50000);
            cacheInfo.put("l1Size", cacheStats.l1Size());
            cacheInfo.put("l2Size", cacheStats.l2Size());
            cacheInfo.put("hitRate", String.format("%.2f%%", cacheStats.hitRate()));
            summary.put("cache", cacheInfo);

            Map<String, Object> executorInfo = new LinkedHashMap<>();
            executorInfo.put("corePoolSize", Runtime.getRuntime().availableProcessors() * 2);
            executorInfo.put("ioPoolSize", Runtime.getRuntime().availableProcessors() * 4);
            executorInfo.put("coreActive", executorStats.coreActiveCount());
            executorInfo.put("ioActive", executorStats.ioActiveCount());
            executorInfo.put("totalQueued", executorStats.coreQueueSize() + executorStats.ioQueueSize());
            summary.put("asyncExecutor", executorInfo);

            Map<String, Object> connectionPoolInfo = new LinkedHashMap<>();
            connectionPoolInfo.put("databasePoolSize", 100);
            connectionPoolInfo.put("redisPoolSize", 50);
            connectionPoolInfo.put("httpClientPoolSize", 200);
            summary.put("connectionPools", connectionPoolInfo);

            return summary;
        }
    }
}

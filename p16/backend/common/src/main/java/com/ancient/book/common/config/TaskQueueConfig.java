package com.ancient.book.common.config;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import jakarta.annotation.PostConstruct;

@Slf4j
@Data
@Configuration
@ConfigurationProperties(prefix = "task.queue")
public class TaskQueueConfig {

    private int maxConcurrentTasks = 8;
    private int maxQueueSize = 1000;
    private long taskTimeoutMinutes = 60;
    private long idleWorkerKeepAliveSeconds = 300;
    private boolean enablePriority = true;
    private boolean enableRetry = true;
    private int defaultMaxRetries = 3;
    private long retryDelayMs = 5000;
    private boolean enableTaskDependency = true;
    private boolean enableTaskPersistence = false;
    private String persistencePath = "./task-persistence";
    private boolean enableTaskProgressReport = true;
    private long progressReportIntervalMs = 1000;
    private boolean enableTaskMonitoring = true;
    private long monitoringIntervalMs = 5000;
    private boolean enableTaskMetrics = true;
    private int maxHistorySize = 10000;
    private boolean enableAutoScaling = true;
    private int minWorkers = 2;
    private int maxWorkers = 16;
    private int scaleUpThreshold = 80;
    private int scaleDownThreshold = 20;
    private boolean enableTaskTimeout = true;
    private boolean enableDeadLetterQueue = true;
    private int deadLetterThreshold = 3;

    @PostConstruct
    public void init() {
        log.info("任务队列配置初始化完成:");
        log.info("  最大并发任务: {}", maxConcurrentTasks);
        log.info("  最大队列大小: {}", maxQueueSize);
        log.info("  任务超时: {}分钟", taskTimeoutMinutes);
        log.info("  优先级启用: {}", enablePriority);
        log.info("  重试启用: {} (最大{}次, 间隔{}ms)",
                enableRetry, defaultMaxRetries, retryDelayMs);
        log.info("  工作线程范围: {}-{}, 扩缩容阈值: {}%-{}%",
                minWorkers, maxWorkers, scaleDownThreshold, scaleUpThreshold);
        log.info("  死信队列启用: {} (阈值{}次)",
                enableDeadLetterQueue, deadLetterThreshold);
    }
}

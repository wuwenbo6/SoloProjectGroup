package com.ancientbook.common.async;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;
import java.util.Map;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

@Slf4j
@Component
public class AsyncTaskExecutor {

    private ThreadPoolExecutor coreExecutor;
    private ThreadPoolExecutor ioExecutor;
    private final ScheduledExecutorService monitorExecutor = Executors.newSingleThreadScheduledExecutor();

    private final Map<String, TaskStats> taskStatsMap = new ConcurrentHashMap<>();
    private final AtomicLong totalTasks = new AtomicLong(0);
    private final AtomicLong failedTasks = new AtomicLong(0);

    @PostConstruct
    public void init() {
        int corePoolSize = Runtime.getRuntime().availableProcessors();

        coreExecutor = new ThreadPoolExecutor(
                corePoolSize,
                corePoolSize * 2,
                60L, TimeUnit.SECONDS,
                new LinkedBlockingQueue<>(10000),
                new NamedThreadFactory("core-task"),
                new ThreadPoolExecutor.CallerRunsPolicy()
        );

        ioExecutor = new ThreadPoolExecutor(
                corePoolSize * 2,
                corePoolSize * 4,
                60L, TimeUnit.SECONDS,
                new LinkedBlockingQueue<>(50000),
                new NamedThreadFactory("io-task"),
                new ThreadPoolExecutor.CallerRunsPolicy()
        );

        monitorExecutor.scheduleAtFixedRate(this::printExecutorStats, 60, 60, TimeUnit.SECONDS);

        log.info("异步任务执行器初始化完成，核心线程池: {}, IO线程池: {}",
                corePoolSize, corePoolSize * 4);
    }

    @PreDestroy
    public void shutdown() {
        log.info("关闭异步任务执行器...");
        coreExecutor.shutdown();
        ioExecutor.shutdown();
        monitorExecutor.shutdown();
    }

    public CompletableFuture<Void> executeCoreTask(Runnable task, String taskName) {
        return CompletableFuture.runAsync(() -> {
            long startTime = System.currentTimeMillis();
            try {
                task.run();
                recordSuccess(taskName, startTime);
            } catch (Exception e) {
                recordFailure(taskName, startTime, e);
                throw e;
            }
        }, coreExecutor);
    }

    public <T> CompletableFuture<T> submitCoreTask(Callable<T> task, String taskName) {
        return CompletableFuture.supplyAsync(() -> {
            long startTime = System.currentTimeMillis();
            try {
                T result = task.call();
                recordSuccess(taskName, startTime);
                return result;
            } catch (Exception e) {
                recordFailure(taskName, startTime, e);
                throw new CompletionException(e);
            }
        }, coreExecutor);
    }

    public CompletableFuture<Void> executeIOTask(Runnable task, String taskName) {
        return CompletableFuture.runAsync(() -> {
            long startTime = System.currentTimeMillis();
            try {
                task.run();
                recordSuccess(taskName, startTime);
            } catch (Exception e) {
                recordFailure(taskName, startTime, e);
                throw e;
            }
        }, ioExecutor);
    }

    public <T> CompletableFuture<T> submitIOTask(Callable<T> task, String taskName) {
        return CompletableFuture.supplyAsync(() -> {
            long startTime = System.currentTimeMillis();
            try {
                T result = task.call();
                recordSuccess(taskName, startTime);
                return result;
            } catch (Exception e) {
                recordFailure(taskName, startTime, e);
                throw new CompletionException(e);
            }
        }, ioExecutor);
    }

    private void recordSuccess(String taskName, long startTime) {
        long duration = System.currentTimeMillis() - startTime;
        TaskStats stats = taskStatsMap.computeIfAbsent(taskName, k -> new TaskStats());
        stats.recordSuccess(duration);
        totalTasks.incrementAndGet();
    }

    private void recordFailure(String taskName, long startTime, Exception e) {
        long duration = System.currentTimeMillis() - startTime;
        TaskStats stats = taskStatsMap.computeIfAbsent(taskName, k -> new TaskStats());
        stats.recordFailure(duration);
        failedTasks.incrementAndGet();
        log.error("任务执行失败: taskName={}, duration={}ms", taskName, duration, e);
    }

    private void printExecutorStats() {
        log.info("=== 异步任务执行器统计 ===");
        log.info("核心线程池 - 活跃: {}, 队列: {}, 完成: {}",
                coreExecutor.getActiveCount(),
                coreExecutor.getQueue().size(),
                coreExecutor.getCompletedTaskCount());
        log.info("IO线程池 - 活跃: {}, 队列: {}, 完成: {}",
                ioExecutor.getActiveCount(),
                ioExecutor.getQueue().size(),
                ioExecutor.getCompletedTaskCount());
        log.info("总任务数: {}, 失败数: {}", totalTasks.get(), failedTasks.get());
    }

    public ExecutorStats getStats() {
        return new ExecutorStats(
                coreExecutor.getActiveCount(),
                coreExecutor.getQueue().size(),
                coreExecutor.getCompletedTaskCount(),
                ioExecutor.getActiveCount(),
                ioExecutor.getQueue().size(),
                ioExecutor.getCompletedTaskCount(),
                totalTasks.get(),
                failedTasks.get()
        );
    }

    public Map<String, TaskStats> getTaskStats() {
        return new ConcurrentHashMap<>(taskStatsMap);
    }

    private static class NamedThreadFactory implements ThreadFactory {
        private final String prefix;
        private final AtomicInteger counter = new AtomicInteger(0);

        public NamedThreadFactory(String prefix) {
            this.prefix = prefix;
        }

        @Override
        public Thread newThread(Runnable r) {
            Thread t = new Thread(r, prefix + "-" + counter.incrementAndGet());
            t.setDaemon(false);
            return t;
        }
    }

    public static class TaskStats {
        private final AtomicLong successCount = new AtomicLong(0);
        private final AtomicLong failureCount = new AtomicLong(0);
        private final AtomicLong totalDuration = new AtomicLong(0);
        private final AtomicLong maxDuration = new AtomicLong(0);

        public void recordSuccess(long duration) {
            successCount.incrementAndGet();
            totalDuration.addAndGet(duration);
            maxDuration.accumulateAndGet(duration, Math::max);
        }

        public void recordFailure(long duration) {
            failureCount.incrementAndGet();
            totalDuration.addAndGet(duration);
        }

        public long getSuccessCount() { return successCount.get(); }
        public long getFailureCount() { return failureCount.get(); }
        public double getAvgDuration() {
            long total = successCount.get() + failureCount.get();
            return total > 0 ? (double) totalDuration.get() / total : 0;
        }
        public long getMaxDuration() { return maxDuration.get(); }
    }

    public record ExecutorStats(
            int coreActiveCount,
            int coreQueueSize,
            long coreCompletedTasks,
            int ioActiveCount,
            int ioQueueSize,
            long ioCompletedTasks,
            long totalTasks,
            long failedTasks
    ) {}
}

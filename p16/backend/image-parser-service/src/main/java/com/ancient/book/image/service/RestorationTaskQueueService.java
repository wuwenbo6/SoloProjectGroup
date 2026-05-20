package com.ancient.book.image.service;

import com.ancient.book.common.config.TaskQueueConfig;
import com.ancient.book.common.entity.RestorationTask;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Function;

@Slf4j
@Service
@RequiredArgsConstructor
public class RestorationTaskQueueService {

    private final TaskQueueConfig queueConfig;

    private final PriorityBlockingQueue<RestorationTask> taskQueue;
    private final Map<String, RestorationTask> taskMap = new ConcurrentHashMap<>();
    private final Map<String, RestorationTask> completedTasks = new ConcurrentHashMap<>();
    private final Queue<RestorationTask> deadLetterQueue = new ConcurrentLinkedQueue<>();

    private ThreadPoolExecutor taskExecutor;
    private ScheduledExecutorService monitoringExecutor;
    private ScheduledExecutorService progressExecutor;

    private final AtomicLong totalTasksSubmitted = new AtomicLong(0);
    private final AtomicLong totalTasksCompleted = new AtomicLong(0);
    private final AtomicLong totalTasksFailed = new AtomicLong(0);
    private final AtomicLong totalProcessingTimeMs = new AtomicLong(0);

    private final Map<String, Function<RestorationTask, Map<String, Object>>> taskHandlers = new ConcurrentHashMap<>();

    public RestorationTaskQueueService(TaskQueueConfig queueConfig) {
        this.queueConfig = queueConfig;
        this.taskQueue = new PriorityBlockingQueue<>(
                queueConfig.getMaxQueueSize(),
                Comparator.comparingInt((RestorationTask t) ->
                    t.getPriority().getLevel()).reversed()
        );
    }

    @PostConstruct
    public void init() {
        log.info("初始化古籍修复任务队列服务...");

        taskExecutor = new ThreadPoolExecutor(
                queueConfig.getMinWorkers(),
                queueConfig.getMaxWorkers(),
                queueConfig.getIdleWorkerKeepAliveSeconds(),
                TimeUnit.SECONDS,
                new LinkedBlockingQueue<>(),
                new ThreadPoolExecutor.CallerRunsPolicy()
        );

        monitoringExecutor = Executors.newSingleThreadScheduledExecutor();
        progressExecutor = Executors.newSingleThreadScheduledExecutor();

        registerDefaultTaskHandlers();
        startMonitoring();
        startTaskProcessingLoop();

        log.info("古籍修复任务队列服务初始化完成: 工作线程={}-{}, 队列容量={}",
                queueConfig.getMinWorkers(),
                queueConfig.getMaxWorkers(),
                queueConfig.getMaxQueueSize());
    }

    @PreDestroy
    public void shutdown() {
        log.info("关闭任务队列服务...");

        taskExecutor.shutdown();
        monitoringExecutor.shutdown();
        progressExecutor.shutdown();

        try {
            if (!taskExecutor.awaitTermination(60, TimeUnit.SECONDS)) {
                taskExecutor.shutdownNow();
            }
        } catch (InterruptedException e) {
            taskExecutor.shutdownNow();
            Thread.currentThread().interrupt();
        }

        log.info("任务队列服务已关闭");
    }

    private void registerDefaultTaskHandlers() {
        taskHandlers.put("IMAGE_ENHANCEMENT", this::handleImageEnhancement);
        taskHandlers.put("OCR_RECOGNITION", this::handleOcrRecognition);
        taskHandlers.put("TEXT_RESTORATION", this::handleTextRestoration);
        taskHandlers.put("STAIN_REMOVAL", this::handleStainRemoval);
        taskHandlers.put("HOLE_INPAINTING", this::handleHoleInpainting);
        taskHandlers.put("COLORIZATION", this::handleColorization);
        taskHandlers.put("BATCH_EXPORT", this::handleBatchExport);
        taskHandlers.put("QUALITY_CHECK", this::handleQualityCheck);
        taskHandlers.put("TEXT_SEGMENTATION", this::handleTextSegmentation);
        taskHandlers.put("DIALECT_CONVERSION", this::handleDialectConversion);

        log.info("已注册 {} 个任务处理器", taskHandlers.size());
    }

    private void startMonitoring() {
        if (!queueConfig.isEnableTaskMonitoring()) {
            return;
        }

        monitoringExecutor.scheduleAtFixedRate(
                this::monitorTaskQueue,
                queueConfig.getMonitoringIntervalMs(),
                queueConfig.getMonitoringIntervalMs(),
                TimeUnit.MILLISECONDS
        );
    }

    private void monitorTaskQueue() {
        int queueSize = taskQueue.size();
        int activeCount = taskExecutor.getActiveCount();
        int poolSize = taskExecutor.getPoolSize();
        long completedCount = taskExecutor.getCompletedTaskCount();

        log.debug("任务队列监控: 队列大小={}, 活跃线程={}, 池大小={}, 已完成={}",
                queueSize, activeCount, poolSize, completedCount);

        if (queueConfig.isEnableAutoScaling()) {
            autoScaleWorkers(queueSize, poolSize);
        }

        checkTaskTimeouts();
        cleanupCompletedTasks();
    }

    private void autoScaleWorkers(int queueSize, int currentPoolSize) {
        double loadPercent = (double) queueSize / queueConfig.getMaxQueueSize() * 100;

        if (loadPercent > queueConfig.getScaleUpThreshold() &&
            currentPoolSize < queueConfig.getMaxWorkers()) {
            int newCoreSize = Math.min(currentPoolSize + 2, queueConfig.getMaxWorkers());
            taskExecutor.setCorePoolSize(newCoreSize);
            log.info("扩容工作线程: {} -> {} (队列负载: {}%)",
                    currentPoolSize, newCoreSize, String.format("%.1f", loadPercent));
        } else if (loadPercent < queueConfig.getScaleDownThreshold() &&
                   currentPoolSize > queueConfig.getMinWorkers()) {
            int newCoreSize = Math.max(currentPoolSize - 1, queueConfig.getMinWorkers());
            taskExecutor.setCorePoolSize(newCoreSize);
            log.info("缩容工作线程: {} -> {} (队列负载: {}%)",
                    currentPoolSize, newCoreSize, String.format("%.1f", loadPercent));
        }
    }

    private void checkTaskTimeouts() {
        if (!queueConfig.isEnableTaskTimeout()) {
            return;
        }

        long timeoutMs = queueConfig.getTaskTimeoutMinutes() * 60 * 1000;
        long now = System.currentTimeMillis();

        taskMap.values().stream()
                .filter(t -> t.getStatus() == RestorationTask.TaskStatus.RUNNING)
                .filter(t -> t.getStartTime() != null)
                .forEach(task -> {
                    long elapsedMs = java.time.Duration.between(
                            task.getStartTime(), LocalDateTime.now()).toMillis();
                    if (elapsedMs > timeoutMs) {
                        log.warn("任务超时: {} (已运行 {}ms)", task.getTaskId(), elapsedMs);
                        failTask(task.getTaskId(), "任务执行超时");
                    }
                });
    }

    private void cleanupCompletedTasks() {
        if (completedTasks.size() > queueConfig.getMaxHistorySize()) {
            int toRemove = completedTasks.size() - queueConfig.getMaxHistorySize() / 2;
            completedTasks.entrySet().stream()
                    .sorted(Comparator.comparing(e -> e.getValue().getEndTime()))
                    .limit(toRemove)
                    .forEach(e -> completedTasks.remove(e.getKey()));

            log.debug("清理历史任务记录, 移除 {} 条", toRemove);
        }
    }

    private void startTaskProcessingLoop() {
        CompletableFuture.runAsync(() -> {
            while (!Thread.currentThread().isInterrupted()) {
                try {
                    RestorationTask task = taskQueue.poll(1, TimeUnit.SECONDS);
                    if (task != null) {
                        processTask(task);
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                } catch (Exception e) {
                    log.error("任务处理循环异常", e);
                }
            }
        }, taskExecutor);
    }

    public String submitTask(RestorationTask task) {
        if (taskQueue.size() >= queueConfig.getMaxQueueSize()) {
            throw new RuntimeException("任务队列已满，请稍后重试");
        }

        task.setStatus(RestorationTask.TaskStatus.QUEUED);
        taskMap.put(task.getTaskId(), task);
        taskQueue.offer(task);

        totalTasksSubmitted.incrementAndGet();
        log.info("任务已提交: {} - {} (优先级: {})",
                task.getTaskId(), task.getTaskType(), task.getPriority());

        return task.getTaskId();
    }

    private void processTask(RestorationTask task) {
        taskExecutor.submit(() -> {
            try {
                executeTask(task);
            } catch (Exception e) {
                handleTaskException(task, e);
            }
        });
    }

    private void executeTask(RestorationTask task) {
        task.setStatus(RestorationTask.TaskStatus.RUNNING);
        task.setStartTime(LocalDateTime.now());
        task.setProgress(0);
        task.setMessage("任务开始执行");

        log.info("开始执行任务: {} - {}", task.getTaskId(), task.getTaskType());

        String handlerKey = task.getTaskType().name();
        Function<RestorationTask, Map<String, Object>> handler = taskHandlers.get(handlerKey);

        if (handler == null) {
            throw new RuntimeException("未找到任务处理器: " + handlerKey);
        }

        ScheduledFuture<?> progressReporter = startProgressReporting(task);

        try {
            Map<String, Object> result = handler.apply(task);
            completeTask(task, result);
        } finally {
            if (progressReporter != null) {
                progressReporter.cancel(false);
            }
        }
    }

    private ScheduledFuture<?> startProgressReporting(RestorationTask task) {
        if (!queueConfig.isEnableTaskProgressReport()) {
            return null;
        }

        return progressExecutor.scheduleAtFixedRate(
                () -> reportProgress(task),
                queueConfig.getProgressReportIntervalMs(),
                queueConfig.getProgressReportIntervalMs(),
                TimeUnit.MILLISECONDS
        );
    }

    private void reportProgress(RestorationTask task) {
        if (task.getStatus() != RestorationTask.TaskStatus.RUNNING) {
            return;
        }

        int currentProgress = task.getProgress();
        if (currentProgress < 90) {
            task.setProgress(Math.min(currentProgress + 10, 90));
            log.debug("任务进度: {} - {}%", task.getTaskId(), task.getProgress());
        }
    }

    private void completeTask(RestorationTask task, Map<String, Object> result) {
        task.setStatus(RestorationTask.TaskStatus.COMPLETED);
        task.setEndTime(LocalDateTime.now());
        task.setProgress(100);
        task.setResult(result);
        task.setMessage("任务完成");

        totalTasksCompleted.incrementAndGet();
        totalProcessingTimeMs.addAndGet(task.getDurationMs());

        completedTasks.put(task.getTaskId(), task);
        taskMap.remove(task.getTaskId());

        log.info("任务完成: {} - {} (耗时 {}ms)",
                task.getTaskId(), task.getTaskType(), task.getDurationMs());
    }

    private void handleTaskException(RestorationTask task, Exception e) {
        log.error("任务执行异常: {} - {}", task.getTaskId(), e.getMessage(), e);

        if (queueConfig.isEnableRetry() && task.canRetry()) {
            retryTask(task, e.getMessage());
        } else {
            failTask(task.getTaskId(), e.getMessage());

            if (queueConfig.isEnableDeadLetterQueue() &&
                task.getRetryCount() >= queueConfig.getDeadLetterThreshold()) {
                deadLetterQueue.offer(task);
                log.warn("任务移入死信队列: {}", task.getTaskId());
            }
        }
    }

    private void retryTask(RestorationTask task, String errorMessage) {
        task.setRetryCount(task.getRetryCount() + 1);
        task.setStatus(RestorationTask.TaskStatus.RETRYING);
        task.setMessage("重试中 (" + task.getRetryCount() + "/" + task.getMaxRetries() + "): " + errorMessage);

        log.info("任务重试: {} (第{}次)", task.getTaskId(), task.getRetryCount());

        CompletableFuture.delayedExecutor(
                queueConfig.getRetryDelayMs(), TimeUnit.MILLISECONDS
        ).execute(() -> {
            task.setStatus(RestorationTask.TaskStatus.QUEUED);
            taskQueue.offer(task);
        });
    }

    public boolean cancelTask(String taskId) {
        RestorationTask task = taskMap.get(taskId);
        if (task == null) {
            return false;
        }

        if (task.getStatus() == RestorationTask.TaskStatus.RUNNING) {
            task.setStatus(RestorationTask.TaskStatus.CANCELLED);
            task.setEndTime(LocalDateTime.now());
            task.setMessage("任务已取消");
            completedTasks.put(taskId, task);
            taskMap.remove(taskId);
            log.info("任务已取消: {}", taskId);
            return true;
        }

        if (taskQueue.remove(task)) {
            task.setStatus(RestorationTask.TaskStatus.CANCELLED);
            task.setMessage("任务已取消");
            completedTasks.put(taskId, task);
            taskMap.remove(taskId);
            log.info("任务已取消: {}", taskId);
            return true;
        }

        return false;
    }

    public boolean pauseTask(String taskId) {
        RestorationTask task = taskMap.get(taskId);
        if (task != null && task.getStatus() == RestorationTask.TaskStatus.RUNNING) {
            task.setStatus(RestorationTask.TaskStatus.PAUSED);
            task.setMessage("任务已暂停");
            log.info("任务已暂停: {}", taskId);
            return true;
        }
        return false;
    }

    public boolean resumeTask(String taskId) {
        RestorationTask task = taskMap.get(taskId);
        if (task != null && task.getStatus() == RestorationTask.TaskStatus.PAUSED) {
            task.setStatus(RestorationTask.TaskStatus.QUEUED);
            task.setMessage("任务已恢复");
            taskQueue.offer(task);
            log.info("任务已恢复: {}", taskId);
            return true;
        }
        return false;
    }

    private void failTask(String taskId, String errorMessage) {
        RestorationTask task = taskMap.get(taskId);
        if (task != null) {
            task.setStatus(RestorationTask.TaskStatus.FAILED);
            task.setEndTime(LocalDateTime.now());
            task.setErrorMessage(errorMessage);
            task.setMessage("任务失败: " + errorMessage);

            totalTasksFailed.incrementAndGet();
            completedTasks.put(taskId, task);
            taskMap.remove(taskId);

            log.error("任务失败: {} - {}", taskId, errorMessage);
        }
    }

    public RestorationTask getTaskStatus(String taskId) {
        RestorationTask task = taskMap.get(taskId);
        if (task != null) {
            return task;
        }
        return completedTasks.get(taskId);
    }

    public List<RestorationTask> getTasksByStatus(RestorationTask.TaskStatus status) {
        return taskMap.values().stream()
                .filter(t -> t.getStatus() == status)
                .sorted(Comparator.comparing(RestorationTask::getCreateTime).reversed())
                .toList();
    }

    public List<RestorationTask> getTasksByUser(Long userId) {
        return taskMap.values().stream()
                .filter(t -> userId.equals(t.getUserId()))
                .sorted(Comparator.comparing(RestorationTask::getCreateTime).reversed())
                .toList();
    }

    public Map<String, Object> getQueueStatistics() {
        Map<String, Object> stats = new ConcurrentHashMap<>();

        stats.put("totalTasksSubmitted", totalTasksSubmitted.get());
        stats.put("totalTasksCompleted", totalTasksCompleted.get());
        stats.put("totalTasksFailed", totalTasksFailed.get());
        stats.put("queueSize", taskQueue.size());
        stats.put("activeTasks", taskExecutor.getActiveCount());
        stats.put("poolSize", taskExecutor.getPoolSize());
        stats.put("completedTaskCount", taskExecutor.getCompletedTaskCount());
        stats.put("deadLetterQueueSize", deadLetterQueue.size());

        long total = totalTasksCompleted.get() + totalTasksFailed.get();
        double avgTime = total > 0 ? (double) totalProcessingTimeMs.get() / total : 0;
        stats.put("averageProcessingTimeMs", String.format("%.2f", avgTime));

        Map<String, Long> statusDistribution = new ConcurrentHashMap<>();
        for (RestorationTask.TaskStatus status : RestorationTask.TaskStatus.values()) {
            long count = taskMap.values().stream()
                    .filter(t -> t.getStatus() == status)
                    .count();
            if (count > 0) {
                statusDistribution.put(status.name(), count);
            }
        }
        stats.put("statusDistribution", statusDistribution);

        double successRate = total > 0 ?
                (double) totalTasksCompleted.get() / total * 100 : 100;
        stats.put("successRatePercent", String.format("%.2f", successRate));

        return stats;
    }

    private Map<String, Object> handleImageEnhancement(RestorationTask task) {
        simulateWork("图像增强", 2000);
        task.setProgress(100);

        Map<String, Object> result = new ConcurrentHashMap<>();
        result.put("enhancedImagePath", "/data/books/" + task.getBookId() + "/" + task.getPageId() + "_enhanced.jpg");
        result.put("qualityScore", 0.92);
        result.put("method", "ADAPTIVE_ENHANCEMENT");
        return result;
    }

    private Map<String, Object> handleOcrRecognition(RestorationTask task) {
        simulateWork("OCR识别", 3000);
        task.setProgress(100);

        Map<String, Object> result = new ConcurrentHashMap<>();
        result.put("recognizedText", "子曰：學而時習之，不亦說乎？");
        result.put("characterCount", 15);
        result.put("confidence", 0.95);
        result.put("language", "CLASSICAL_CHINESE");
        return result;
    }

    private Map<String, Object> handleTextRestoration(RestorationTask task) {
        simulateWork("文字修复", 4000);
        task.setProgress(100);

        Map<String, Object> result = new ConcurrentHashMap<>();
        result.put("restoredText", "修复后的文字内容");
        result.put("restoredCharCount", 8);
        result.put("confidence", 0.88);
        return result;
    }

    private Map<String, Object> handleStainRemoval(RestorationTask task) {
        simulateWork("污渍去除", 2500);
        task.setProgress(100);

        Map<String, Object> result = new ConcurrentHashMap<>();
        result.put("stainsRemoved", 5);
        result.put("restoredAreaPercent", 0.15);
        result.put("method", "INPAINTING");
        return result;
    }

    private Map<String, Object> handleHoleInpainting(RestorationTask task) {
        simulateWork("孔洞补全", 3500);
        task.setProgress(100);

        Map<String, Object> result = new ConcurrentHashMap<>();
        result.put("holesFilled", 3);
        result.put("restoredAreaPercent", 0.08);
        result.put("inpaintingMethod", "GAN_BASED");
        return result;
    }

    private Map<String, Object> handleColorization(RestorationTask task) {
        simulateWork("自动上色", 5000);
        task.setProgress(100);

        Map<String, Object> result = new ConcurrentHashMap<>();
        result.put("colorizedImagePath", "/data/books/" + task.getBookId() + "/" + task.getPageId() + "_color.jpg");
        result.put("colorPalette", "TRADITIONAL");
        return result;
    }

    private Map<String, Object> handleBatchExport(RestorationTask task) {
        simulateWork("批量导出", 6000);
        task.setProgress(100);

        Map<String, Object> result = new ConcurrentHashMap<>();
        result.put("exportPath", "/data/exports/" + task.getBookId() + "_export.zip");
        result.put("pageCount", 100);
        result.put("format", "PDF_WITH_OCR");
        result.put("fileSizeMb", 256);
        return result;
    }

    private Map<String, Object> handleQualityCheck(RestorationTask task) {
        simulateWork("质量检查", 1500);
        task.setProgress(100);

        Map<String, Object> result = new ConcurrentHashMap<>();
        result.put("overallScore", 0.91);
        result.put("clarityScore", 0.94);
        result.put("contrastScore", 0.88);
        result.put("noiseLevel", "LOW");
        result.put("recommendation", "通过");
        return result;
    }

    private Map<String, Object> handleTextSegmentation(RestorationTask task) {
        simulateWork("文本分割", 2000);
        task.setProgress(100);

        Map<String, Object> result = new ConcurrentHashMap<>();
        result.put("segmentCount", 25);
        result.put("columnCount", 10);
        result.put("rowCount", 20);
        result.put("layout", "TRADITIONAL_VERTICAL");
        return result;
    }

    private Map<String, Object> handleDialectConversion(RestorationTask task) {
        simulateWork("方言转换", 1800);
        task.setProgress(100);

        Map<String, Object> result = new ConcurrentHashMap<>();
        result.put("convertedText", "转换后的标准文字");
        result.put("variantCount", 3);
        result.put("dialectRegion", "吴语");
        return result;
    }

    private void simulateWork(String taskName, long workTimeMs) {
        try {
            Thread.sleep(workTimeMs);
            log.debug("模拟任务完成: {} (耗时 {}ms)", taskName, workTimeMs);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    public void registerTaskHandler(String taskType, Function<RestorationTask, Map<String, Object>> handler) {
        taskHandlers.put(taskType, handler);
        log.info("注册任务处理器: {}", taskType);
    }

    public List<RestorationTask> getDeadLetterQueueTasks() {
        return new ArrayList<>(deadLetterQueue);
    }

    public boolean reprocessDeadLetterTask(String taskId) {
        RestorationTask task = deadLetterQueue.stream()
                .filter(t -> t.getTaskId().equals(taskId))
                .findFirst()
                .orElse(null);

        if (task != null) {
            deadLetterQueue.remove(task);
            task.setRetryCount(0);
            task.setStatus(RestorationTask.TaskStatus.QUEUED);
            task.setErrorMessage(null);
            taskQueue.offer(task);
            log.info("死信任务重新排队: {}", taskId);
            return true;
        }
        return false;
    }

    public void clearDeadLetterQueue() {
        int count = deadLetterQueue.size();
        deadLetterQueue.clear();
        log.info("清空死信队列, 移除 {} 条任务", count);
    }

    public int getQueueSize() {
        return taskQueue.size();
    }

    public int getActiveTaskCount() {
        return taskExecutor.getActiveCount();
    }
}

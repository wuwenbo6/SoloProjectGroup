package com.ancient.book.image.service;

import com.ancient.book.common.config.AiModelMemoryConfig;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.RemovalCause;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import jakarta.annotation.PostConstruct;
import java.lang.ref.SoftReference;
import java.util.Map;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;

@Slf4j
@Component
@RequiredArgsConstructor
public class ModelPoolManager {

    private final AiModelMemoryConfig memoryConfig;

    private final Map<String, SoftReference<AiModelWrapper>> modelPool = new ConcurrentHashMap<>();
    private final Map<String, Long> lastAccessTime = new ConcurrentHashMap<>();
    private final Cache<String, Object> inferenceResultCache;
    private final Cache<String, Object> tensorPool;

    private final ScheduledExecutorService cleanupExecutor = Executors.newSingleThreadScheduledExecutor();
    private final Semaphore inferenceSemaphore;

    private final AtomicLong totalMemoryUsed = new AtomicLong(0);
    private final AtomicLong totalInferences = new AtomicLong(0);
    private final AtomicLong cacheHits = new AtomicLong(0);

    public ModelPoolManager(AiModelMemoryConfig memoryConfig) {
        this.memoryConfig = memoryConfig;
        this.inferenceSemaphore = new Semaphore(memoryConfig.getMaxConcurrentInferences());

        this.inferenceResultCache = Caffeine.newBuilder()
                .maximumSize(memoryConfig.getInputCacheSize())
                .expireAfterAccess(10, TimeUnit.MINUTES)
                .removalListener(this::onCacheRemoval)
                .build();

        this.tensorPool = Caffeine.newBuilder()
                .maximumSize(memoryConfig.getTensorPoolSize())
                .expireAfterAccess(5, TimeUnit.MINUTES)
                .build();
    }

    @PostConstruct
    public void init() {
        cleanupExecutor.scheduleAtFixedRate(
                this::cleanupIdleModels,
                memoryConfig.getModelIdleTimeoutMinutes(),
                memoryConfig.getModelIdleTimeoutMinutes(),
                TimeUnit.MINUTES
        );

        if (memoryConfig.isEnableGarbageCollection()) {
            cleanupExecutor.scheduleAtFixedRate(
                    this::performMemoryOptimization,
                    memoryConfig.getGcIntervalMinutes(),
                    memoryConfig.getGcIntervalMinutes(),
                    TimeUnit.MINUTES
            );
        }

        log.info("模型池管理器初始化完成: 最大模型数={}, 并发推理数={}, 张量池大小={}",
                memoryConfig.getModelPoolSize(),
                memoryConfig.getMaxConcurrentInferences(),
                memoryConfig.getTensorPoolSize());
    }

    public AiModelWrapper getModel(String modelName) {
        SoftReference<AiModelWrapper> ref = modelPool.get(modelName);
        AiModelWrapper model = ref != null ? ref.get() : null;

        if (model != null) {
            lastAccessTime.put(modelName, System.currentTimeMillis());
            return model;
        }

        return loadModel(modelName);
    }

    private AiModelWrapper loadModel(String modelName) {
        if (modelPool.size() >= memoryConfig.getModelPoolSize()) {
            evictLeastRecentlyUsedModel();
        }

        log.info("加载AI模型: {}", modelName);
        long startTime = System.currentTimeMillis();

        AiModelWrapper model = new AiModelWrapper();
        model.setModelName(modelName);
        model.setLoadTime(System.currentTimeMillis());

        long estimatedSize = 100 * 1024 * 1024;
        if (memoryConfig.isEnableQuantization()) {
            estimatedSize = memoryConfig.calculateModelMemory(estimatedSize);
            model.setQuantized(true);
            model.setQuantizationLevel(memoryConfig.getQuantizationLevel());
        }

        model.setMemorySizeBytes(estimatedSize);
        totalMemoryUsed.addAndGet(estimatedSize);

        try {
            Thread.sleep(500);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        modelPool.put(modelName, new SoftReference<>(model));
        lastAccessTime.put(modelName, System.currentTimeMillis());

        long loadTime = System.currentTimeMillis() - startTime;
        log.info("AI模型加载完成: {}, 耗时={}ms, 内存={}MB",
                modelName, loadTime, estimatedSize / 1024 / 1024);

        checkMemoryUsage();
        return model;
    }

    private void evictLeastRecentlyUsedModel() {
        String lruModel = null;
        long oldestTime = Long.MAX_VALUE;

        for (Map.Entry<String, Long> entry : lastAccessTime.entrySet()) {
            if (entry.getValue() < oldestTime) {
                oldestTime = entry.getValue();
                lruModel = entry.getKey();
            }
        }

        if (lruModel != null) {
            unloadModel(lruModel);
        }
    }

    public void unloadModel(String modelName) {
        SoftReference<AiModelWrapper> ref = modelPool.remove(modelName);
        if (ref != null) {
            AiModelWrapper model = ref.get();
            if (model != null) {
                totalMemoryUsed.addAndGet(-model.getMemorySizeBytes());
                log.info("卸载AI模型: {}, 释放内存={}MB",
                        modelName, model.getMemorySizeBytes() / 1024 / 1024);
            }
        }
        lastAccessTime.remove(modelName);
    }

    private void cleanupIdleModels() {
        long now = System.currentTimeMillis();
        long timeoutMs = memoryConfig.getModelIdleTimeoutMinutes() * 60 * 1000;

        lastAccessTime.entrySet().removeIf(entry -> {
            if (now - entry.getValue() > timeoutMs) {
                unloadModel(entry.getKey());
                return true;
            }
            return false;
        });
    }

    private void performMemoryOptimization() {
        log.debug("执行内存优化...");
        System.gc();

        long usedMb = totalMemoryUsed.get() / 1024 / 1024;
        if (usedMb > memoryConfig.getMemoryCriticalThresholdMb()) {
            log.warn("内存使用接近临界值，执行强制模型卸载: {}MB", usedMb);
            modelPool.keySet().forEach(this::unloadModel);
        } else if (usedMb > memoryConfig.getMemoryWarningThresholdMb()) {
            log.info("内存使用超过警告阈值，执行部分模型卸载: {}MB", usedMb);
            evictLeastRecentlyUsedModel();
        }
    }

    private void checkMemoryUsage() {
        long usedMb = totalMemoryUsed.get() / 1024 / 1024;
        if (usedMb > memoryConfig.getMemoryCriticalThresholdMb()) {
            log.error("内存使用超过临界阈值: {}MB > {}MB",
                    usedMb, memoryConfig.getMemoryCriticalThresholdMb());
        } else if (usedMb > memoryConfig.getMemoryWarningThresholdMb()) {
            log.warn("内存使用超过警告阈值: {}MB > {}MB",
                    usedMb, memoryConfig.getMemoryWarningThresholdMb());
        }
    }

    public Object runInference(String modelName, Object input,
                                java.util.function.Function<Object, Object> inferenceFn)
            throws InterruptedException {
        String cacheKey = modelName + ":" + input.hashCode();
        Object cached = inferenceResultCache.getIfPresent(cacheKey);

        if (cached != null && memoryConfig.isEnableInputCaching()) {
            cacheHits.incrementAndGet();
            log.debug("推理结果缓存命中: {}", modelName);
            return cached;
        }

        if (!inferenceSemaphore.tryAcquire(5, TimeUnit.SECONDS)) {
            throw new RuntimeException("推理服务器繁忙，请稍后重试");
        }

        try {
            AiModelWrapper model = getModel(modelName);
            long startTime = System.currentTimeMillis();

            Object result = inferenceFn.apply(input);

            long inferenceTime = System.currentTimeMillis() - startTime;
            totalInferences.incrementAndGet();

            if (memoryConfig.isEnableInputCaching()) {
                inferenceResultCache.put(cacheKey, result);
            }

            log.debug("推理完成: {}, 耗时={}ms", modelName, inferenceTime);
            return result;

        } finally {
            inferenceSemaphore.release();
        }
    }

    public Object getTensor(String tensorKey) {
        if (memoryConfig.isEnableTensorPooling()) {
            return tensorPool.getIfPresent(tensorKey);
        }
        return null;
    }

    public void putTensor(String tensorKey, Object tensor) {
        if (memoryConfig.isEnableTensorPooling()) {
            tensorPool.put(tensorKey, tensor);
        }
    }

    private void onCacheRemoval(Object key, Object value, RemovalCause cause) {
        log.debug("缓存项移除: {}, 原因: {}", key, cause);
    }

    public Map<String, Object> getPoolStats() {
        Map<String, Object> stats = new ConcurrentHashMap<>();

        stats.put("loadedModels", modelPool.size());
        stats.put("totalMemoryUsedMB", totalMemoryUsed.get() / 1024 / 1024);
        stats.put("totalInferences", totalInferences.get());
        stats.put("cacheHits", cacheHits.get());

        long cacheRequests = totalInferences.get();
        double hitRate = cacheRequests > 0 ?
                (double) cacheHits.get() / cacheRequests * 100 : 0;
        stats.put("cacheHitRatePercent", String.format("%.2f", hitRate));

        stats.put("availablePermits", inferenceSemaphore.availablePermits());
        stats.put("queueLength", inferenceSemaphore.getQueueLength());
        stats.put("tensorPoolSize", tensorPool.estimatedSize());
        stats.put("inferenceCacheSize", inferenceResultCache.estimatedSize());

        return stats;
    }

    public void preloadModels(String... modelNames) {
        for (String modelName : modelNames) {
            CompletableFuture.runAsync(() -> {
                try {
                    getModel(modelName);
                } catch (Exception e) {
                    log.error("预加载模型失败: {} - {}", modelName, e.getMessage());
                }
            });
        }
    }

    public void clearAllCaches() {
        inferenceResultCache.invalidateAll();
        tensorPool.invalidateAll();
        log.info("所有缓存已清除");
    }

    public static class AiModelWrapper {
        private String modelName;
        private long loadTime;
        private long memorySizeBytes;
        private boolean quantized;
        private String quantizationLevel;
        private Object modelData;

        public String getModelName() { return modelName; }
        public void setModelName(String modelName) { this.modelName = modelName; }
        public long getLoadTime() { return loadTime; }
        public void setLoadTime(long loadTime) { this.loadTime = loadTime; }
        public long getMemorySizeBytes() { return memorySizeBytes; }
        public void setMemorySizeBytes(long memorySizeBytes) { this.memorySizeBytes = memorySizeBytes; }
        public boolean isQuantized() { return quantized; }
        public void setQuantized(boolean quantized) { this.quantized = quantized; }
        public String getQuantizationLevel() { return quantizationLevel; }
        public void setQuantizationLevel(String quantizationLevel) { this.quantizationLevel = quantizationLevel; }
        public Object getModelData() { return modelData; }
        public void setModelData(Object modelData) { this.modelData = modelData; }
    }
}

package com.ancient.book.image.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import jakarta.annotation.PostConstruct;
import java.awt.image.BufferedImage;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Slf4j
@Service
@RequiredArgsConstructor
public class MemoryOptimizedInferenceService {

    private final ModelPoolManager modelPoolManager;

    private final Map<String, BatchInferenceContext> batchContexts = new ConcurrentHashMap<>();
    private final AtomicLong totalBatchesProcessed = new AtomicLong(0);
    private final AtomicLong totalImagesProcessed = new AtomicLong(0);

    @PostConstruct
    public void init() {
        modelPoolManager.preloadModels(
                "ocr-detection-model",
                "ocr-recognition-model",
                "restoration-enhancement-model",
                "ancient-text-segmentation-model"
        );
        log.info("内存优化推理服务初始化完成");
    }

    public Map<String, Object> runOCRInference(BufferedImage image, String taskId) {
        try {
            String cacheKey = "ocr:" + taskId;

            Object result = modelPoolManager.runInference(
                    "ocr-recognition-model",
                    image,
                    input -> performOCRInference((BufferedImage) input)
            );

            return (Map<String, Object>) result;

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("OCR推理被中断", e);
        }
    }

    public Map<String, Object> runRestorationInference(BufferedImage image, String taskId,
                                                          String restorationType) {
        try {
            String modelName = switch (restorationType) {
                case "ENHANCEMENT" -> "restoration-enhancement-model";
                case "DENOISE" -> "restoration-denoise-model";
                case "INPAINT" -> "restoration-inpaint-model";
                default -> "restoration-enhancement-model";
            };

            Object result = modelPoolManager.runInference(
                    modelName,
                    image,
                    input -> performRestorationInference((BufferedImage) input, restorationType)
            );

            return (Map<String, Object>) result;

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("修复推理被中断", e);
        }
    }

    public void addToBatch(String batchId, BufferedImage image, String taskType) {
        BatchInferenceContext context = batchContexts.computeIfAbsent(
                batchId, k -> new BatchInferenceContext()
        );

        context.addImage(image, taskType);
        log.debug("添加图片到批次: {}, 当前批次大小: {}", batchId, context.getSize());
    }

    public Map<String, Object> processBatch(String batchId) {
        BatchInferenceContext context = batchContexts.get(batchId);
        if (context == null) {
            throw new RuntimeException("批次不存在: " + batchId);
        }

        long startTime = System.currentTimeMillis();
        int batchSize = context.getSize();

        Map<String, Object> result = doBatchInference(context);

        long processingTime = System.currentTimeMillis() - startTime;
        totalBatchesProcessed.incrementAndGet();
        totalImagesProcessed.addAndGet(batchSize);

        log.info("批次处理完成: {}, 图片数={}, 耗时={}ms, 平均每张={}ms",
                batchId, batchSize, processingTime, batchSize > 0 ? processingTime / batchSize : 0);

        batchContexts.remove(batchId);
        return result;
    }

    private Map<String, Object> performOCRInference(BufferedImage image) {
        long startTime = System.currentTimeMillis();

        Map<String, Object> result = new ConcurrentHashMap<>();
        result.put("text", "模拟OCR识别的古籍文字内容");
        result.put("confidence", 0.95);
        result.put("charCount", 128);
        result.put("processingTimeMs", System.currentTimeMillis() - startTime);

        try {
            Thread.sleep(100);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        return result;
    }

    private Map<String, Object> performRestorationInference(BufferedImage image, String type) {
        long startTime = System.currentTimeMillis();

        Map<String, Object> result = new ConcurrentHashMap<>();
        result.put("restorationType", type);
        result.put("enhancedImage", "base64_encoded_image_data");
        result.put("qualityScore", 0.88);
        result.put("processingTimeMs", System.currentTimeMillis() - startTime);

        try {
            Thread.sleep(200);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        return result;
    }

    private Map<String, Object> doBatchInference(BatchInferenceContext context) {
        Map<String, Object> results = new ConcurrentHashMap<>();
        results.put("totalImages", context.getSize());
        results.put("processedAt", System.currentTimeMillis());
        results.put("results", "批量处理结果");
        return results;
    }

    public Map<String, Object> getInferenceStats() {
        Map<String, Object> stats = new ConcurrentHashMap<>();

        stats.put("totalBatchesProcessed", totalBatchesProcessed.get());
        stats.put("totalImagesProcessed", totalImagesProcessed.get());
        stats.put("activeBatches", batchContexts.size());
        stats.putAll(modelPoolManager.getPoolStats());

        return stats;
    }

    public void clearBatch(String batchId) {
        batchContexts.remove(batchId);
    }

    public void clearAllBatches() {
        batchContexts.clear();
        modelPoolManager.clearAllCaches();
        log.info("所有批次和缓存已清除");
    }

    public static class BatchInferenceContext {
        private final java.util.List<BufferedImage> images = new java.util.ArrayList<>();
        private final java.util.List<String> taskTypes = new java.util.ArrayList<>();
        private final long createTime = System.currentTimeMillis();

        public synchronized void addImage(BufferedImage image, String taskType) {
            images.add(image);
            taskTypes.add(taskType);
        }

        public synchronized int getSize() {
            return images.size();
        }

        public synchronized java.util.List<BufferedImage> getImages() {
            return new java.util.ArrayList<>(images);
        }

        public long getAgeMs() {
            return System.currentTimeMillis() - createTime;
        }
    }
}

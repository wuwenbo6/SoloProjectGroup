package com.ancient.book.common.config;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import jakarta.annotation.PostConstruct;

@Slf4j
@Data
@Configuration
@ConfigurationProperties(prefix = "ai.model.memory")
public class AiModelMemoryConfig {

    private long maxHeapSizeMb = 2048;
    private long maxOffHeapSizeMb = 1024;
    private int modelPoolSize = 5;
    private long modelIdleTimeoutMinutes = 30;
    private boolean enableQuantization = true;
    private String quantizationLevel = "INT8";
    private boolean enableLazyLoading = true;
    private boolean enableModelSharing = true;
    private int batchSize = 8;
    private boolean enableMemoryMapping = true;
    private boolean enableGarbageCollection = true;
    private int gcIntervalMinutes = 5;
    private long memoryWarningThresholdMb = 1536;
    private long memoryCriticalThresholdMb = 1920;
    private boolean enableTensorPooling = true;
    private int tensorPoolSize = 100;
    private boolean enableLayerWiseLoading = false;
    private int maxConcurrentInferences = 4;
    private boolean enableInputCaching = true;
    private int inputCacheSize = 1000;

    @PostConstruct
    public void init() {
        log.info("AI模型内存配置初始化完成:");
        log.info("  最大堆内存: {}MB", maxHeapSizeMb);
        log.info("  最大堆外内存: {}MB", maxOffHeapSizeMb);
        log.info("  模型池大小: {}", modelPoolSize);
        log.info("  模型空闲超时: {}分钟", modelIdleTimeoutMinutes);
        log.info("  量化启用: {}, 级别: {}", enableQuantization, quantizationLevel);
        log.info("  懒加载: {}", enableLazyLoading);
        log.info("  批处理大小: {}", batchSize);
        log.info("  并发推理数: {}", maxConcurrentInferences);
        log.info("  内存告警阈值: {}MB, 临界阈值: {}MB", memoryWarningThresholdMb, memoryCriticalThresholdMb);
    }

    public enum QuantizationLevel {
        INT4(4), INT8(8), FP16(16), FP32(32);

        private final int bits;

        QuantizationLevel(int bits) {
            this.bits = bits;
        }

        public int getBits() {
            return bits;
        }

        public double getMemoryMultiplier() {
            return bits / 32.0;
        }
    }

    public QuantizationLevel getQuantizationLevelEnum() {
        try {
            return QuantizationLevel.valueOf(quantizationLevel.toUpperCase());
        } catch (Exception e) {
            return QuantizationLevel.INT8;
        }
    }

    public long calculateModelMemory(long originalSizeBytes) {
        double multiplier = getQuantizationLevelEnum().getMemoryMultiplier();
        return (long) (originalSizeBytes * multiplier);
    }
}

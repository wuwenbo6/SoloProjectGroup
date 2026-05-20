package com.ancient.book.common.config;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import jakarta.annotation.PostConstruct;
import java.io.File;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Data
@Configuration
@ConfigurationProperties(prefix = "ai.model")
public class AiModelConfig {

    private String basePath = "./ai-model";
    private String pythonPath = "python3";
    private long timeoutSeconds = 300;
    private int maxProcesses = 5;
    private boolean enableGpu = false;
    private String gpuDevice = "0";
    private int batchSize = 1;
    private int maxInputLength = 1024;
    private int maxOutputLength = 2048;
    private float temperature = 0.7f;
    private float topP = 0.9f;

    private Map<String, String> environment = new HashMap<>();

    @PostConstruct
    public void init() {
        log.info("初始化AI模型配置...");
        
        validateBasePath();
        setupDefaultEnvironment();
        
        log.info("AI模型配置初始化完成，basePath: {}, timeout: {}s", basePath, timeoutSeconds);
    }

    private void validateBasePath() {
        File baseDir = new File(basePath);
        if (!baseDir.exists()) {
            log.warn("AI模型目录不存在，正在创建: {}", basePath);
            boolean created = baseDir.mkdirs();
            if (created) {
                log.info("AI模型目录创建成功");
            } else {
                log.error("AI模型目录创建失败: {}", basePath);
            }
        }
        
        if (!baseDir.canRead()) {
            log.error("AI模型目录不可读: {}", basePath);
        }
    }

    private void setupDefaultEnvironment() {
        environment.putIfAbsent("PYTHONUNBUFFERED", "1");
        environment.putIfAbsent("PYTHONDONTWRITEBYTECODE", "1");
        environment.putIfAbsent("TF_CPP_MIN_LOG_LEVEL", "3");
        environment.putIfAbsent("TOKENIZERS_PARALLELISM", "false");
        
        if (enableGpu) {
            environment.putIfAbsent("CUDA_VISIBLE_DEVICES", gpuDevice);
        } else {
            environment.putIfAbsent("CUDA_VISIBLE_DEVICES", "-1");
        }
        
        log.debug("AI模型环境变量: {}", environment.keySet());
    }

    public String getModelPath(String modelName) {
        return new File(basePath, modelName).getAbsolutePath();
    }

    public String getScriptPath(String scriptName) {
        return new File(basePath, scriptName).getAbsolutePath();
    }

    public Map<String, String> getEnvironment() {
        return new HashMap<>(environment);
    }

    public void addEnvironment(String key, String value) {
        environment.put(key, value);
    }
}

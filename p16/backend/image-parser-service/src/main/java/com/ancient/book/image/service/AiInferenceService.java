package com.ancient.book.image.service;

import com.ancient.book.common.config.AiModelConfig;
import com.ancient.book.common.exception.BusinessException;
import com.ancient.book.common.util.ProcessExecutor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.io.File;
import java.util.*;
import java.util.concurrent.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiInferenceService {

    private final AiModelConfig aiModelConfig;
    private final ProcessExecutor processExecutor;
    
    private final ExecutorService executorService = new ThreadPoolExecutor(
            1, 5, 60L, TimeUnit.SECONDS, new LinkedBlockingQueue<>());

    public Map<String, Object> textCompletion(String text, Map<String, Object> params) {
        log.info("执行文字补全推理，文本长度: {}", text.length());
        
        try {
            String scriptPath = aiModelConfig.getScriptPath("text-completion/TextCompletion.py");
            validateScript(scriptPath);
            
            Map<String, String> environment = aiModelConfig.getEnvironment();
            environment.put("TEXT_INPUT", text);
            environment.put("MODEL_TYPE", (String) params.getOrDefault("modelType", "ancient"));
            
            String[] args = {
                    "--text", text,
                    "--max_length", String.valueOf(params.getOrDefault("maxLength", 100)),
                    "--temperature", String.valueOf(params.getOrDefault("temperature", 0.7))
            };
            
            ProcessExecutor.ProcessResult result = processExecutor.executePythonScript(
                    scriptPath, args, environment);
            
            if (!result.isSuccess()) {
                throw new BusinessException("文字补全推理失败: " + result.getError());
            }
            
            return parseInferenceResult(result.getOutput());
            
        } catch (Exception e) {
            log.error("文字补全推理异常", e);
            throw new BusinessException("文字补全推理失败: " + e.getMessage());
        }
    }

    public Map<String, Object> strokeRestoration(String imagePath, Map<String, Object> params) {
        log.info("执行笔画修复推理，图像路径: {}", imagePath);
        
        try {
            String scriptPath = aiModelConfig.getScriptPath("stroke-restoration/StrokeRestoration.py");
            validateScript(scriptPath);
            
            Map<String, String> environment = aiModelConfig.getEnvironment();
            environment.put("IMAGE_PATH", imagePath);
            
            String[] args = {
                    "--image", imagePath,
                    "--mode", (String) params.getOrDefault("mode", "auto"),
                    "--strength", String.valueOf(params.getOrDefault("strength", 0.8))
            };
            
            ProcessExecutor.ProcessResult result = processExecutor.executePythonScript(
                    scriptPath, args, environment);
            
            if (!result.isSuccess()) {
                throw new BusinessException("笔画修复推理失败: " + result.getError());
            }
            
            return parseInferenceResult(result.getOutput());
            
        } catch (Exception e) {
            log.error("笔画修复推理异常", e);
            throw new BusinessException("笔画修复推理失败: " + e.getMessage());
        }
    }

    public Map<String, Object> semanticAlignment(String ancientText, String modernText, 
            Map<String, Object> params) {
        log.info("执行语义对齐推理，古文长度: {}, 现代文长度: {}", 
                ancientText.length(), modernText.length());
        
        try {
            String scriptPath = aiModelConfig.getScriptPath("semantic-alignment/SemanticAlignment.py");
            validateScript(scriptPath);
            
            Map<String, String> environment = aiModelConfig.getEnvironment();
            environment.put("ANCIENT_TEXT", ancientText);
            environment.put("MODERN_TEXT", modernText);
            
            String[] args = {
                    "--ancient", ancientText,
                    "--modern", modernText,
                    "--threshold", String.valueOf(params.getOrDefault("threshold", 0.5))
            };
            
            ProcessExecutor.ProcessResult result = processExecutor.executePythonScript(
                    scriptPath, args, environment);
            
            if (!result.isSuccess()) {
                throw new BusinessException("语义对齐推理失败: " + result.getError());
            }
            
            return parseInferenceResult(result.getOutput());
            
        } catch (Exception e) {
            log.error("语义对齐推理异常", e);
            throw new BusinessException("语义对齐推理失败: " + e.getMessage());
        }
    }

    public Future<Map<String, Object>> asyncTextCompletion(String text, Map<String, Object> params) {
        return executorService.submit(() -> textCompletion(text, params));
    }

    public Future<Map<String, Object>> asyncStrokeRestoration(String imagePath, 
            Map<String, Object> params) {
        return executorService.submit(() -> strokeRestoration(imagePath, params));
    }

    private void validateScript(String scriptPath) {
        File scriptFile = new File(scriptPath);
        if (!scriptFile.exists()) {
            log.warn("AI推理脚本不存在: {}，将使用模拟模式", scriptPath);
            throw new BusinessException("AI推理脚本不存在，请检查配置");
        }
        if (!scriptFile.canRead()) {
            throw new BusinessException("AI推理脚本不可读: " + scriptPath);
        }
    }

    private Map<String, Object> parseInferenceResult(String output) {
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("output", output);
        
        if (output.contains("completed")) {
            result.put("status", "completed");
        } else {
            result.put("status", "processing");
        }
        
        return result;
    }

    public Map<String, Object> getModelInfo() {
        Map<String, Object> info = new HashMap<>();
        info.put("basePath", aiModelConfig.getBasePath());
        info.put("timeoutSeconds", aiModelConfig.getTimeoutSeconds());
        info.put("enableGpu", aiModelConfig.isEnableGpu());
        info.put("gpuDevice", aiModelConfig.getGpuDevice());
        info.put("batchSize", aiModelConfig.getBatchSize());
        info.put("maxInputLength", aiModelConfig.getMaxInputLength());
        info.put("maxOutputLength", aiModelConfig.getMaxOutputLength());
        info.put("environmentKeys", aiModelConfig.getEnvironment().keySet());
        return info;
    }

    public Map<String, Object> healthCheck() {
        Map<String, Object> result = new HashMap<>();
        result.put("status", "healthy");
        result.put("service", "ai-inference");
        result.put("timestamp", System.currentTimeMillis());
        
        try {
            String pythonExec = findPythonExecutable();
            result.put("pythonAvailable", true);
            result.put("pythonExec", pythonExec);
        } catch (Exception e) {
            result.put("pythonAvailable", false);
            result.put("pythonError", e.getMessage());
        }
        
        return result;
    }

    private String findPythonExecutable() {
        String[] candidates = {"python3", "python", "py"};
        for (String candidate : candidates) {
            try {
                Process process = new ProcessBuilder(candidate, "--version").start();
                if (process.waitFor(5, TimeUnit.SECONDS) && process.exitValue() == 0) {
                    return candidate;
                }
            } catch (Exception e) {
                log.debug("尝试Python解释器失败: {}", candidate);
            }
        }
        throw new BusinessException("未找到可用的Python解释器");
    }
}

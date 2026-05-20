package com.ancient.book.image.controller;

import com.ancient.book.image.service.AiInferenceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import java.util.concurrent.Future;

@Slf4j
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiInferenceController {

    private final AiInferenceService aiInferenceService;

    @PostMapping("/text/completion")
    public ResponseEntity<Map<String, Object>> textCompletion(
            @RequestBody Map<String, Object> request) {
        String text = (String) request.get("text");
        log.info("文字补全请求，文本长度: {}", text != null ? text.length() : 0);
        
        Map<String, Object> result = aiInferenceService.textCompletion(text, request);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/stroke/restoration")
    public ResponseEntity<Map<String, Object>> strokeRestoration(
            @RequestBody Map<String, Object> request) {
        String imagePath = (String) request.get("imagePath");
        log.info("笔画修复请求，图像路径: {}", imagePath);
        
        Map<String, Object> result = aiInferenceService.strokeRestoration(imagePath, request);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/semantic/alignment")
    public ResponseEntity<Map<String, Object>> semanticAlignment(
            @RequestBody Map<String, Object> request) {
        String ancientText = (String) request.get("ancientText");
        String modernText = (String) request.get("modernText");
        log.info("语义对齐请求，古文长度: {}, 现代文长度: {}", 
                ancientText != null ? ancientText.length() : 0,
                modernText != null ? modernText.length() : 0);
        
        Map<String, Object> result = aiInferenceService.semanticAlignment(ancientText, modernText, request);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/model/info")
    public ResponseEntity<Map<String, Object>> getModelInfo() {
        Map<String, Object> info = aiInferenceService.getModelInfo();
        return ResponseEntity.ok(info);
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> healthCheck() {
        Map<String, Object> result = aiInferenceService.healthCheck();
        return ResponseEntity.ok(result);
    }

    @PostMapping("/async/text/completion")
    public ResponseEntity<String> asyncTextCompletion(@RequestBody Map<String, Object> request) {
        String text = (String) request.get("text");
        log.info("异步文字补全请求，文本长度: {}", text != null ? text.length() : 0);
        
        Future<Map<String, Object>> future = aiInferenceService.asyncTextCompletion(text, request);
        return ResponseEntity.ok("任务已提交，将在后台执行");
    }
}

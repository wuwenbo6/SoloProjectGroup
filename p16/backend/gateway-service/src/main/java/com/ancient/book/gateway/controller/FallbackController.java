package com.ancient.book.gateway.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@RestController
public class FallbackController {

    @GetMapping("/fallback/image")
    public Mono<ResponseEntity<Map<String, Object>>> imageServiceFallback() {
        log.warn("图像解析服务降级");
        return createFallbackResponse("图像解析服务暂时不可用，请稍后重试", "image-parser-service");
    }

    @PostMapping("/fallback/image")
    public Mono<ResponseEntity<Map<String, Object>>> imageServicePostFallback() {
        log.warn("图像解析服务降级 - POST请求");
        return createFallbackResponse("图像解析服务暂时不可用，请稍后重试", "image-parser-service");
    }

    @GetMapping("/fallback/text")
    public Mono<ResponseEntity<Map<String, Object>>> textServiceFallback() {
        log.warn("古文分词服务降级");
        return createFallbackResponse("古文分词服务暂时不可用，请稍后重试", "text-segmentation-service");
    }

    @PostMapping("/fallback/text")
    public Mono<ResponseEntity<Map<String, Object>>> textServicePostFallback() {
        log.warn("古文分词服务降级 - POST请求");
        return createFallbackResponse("古文分词服务暂时不可用，请稍后重试", "text-segmentation-service");
    }

    @GetMapping("/fallback/semantic")
    public Mono<ResponseEntity<Map<String, Object>>> semanticServiceFallback() {
        log.warn("语义匹配服务降级");
        return createFallbackResponse("语义匹配服务暂时不可用，请稍后重试", "semantic-matching-service");
    }

    @PostMapping("/fallback/semantic")
    public Mono<ResponseEntity<Map<String, Object>>> semanticServicePostFallback() {
        log.warn("语义匹配服务降级 - POST请求");
        return createFallbackResponse("语义匹配服务暂时不可用，请稍后重试", "semantic-matching-service");
    }

    @GetMapping("/fallback/database")
    public Mono<ResponseEntity<Map<String, Object>>> databaseServiceFallback() {
        log.warn("数据库服务降级");
        return createFallbackResponse("数据库服务暂时不可用，请稍后重试", "database-service");
    }

    @PostMapping("/fallback/database")
    public Mono<ResponseEntity<Map<String, Object>>> databaseServicePostFallback() {
        log.warn("数据库服务降级 - POST请求");
        return createFallbackResponse("数据库服务暂时不可用，请稍后重试", "database-service");
    }

    @GetMapping("/fallback/ai")
    public Mono<ResponseEntity<Map<String, Object>>> aiServiceFallback() {
        log.warn("AI推理服务降级");
        return createFallbackResponse("AI推理服务暂时不可用，请稍后重试", "ai-service");
    }

    @PostMapping("/fallback/ai")
    public Mono<ResponseEntity<Map<String, Object>>> aiServicePostFallback() {
        log.warn("AI推理服务降级 - POST请求");
        return createFallbackResponse("AI推理服务暂时不可用，请稍后重试", "ai-service");
    }

    private Mono<ResponseEntity<Map<String, Object>>> createFallbackResponse(String message, String service) {
        Map<String, Object> body = new HashMap<>();
        body.put("code", 503);
        body.put("message", message);
        body.put("service", service);
        body.put("success", false);
        body.put("fallback", true);
        body.put("timestamp", System.currentTimeMillis());
        return Mono.just(ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(body));
    }
}

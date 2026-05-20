package com.ancient.book.database.controller;

import com.ancient.book.common.entity.RestorationProgress;
import com.ancient.book.database.service.RestorationProgressService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/progress")
public class RestorationProgressController {

    private final RestorationProgressService progressService;

    @PostMapping("/start")
    public ResponseEntity<RestorationProgress> startSession(@RequestBody Map<String, Object> request) {
        Long pageId = Long.valueOf(request.get("pageId").toString());
        String bookName = (String) request.get("bookName");
        String operatorId = (String) request.get("operatorId");
        String operatorName = (String) request.get("operatorName");

        log.info("创建修复会话: pageId={}, bookName={}", pageId, bookName);
        RestorationProgress progress = progressService.startSession(pageId, bookName, operatorId, operatorName);
        return ResponseEntity.ok(progress);
    }

    @PostMapping("/update")
    public ResponseEntity<RestorationProgress> updateProgress(@RequestBody Map<String, Object> request) {
        String sessionId = (String) request.get("sessionId");
        int currentStep = Integer.parseInt(request.get("currentStep").toString());
        String stepName = (String) request.get("stepName");
        Double progressPercent = Double.parseDouble(request.get("progressPercent").toString());
        String message = (String) request.get("message");
        Map<String, Object> stepData = (Map<String, Object>) request.get("stepData");

        log.info("更新修复进度: sessionId={}, step={}", sessionId, currentStep);
        RestorationProgress progress = progressService.updateProgress(
            sessionId, currentStep, stepName, progressPercent, message, stepData
        );
        return ResponseEntity.ok(progress);
    }

    @PostMapping("/complete")
    public ResponseEntity<RestorationProgress> completeSession(@RequestBody Map<String, String> request) {
        String sessionId = request.get("sessionId");
        String message = request.get("message");

        log.info("完成修复会话: sessionId={}", sessionId);
        RestorationProgress progress = progressService.completeSession(sessionId, message);
        return ResponseEntity.ok(progress);
    }

    @PostMapping("/fail")
    public ResponseEntity<RestorationProgress> failSession(@RequestBody Map<String, String> request) {
        String sessionId = request.get("sessionId");
        String errorMessage = request.get("errorMessage");

        log.error("修复会话失败: sessionId={}, error={}", sessionId, errorMessage);
        RestorationProgress progress = progressService.failSession(sessionId, errorMessage);
        return ResponseEntity.ok(progress);
    }

    @PostMapping("/pause")
    public ResponseEntity<Void> pauseSession(@RequestBody Map<String, String> request) {
        String sessionId = request.get("sessionId");
        log.info("暂停修复会话: sessionId={}", sessionId);
        progressService.pauseSession(sessionId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/resume")
    public ResponseEntity<Void> resumeSession(@RequestBody Map<String, String> request) {
        String sessionId = request.get("sessionId");
        log.info("恢复修复会话: sessionId={}", sessionId);
        progressService.resumeSession(sessionId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/cancel")
    public ResponseEntity<Void> cancelSession(@RequestBody Map<String, String> request) {
        String sessionId = request.get("sessionId");
        log.info("取消修复会话: sessionId={}", sessionId);
        progressService.cancelSession(sessionId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/session/{sessionId}")
    public ResponseEntity<RestorationProgress> getProgress(@PathVariable String sessionId) {
        RestorationProgress progress = progressService.getProgress(sessionId);
        return ResponseEntity.ok(progress);
    }

    @GetMapping("/session/{sessionId}/stats")
    public ResponseEntity<Map<String, Object>> getSessionStatistics(@PathVariable String sessionId) {
        Map<String, Object> stats = progressService.getSessionStatistics(sessionId);
        return ResponseEntity.ok(stats);
    }

    @GetMapping("/active")
    public ResponseEntity<List<RestorationProgress>> getActiveSessions() {
        List<RestorationProgress> sessions = progressService.getActiveSessions();
        return ResponseEntity.ok(sessions);
    }

    @GetMapping("/page/{pageId}/history")
    public ResponseEntity<List<RestorationProgress>> getPageHistory(@PathVariable Long pageId) {
        List<RestorationProgress> history = progressService.getPageHistory(pageId);
        return ResponseEntity.ok(history);
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getServiceStatus() {
        Map<String, Object> status = progressService.getServiceStatus();
        return ResponseEntity.ok(status);
    }

    @MessageMapping("/progress/subscribe")
    @SendTo("/topic/restoration/all")
    public Map<String, Object> handleSubscribe(Map<String, Object> message) {
        log.info("收到WebSocket订阅: {}", message);
        return message;
    }

    @MessageMapping("/progress/update")
    public void handleProgressUpdate(Map<String, Object> message) {
        log.info("收到WebSocket进度更新: {}", message);
    }
}

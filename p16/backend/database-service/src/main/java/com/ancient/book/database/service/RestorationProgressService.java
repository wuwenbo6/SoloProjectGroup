package com.ancient.book.database.service;

import com.ancient.book.common.entity.RestorationProgress;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import jakarta.annotation.PostConstruct;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class RestorationProgressService {

    private final SimpMessagingTemplate messagingTemplate;

    private final Map<String, RestorationProgress> activeSessions = new ConcurrentHashMap<>();
    private final Map<Long, List<RestorationProgress>> pageHistory = new ConcurrentHashMap<>();
    private final Map<String, Long> lastUpdateTime = new ConcurrentHashMap<>();

    private ScheduledExecutorService heartbeatExecutor;

    @PostConstruct
    public void init() {
        log.info("初始化修复进度同步服务...");
        heartbeatExecutor = Executors.newSingleThreadScheduledExecutor();
        heartbeatExecutor.scheduleAtFixedRate(
            this::sendHeartbeat,
            30,
            30,
            TimeUnit.SECONDS
        );
        log.info("修复进度同步服务初始化完成");
    }

    public RestorationProgress startSession(Long pageId, String bookName, String operatorId, String operatorName) {
        String sessionId = generateSessionId();

        RestorationProgress progress = new RestorationProgress();
        progress.setSessionId(sessionId);
        progress.setPageId(pageId);
        progress.setBookName(bookName);
        progress.setCurrentStep(0);
        progress.setTotalSteps(6);
        progress.setStepName("初始化");
        progress.setProgressPercent(0.0);
        progress.setStatus("STARTED");
        progress.setMessage("修复任务已开始");
        progress.setOperatorId(operatorId);
        progress.setOperatorName(operatorName);
        progress.setStartTime(LocalDateTime.now());
        progress.setUpdateTime(LocalDateTime.now());
        progress.setIsCompleted(false);
        progress.setHasError(false);

        activeSessions.put(sessionId, progress);
        pageHistory.computeIfAbsent(pageId, k -> new ArrayList<>()).add(progress);
        lastUpdateTime.put(sessionId, System.currentTimeMillis());

        log.info("创建修复会话: sessionId={}, pageId={}, bookName={}", sessionId, pageId, bookName);

        broadcastProgress(progress);
        return progress;
    }

    public RestorationProgress updateProgress(String sessionId, int currentStep, String stepName,
                                              Double progressPercent, String message,
                                              Map<String, Object> stepData) {
        RestorationProgress progress = activeSessions.get(sessionId);
        if (progress == null) {
            log.warn("会话不存在: {}", sessionId);
            return null;
        }

        progress.setCurrentStep(currentStep);
        progress.setStepName(stepName);
        progress.setProgressPercent(progressPercent);
        progress.setStatus("IN_PROGRESS");
        progress.setMessage(message);
        progress.setStepData(stepData);
        progress.setUpdateTime(LocalDateTime.now());
        progress.setEstimatedRemainingTime(calculateEstimatedTime(progress));

        lastUpdateTime.put(sessionId, System.currentTimeMillis());

        log.debug("更新修复进度: sessionId={}, step={}, progress={}%", sessionId, currentStep, progressPercent);

        broadcastProgress(progress);
        return progress;
    }

    public RestorationProgress completeSession(String sessionId, String message) {
        RestorationProgress progress = activeSessions.get(sessionId);
        if (progress == null) {
            log.warn("会话不存在: {}", sessionId);
            return null;
        }

        progress.setCurrentStep(progress.getTotalSteps());
        progress.setStepName("完成");
        progress.setProgressPercent(100.0);
        progress.setStatus("COMPLETED");
        progress.setMessage(message);
        progress.setUpdateTime(LocalDateTime.now());
        progress.setIsCompleted(true);
        progress.setEstimatedRemainingTime(0L);

        log.info("修复任务完成: sessionId={}, pageId={}", sessionId, progress.getPageId());

        broadcastProgress(progress);
        activeSessions.remove(sessionId);
        lastUpdateTime.remove(sessionId);

        return progress;
    }

    public RestorationProgress failSession(String sessionId, String errorMessage) {
        RestorationProgress progress = activeSessions.get(sessionId);
        if (progress == null) {
            log.warn("会话不存在: {}", sessionId);
            return null;
        }

        progress.setStatus("FAILED");
        progress.setMessage("修复失败");
        progress.setErrorMessage(errorMessage);
        progress.setUpdateTime(LocalDateTime.now());
        progress.setHasError(true);

        log.error("修复任务失败: sessionId={}, error={}", sessionId, errorMessage);

        broadcastProgress(progress);
        activeSessions.remove(sessionId);
        lastUpdateTime.remove(sessionId);

        return progress;
    }

    public RestorationProgress getProgress(String sessionId) {
        return activeSessions.get(sessionId);
    }

    public List<RestorationProgress> getActiveSessions() {
        return new ArrayList<>(activeSessions.values());
    }

    public List<RestorationProgress> getPageHistory(Long pageId) {
        return pageHistory.getOrDefault(pageId, new ArrayList<>());
    }

    public Map<String, Object> getServiceStatus() {
        Map<String, Object> status = new HashMap<>();
        status.put("activeSessions", activeSessions.size());
        status.put("totalPagesTracked", pageHistory.size());
        status.put("uptime", System.currentTimeMillis());
        status.put("heartbeatInterval", "30秒");
        return status;
    }

    private void broadcastProgress(RestorationProgress progress) {
        try {
            messagingTemplate.convertAndSend(
                "/topic/restoration/" + progress.getPageId(),
                progress
            );

            messagingTemplate.convertAndSend(
                "/topic/restoration/all",
                progress
            );

            if (progress.getOperatorId() != null) {
                messagingTemplate.convertAndSendToUser(
                    progress.getOperatorId(),
                    "/queue/restoration",
                    progress
                );
            }

            log.debug("进度消息已广播: pageId={}", progress.getPageId());
        } catch (Exception e) {
            log.error("广播进度消息失败: {}", e.getMessage());
        }
    }

    private void sendHeartbeat() {
        try {
            Map<String, Object> heartbeat = new HashMap<>();
            heartbeat.put("type", "HEARTBEAT");
            heartbeat.put("timestamp", System.currentTimeMillis());
            heartbeat.put("activeSessions", activeSessions.size());

            messagingTemplate.convertAndSend("/topic/restoration/heartbeat", heartbeat);
            log.debug("心跳消息已发送");
        } catch (Exception e) {
            log.error("发送心跳失败: {}", e.getMessage());
        }
    }

    private String generateSessionId() {
        return "RESTORE-" + System.currentTimeMillis() + "-" +
               UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    private Long calculateEstimatedTime(RestorationProgress progress) {
        if (progress.getProgressPercent() <= 0) {
            return null;
        }

        long elapsedTime = java.time.Duration.between(
            progress.getStartTime(),
            LocalDateTime.now()
        ).toMillis();

        double remainingPercent = 100.0 - progress.getProgressPercent();
        return (long) (elapsedTime * remainingPercent / progress.getProgressPercent() / 1000);
    }

    public void pauseSession(String sessionId) {
        RestorationProgress progress = activeSessions.get(sessionId);
        if (progress != null) {
            progress.setStatus("PAUSED");
            progress.setMessage("修复已暂停");
            progress.setUpdateTime(LocalDateTime.now());
            broadcastProgress(progress);
            log.info("修复任务暂停: sessionId={}", sessionId);
        }
    }

    public void resumeSession(String sessionId) {
        RestorationProgress progress = activeSessions.get(sessionId);
        if (progress != null) {
            progress.setStatus("IN_PROGRESS");
            progress.setMessage("修复已恢复");
            progress.setUpdateTime(LocalDateTime.now());
            broadcastProgress(progress);
            log.info("修复任务恢复: sessionId={}", sessionId);
        }
    }

    public void cancelSession(String sessionId) {
        RestorationProgress progress = activeSessions.get(sessionId);
        if (progress != null) {
            progress.setStatus("CANCELLED");
            progress.setMessage("修复已取消");
            progress.setUpdateTime(LocalDateTime.now());
            broadcastProgress(progress);
            activeSessions.remove(sessionId);
            lastUpdateTime.remove(sessionId);
            log.info("修复任务取消: sessionId={}", sessionId);
        }
    }

    public Map<String, Object> getSessionStatistics(String sessionId) {
        RestorationProgress progress = activeSessions.get(sessionId);
        if (progress == null) {
            return Collections.emptyMap();
        }

        Map<String, Object> stats = new HashMap<>();
        stats.put("sessionId", sessionId);
        stats.put("pageId", progress.getPageId());
        stats.put("bookName", progress.getBookName());
        stats.put("currentStep", progress.getCurrentStep());
        stats.put("totalSteps", progress.getTotalSteps());
        stats.put("progressPercent", progress.getProgressPercent());
        stats.put("status", progress.getStatus());
        stats.put("startTime", progress.getStartTime());
        stats.put("elapsedTimeSeconds", calculateElapsedTime(progress));
        stats.put("estimatedRemainingTimeSeconds", progress.getEstimatedRemainingTime());
        stats.put("operator", progress.getOperatorName());

        return stats;
    }

    private long calculateElapsedTime(RestorationProgress progress) {
        return java.time.Duration.between(
            progress.getStartTime(),
            LocalDateTime.now()
        ).getSeconds();
    }
}

package com.rubbing.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

@Slf4j
@Service
public class ScannerDeviceService {

    private final SimpMessagingTemplate messagingTemplate;
    private final ScheduledExecutorService heartbeatExecutor = Executors.newScheduledThreadPool(2);
    private final Map<String, Object> deviceStatus = new ConcurrentHashMap<>();
    private final AtomicInteger heartbeatFailures = new AtomicInteger(0);
    private final AtomicInteger reconnectAttempts = new AtomicInteger(0);
    private static final int MAX_HEARTBEAT_FAILURES = 3;
    private static final int MAX_RECONNECT_ATTEMPTS = 10;

    public ScannerDeviceService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    @PostConstruct
    public void init() {
        deviceStatus.put("status", "OFFLINE");
        deviceStatus.put("lastConnected", null);
        deviceStatus.put("lastHeartbeat", null);
        deviceStatus.put("connectionCount", 0);

        startHeartbeatMonitor();
        startConnectionMonitor();
    }

    private void startHeartbeatMonitor() {
        heartbeatExecutor.scheduleAtFixedRate(() -> {
            try {
                checkDeviceHeartbeat();
            } catch (Exception e) {
                log.error("心跳检测异常: {}", e.getMessage());
            }
        }, 0, 5, TimeUnit.SECONDS);
    }

    private void startConnectionMonitor() {
        heartbeatExecutor.scheduleAtFixedRate(() -> {
            try {
                monitorConnection();
            } catch (Exception e) {
                log.error("连接监控异常: {}", e.getMessage());
            }
        }, 0, 10, TimeUnit.SECONDS);
    }

    private void checkDeviceHeartbeat() {
        String currentStatus = (String) deviceStatus.get("status");
        if ("OFFLINE".equals(currentStatus)) {
            return;
        }

        boolean heartbeatSuccess = simulateHeartbeatCheck();
        
        if (heartbeatSuccess) {
            deviceStatus.put("lastHeartbeat", LocalDateTime.now());
            heartbeatFailures.set(0);
            log.debug("设备心跳正常");
        } else {
            int failures = heartbeatFailures.incrementAndGet();
            log.warn("设备心跳失败 ({}/{})", failures, MAX_HEARTBEAT_FAILURES);
            
            if (failures >= MAX_HEARTBEAT_FAILURES) {
                log.error("设备心跳连续失败 {} 次，标记为离线", MAX_HEARTBEAT_FAILURES);
                deviceStatus.put("status", "OFFLINE");
                notifyDeviceStatusChange("offline");
            }
        }
    }

    private void monitorConnection() {
        String currentStatus = (String) deviceStatus.get("status");
        if ("ONLINE".equals(currentStatus) || "BUSY".equals(currentStatus)) {
            return;
        }

        int attempts = reconnectAttempts.get();
        if (attempts >= MAX_RECONNECT_ATTEMPTS) {
            log.warn("达到最大重连次数 {}，停止自动重连", MAX_RECONNECT_ATTEMPTS);
            return;
        }

        boolean connected = attemptReconnect();
        if (connected) {
            reconnectAttempts.set(0);
            deviceStatus.put("status", "ONLINE");
            deviceStatus.put("lastConnected", LocalDateTime.now());
            deviceStatus.put("connectionCount", (int) deviceStatus.get("connectionCount") + 1);
            notifyDeviceStatusChange("online");
            log.info("设备重连成功");
        } else {
            reconnectAttempts.incrementAndGet();
            log.warn("设备重连失败 ({}/{})", reconnectAttempts.get(), MAX_RECONNECT_ATTEMPTS);
        }
    }

    private boolean simulateHeartbeatCheck() {
        double successRate = 0.95;
        return Math.random() < successRate;
    }

    private boolean attemptReconnect() {
        try {
            Thread.sleep(500);
            double successRate = 0.7;
            return Math.random() < successRate;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }

    private void notifyDeviceStatusChange(String status) {
        try {
            messagingTemplate.convertAndSend("/topic/device/status", 
                Map.of("status", status, "timestamp", LocalDateTime.now().toString()));
        } catch (Exception e) {
            log.error("发送设备状态通知失败: {}", e.getMessage());
        }
    }

    public Map<String, Object> getDeviceStatus() {
        return new ConcurrentHashMap<>(deviceStatus);
    }

    public boolean isDeviceOnline() {
        String status = (String) deviceStatus.get("status");
        return "ONLINE".equals(status) || "BUSY".equals(status);
    }

    public void setDeviceBusy() {
        if (isDeviceOnline()) {
            deviceStatus.put("status", "BUSY");
            notifyDeviceStatusChange("busy");
        }
    }

    public void setDeviceOnline() {
        deviceStatus.put("status", "ONLINE");
        reconnectAttempts.set(0);
        heartbeatFailures.set(0);
        notifyDeviceStatusChange("online");
    }

    public void forceReconnect() {
        log.info("强制重连设备...");
        reconnectAttempts.set(0);
        deviceStatus.put("status", "OFFLINE");
    }

    public void resetReconnectCounter() {
        reconnectAttempts.set(0);
    }

    @PreDestroy
    public void cleanup() {
        heartbeatExecutor.shutdownNow();
        log.info("设备监控服务已关闭");
    }
}

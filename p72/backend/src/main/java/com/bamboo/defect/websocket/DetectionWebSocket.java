package com.bamboo.defect.websocket;

import com.alibaba.fastjson.JSON;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import javax.websocket.*;
import javax.websocket.server.ServerEndpoint;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Slf4j
@Component
@ServerEndpoint("/ws/detection")
public class DetectionWebSocket {
    
    private static final Map<String, Session> SESSION_POOL = new ConcurrentHashMap<>();
    private static final AtomicInteger ONLINE_COUNT = new AtomicInteger(0);
    
    @OnOpen
    public void onOpen(Session session) {
        SESSION_POOL.put(session.getId(), session);
        ONLINE_COUNT.incrementAndGet();
        log.info("WebSocket连接成功，当前在线人数: {}", ONLINE_COUNT.get());
    }
    
    @OnClose
    public void onClose(Session session) {
        SESSION_POOL.remove(session.getId());
        ONLINE_COUNT.decrementAndGet();
        log.info("WebSocket连接关闭，当前在线人数: {}", ONLINE_COUNT.get());
    }
    
    @OnMessage
    public void onMessage(String message, Session session) {
        log.info("收到客户端消息: {}", message);
    }
    
    @OnError
    public void onError(Session session, Throwable error) {
        log.error("WebSocket发生错误: {}", error.getMessage(), error);
    }
    
    public static void broadcast(String message) {
        for (Session session : SESSION_POOL.values()) {
            if (session.isOpen()) {
                try {
                    session.getBasicRemote().sendText(message);
                } catch (Exception e) {
                    log.error("发送消息失败: {}", e.getMessage());
                }
            }
        }
    }
    
    public static void sendDetectionResult(Object data) {
        try {
            String message = JSON.toJSONString(Map.of(
                    "type", "detection_result",
                    "data", data,
                    "timestamp", System.currentTimeMillis()
            ));
            broadcast(message);
        } catch (Exception e) {
            log.error("发送检测结果失败: {}", e.getMessage());
        }
    }
    
    public static int getOnlineCount() {
        return ONLINE_COUNT.get();
    }
}

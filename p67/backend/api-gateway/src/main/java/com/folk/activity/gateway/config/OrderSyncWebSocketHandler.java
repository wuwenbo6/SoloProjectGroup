package com.folk.activity.gateway.config;

import com.alibaba.fastjson2.JSON;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.socket.WebSocketHandler;
import org.springframework.web.reactive.socket.WebSocketSession;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class OrderSyncWebSocketHandler implements WebSocketHandler {

    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    @Override
    public Mono<Void> handle(WebSocketSession session) {
        String sessionId = session.getId();
        sessions.put(sessionId, session);
        System.out.println("新WebSocket连接: " + sessionId);

        Mono<Void> receiveMono = session.receive()
                .doOnNext(message -> {
                    try {
                        String payload = message.getPayloadAsText();
                        Map<String, Object> data = JSON.parseObject(payload);
                        handleMessage(session, data);
                    } catch (Exception e) {
                        System.err.println("处理WebSocket消息失败: " + e.getMessage());
                    }
                })
                .doFinally(signalType -> {
                    sessions.remove(sessionId);
                    System.out.println("WebSocket连接关闭: " + sessionId);
                })
                .then();

        Mono<Void> heartbeatMono = session.send(
                Flux.interval(Duration.ofSeconds(30))
                        .map(t -> session.textMessage(JSON.toJSONString(Map.of(
                                "type", "HEARTBEAT_ACK",
                                "timestamp", LocalDateTime.now().toString()
                        ))))
        );

        return Mono.zip(receiveMono, heartbeatMono).then();
    }

    private void handleMessage(WebSocketSession session, Map<String, Object> data) {
        String type = (String) data.get("type");

        switch (type) {
            case "HEARTBEAT":
                System.out.println("收到心跳: " + session.getId());
                break;
            case "SYNC_REQUEST":
                String orderNo = (String) data.get("orderNo");
                sendOrderStatusUpdate(session, orderNo, 1, LocalDateTime.now().toString());
                break;
            case "BATCH_SYNC_REQUEST":
                break;
            default:
                System.out.println("未知消息类型: " + type);
        }
    }

    public void sendOrderStatusUpdate(String orderNo, int status, String updateTime) {
        Map<String, Object> message = Map.of(
                "type", "ORDER_STATUS_UPDATE",
                "orderNo", orderNo,
                "status", status,
                "updateTime", updateTime
        );

        String jsonMessage = JSON.toJSONString(message);
        sessions.values().forEach(session -> {
            if (session.isOpen()) {
                session.send(Mono.just(session.textMessage(jsonMessage))).subscribe();
            }
        });
    }

    private void sendOrderStatusUpdate(WebSocketSession session, String orderNo, int status, String updateTime) {
        Map<String, Object> message = Map.of(
                "type", "ORDER_STATUS_UPDATE",
                "orderNo", orderNo,
                "status", status,
                "updateTime", updateTime
        );
        session.send(Mono.just(session.textMessage(JSON.toJSONString(message)))).subscribe();
    }
}

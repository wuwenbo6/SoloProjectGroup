package com.fittrack.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fittrack.dto.FeedbackDTO;
import com.fittrack.dto.FrameDataDTO;
import com.fittrack.service.MotionAnalysisService;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.PingMessage;
import org.springframework.web.socket.PongMessage;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;
import java.util.concurrent.ConcurrentLinkedDeque;

@Component
@EnableScheduling
public class MotionAnalysisWebSocketHandler extends TextWebSocketHandler {

    private final ObjectMapper objectMapper;
    private final MotionAnalysisService motionAnalysisService;
    
    private final Map<String, WebSocketSession> activeSessions = new ConcurrentHashMap<>();
    private final Map<String, Queue<FeedbackDTO>> userFeedbackCache = new ConcurrentHashMap<>();
    private final Map<String, Long> lastPongTime = new ConcurrentHashMap<>();
    private final Map<String, Long> sessionToUserId = new ConcurrentHashMap<>();
    private final Map<Long, Set<String>> userIdToSessions = new ConcurrentHashMap<>();
    
    private static final int MAX_CACHE_SIZE = 10;
    private static final long HEARTBEAT_INTERVAL = 30000;
    private static final long PONG_TIMEOUT = 60000;

    public MotionAnalysisWebSocketHandler(ObjectMapper objectMapper, MotionAnalysisService motionAnalysisService) {
        this.objectMapper = objectMapper;
        this.motionAnalysisService = motionAnalysisService;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String sessionId = session.getId();
        activeSessions.put(sessionId, session);
        lastPongTime.put(sessionId, System.currentTimeMillis());
        
        System.out.println("WebSocket connection established: " + sessionId);
    }

    public void registerUserSession(String sessionId, Long userId) {
        sessionToUserId.put(sessionId, userId);
        userIdToSessions.computeIfAbsent(userId, k -> new CopyOnWriteArraySet<>()).add(sessionId);
        System.out.println("Registered user " + userId + " to session " + sessionId);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String sessionId = session.getId();
        lastPongTime.put(sessionId, System.currentTimeMillis());
        
        try {
            String payload = message.getPayload();
            
            if ("PING".equals(payload)) {
                session.sendMessage(new TextMessage("PONG"));
                return;
            }
            
            FrameDataDTO frameData = objectMapper.readValue(payload, FrameDataDTO.class);
            frameData.setSessionId(sessionId);
            
            String userId = null;
            if (frameData.getUserId() != null) {
                userId = String.valueOf(frameData.getUserId());
                sessionToUserId.put(sessionId, userId);
                sendCachedFeedback(session, userId);
            }

            FeedbackDTO feedback = motionAnalysisService.analyzeFrame(frameData);

            if (feedback != null) {
                cacheFeedback(userId, feedback);
                sendFeedback(session, feedback);
            }
        } catch (Exception e) {
            System.err.println("Error processing frame data: " + e.getMessage());
            e.printStackTrace();
        }
    }

    @Override
    protected void handlePongMessage(WebSocketSession session, PongMessage message) throws Exception {
        String sessionId = session.getId();
        lastPongTime.put(sessionId, System.currentTimeMillis());
        System.out.println("Received PONG from session: " + sessionId);
    }

    @Scheduled(fixedRate = HEARTBEAT_INTERVAL)
    public void sendHeartbeat() {
        long currentTime = System.currentTimeMillis();
        
        for (Map.Entry<String, WebSocketSession> entry : activeSessions.entrySet()) {
            String sessionId = entry.getKey();
            WebSocketSession session = entry.getValue();
            
            try {
                if (session.isOpen()) {
                    Long lastPong = lastPongTime.get(sessionId);
                    if (lastPong != null && (currentTime - lastPong) > PONG_TIMEOUT) {
                        System.out.println("Session timeout, closing: " + sessionId);
                        session.close(CloseStatus.SESSION_NOT_RELIABLE);
                    } else {
                        session.sendMessage(new PingMessage(ByteBuffer.wrap("ping".getBytes())));
                    }
                }
            } catch (IOException e) {
                System.err.println("Failed to send heartbeat to session: " + sessionId);
                activeSessions.remove(sessionId);
                sessionToUserId.remove(sessionId);
                lastPongTime.remove(sessionId);
            }
        }
    }

    private void cacheFeedback(String userId, FeedbackDTO feedback) {
        if (userId == null) return;
        
        userFeedbackCache.compute(userId, (k, queue) -> {
            if (queue == null) {
                queue = new ConcurrentLinkedDeque<>();
            }
            queue.offer(feedback);
            while (queue.size() > MAX_CACHE_SIZE) {
                queue.poll();
            }
            return queue;
        });
    }

    private void sendCachedFeedback(WebSocketSession session, String userId) {
        if (userId == null) return;
        
        Queue<FeedbackDTO> cachedFeedbacks = userFeedbackCache.get(userId);
        if (cachedFeedbacks != null && !cachedFeedbacks.isEmpty()) {
            System.out.println("Sending " + cachedFeedbacks.size() + " cached feedbacks for user: " + userId);
            for (FeedbackDTO feedback : cachedFeedbacks) {
                try {
                    sendFeedback(session, feedback);
                } catch (Exception e) {
                    System.err.println("Failed to send cached feedback: " + e.getMessage());
                }
            }
        }
    }

    private void sendFeedback(WebSocketSession session, FeedbackDTO feedback) throws Exception {
        if (session.isOpen()) {
            String feedbackJson = objectMapper.writeValueAsString(feedback);
            session.sendMessage(new TextMessage(feedbackJson));
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        String sessionId = session.getId();
        activeSessions.remove(sessionId);
        lastPongTime.remove(sessionId);
        Long userId = sessionToUserId.remove(sessionId);
        
        if (userId != null) {
            Set<String> sessions = userIdToSessions.get(userId);
            if (sessions != null) {
                sessions.remove(sessionId);
                if (sessions.isEmpty()) {
                    userIdToSessions.remove(userId);
                }
            }
        }
        
        System.out.println("WebSocket connection closed: " + sessionId + ", status: " + status);
    }

    public void sendNotificationToUser(Long userId, String messageJson) {
        Set<String> sessionIds = userIdToSessions.get(userId);
        if (sessionIds != null && !sessionIds.isEmpty()) {
            for (String sessionId : sessionIds) {
                WebSocketSession session = activeSessions.get(sessionId);
                if (session != null && session.isOpen()) {
                    try {
                        session.sendMessage(new TextMessage(messageJson));
                    } catch (IOException e) {
                        System.err.println("Failed to send notification to session " + sessionId + ": " + e.getMessage());
                    }
                }
            }
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        String sessionId = session.getId();
        System.err.println("WebSocket transport error for session " + sessionId + ": " + exception.getMessage());
    }

    public void sendFeedbackToSession(String sessionId, FeedbackDTO feedback) throws Exception {
        WebSocketSession session = activeSessions.get(sessionId);
        if (session != null && session.isOpen()) {
            String userId = sessionToUserId.get(sessionId);
            cacheFeedback(userId, feedback);
            sendFeedback(session, feedback);
        }
    }

    public void clearUserCache(String userId) {
        userFeedbackCache.remove(userId);
    }

    public WebSocketSession getActiveSession(String sessionId) {
        return activeSessions.get(sessionId);
    }

    public Map<String, WebSocketSession> getAllActiveSessions() {
        return new java.util.HashMap<>(activeSessions);
    }
}

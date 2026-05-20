package com.fittrack.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fittrack.config.MotionAnalysisWebSocketHandler;
import com.fittrack.dto.RoomMessageDTO;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class RoomMessageSubscriber {

    private final MotionAnalysisWebSocketHandler webSocketHandler;
    private final ObjectMapper objectMapper;
    private final Map<String, Set<String>> roomToSessions = new ConcurrentHashMap<>();

    public RoomMessageSubscriber(MotionAnalysisWebSocketHandler webSocketHandler, ObjectMapper objectMapper) {
        this.webSocketHandler = webSocketHandler;
        this.objectMapper = objectMapper;
    }

    public void receiveMessage(String message, String channel) {
        try {
            RoomMessageDTO roomMessage = objectMapper.readValue(message, RoomMessageDTO.class);
            String roomId = roomMessage.getRoomId();

            Set<String> sessionIds = roomToSessions.get(roomId);
            if (sessionIds != null) {
                for (String sessionId : sessionIds) {
                    sendToSession(sessionId, roomMessage);
                }
            }
        } catch (Exception e) {
            System.err.println("Error processing room message: " + e.getMessage());
        }
    }

    private void sendToSession(String sessionId, RoomMessageDTO message) {
        try {
            WebSocketSession session = webSocketHandler.getActiveSession(sessionId);
            if (session != null && session.isOpen()) {
                String json = objectMapper.writeValueAsString(message);
                session.sendMessage(new TextMessage(json));
            }
        } catch (IOException e) {
            System.err.println("Failed to send message to session " + sessionId + ": " + e.getMessage());
        }
    }

    public void addSessionToRoom(String roomId, String sessionId) {
        roomToSessions.compute(roomId, (k, sessions) -> {
            if (sessions == null) {
                sessions = ConcurrentHashMap.newKeySet();
            }
            sessions.add(sessionId);
            return sessions;
        });
    }

    public void removeSessionFromRoom(String roomId, String sessionId) {
        Set<String> sessions = roomToSessions.get(roomId);
        if (sessions != null) {
            sessions.remove(sessionId);
            if (sessions.isEmpty()) {
                roomToSessions.remove(roomId);
            }
        }
    }

    public void removeSessionFromAllRooms(String sessionId) {
        for (Map.Entry<String, Set<String>> entry : roomToSessions.entrySet()) {
            entry.getValue().remove(sessionId);
        }
        roomToSessions.entrySet().removeIf(e -> e.getValue().isEmpty());
    }
}

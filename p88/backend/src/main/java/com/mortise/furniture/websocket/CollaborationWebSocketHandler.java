package com.mortise.furniture.websocket;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONObject;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Component
public class CollaborationWebSocketHandler extends TextWebSocketHandler {

    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    private final Map<String, String> userRooms = new ConcurrentHashMap<>();
    private final Map<String, String> roomUsers = new ConcurrentHashMap<>();
    private final Map<String, AtomicLong> roomVersions = new ConcurrentHashMap<>();
    private final Map<String, JSONObject> roomState = new ConcurrentHashMap<>();
    private final Map<String, Long> userLastEditTime = new ConcurrentHashMap<>();

    private static final long EDIT_COOLDOWN_MS = 100;

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String sessionId = session.getId();
        sessions.put(sessionId, session);
        System.out.println("新连接建立: " + sessionId);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        try {
            JSONObject json = JSON.parseObject(message.getPayload());
            String type = json.getString("type");

            switch (type) {
                case "join":
                    handleJoin(session, json);
                    break;
                case "leave":
                    handleLeave(session);
                    break;
                case "edit":
                    handleEdit(session, json);
                    break;
                case "cursor":
                    handleCursor(session, json);
                    break;
                case "sync":
                    handleSync(session, json);
                    break;
                case "commit":
                    handleCommit(session, json);
                    break;
                default:
                    broadcastToRoom(session, json);
            }
        } catch (Exception e) {
            e.printStackTrace();
            sendError(session, e.getMessage());
        }
    }

    private void handleJoin(WebSocketSession session, JSONObject json) {
        String roomId = json.getString("roomId");
        String userId = json.getString("userId");
        String userName = json.getString("userName");

        String oldRoom = userRooms.get(session.getId());
        if (oldRoom != null && !oldRoom.equals(roomId)) {
            leaveRoom(session.getId(), oldRoom);
        }

        userRooms.put(session.getId(), roomId);
        roomUsers.put(session.getId(), userId);

        roomVersions.computeIfAbsent(roomId, k -> new AtomicLong(0));

        JSONObject joinMsg = new JSONObject();
        joinMsg.put("type", "userJoin");
        joinMsg.put("userId", userId);
        joinMsg.put("userName", userName);
        joinMsg.put("timestamp", System.currentTimeMillis());
        joinMsg.put("userCount", getUserCountInRoom(roomId));

        JSONObject currentState = roomState.get(roomId);
        if (currentState != null) {
            joinMsg.put("state", currentState);
            joinMsg.put("version", roomVersions.get(roomId).get());
        }

        broadcastToRoom(roomId, joinMsg.toJSONString(), null);
    }

    private void handleLeave(WebSocketSession session) {
        String roomId = userRooms.remove(session.getId());
        String userId = roomUsers.remove(session.getId());
        if (roomId != null) {
            leaveRoom(session.getId(), roomId);
        }
    }

    private void leaveRoom(String sessionId, String roomId) {
        JSONObject leaveMsg = new JSONObject();
        leaveMsg.put("type", "userLeave");
        leaveMsg.put("sessionId", sessionId);
        leaveMsg.put("userId", roomUsers.get(sessionId));
        leaveMsg.put("timestamp", System.currentTimeMillis());
        leaveMsg.put("userCount", getUserCountInRoom(roomId) - 1);

        broadcastToRoom(roomId, leaveMsg.toJSONString(), sessionId);

        if (getUserCountInRoom(roomId) == 0) {
            roomVersions.remove(roomId);
            roomState.remove(roomId);
        }
    }

    private void handleEdit(WebSocketSession session, JSONObject json) {
        String sessionId = session.getId();
        String roomId = userRooms.get(sessionId);
        if (roomId == null) return;

        Long lastEditTime = userLastEditTime.get(sessionId);
        long now = System.currentTimeMillis();
        if (lastEditTime != null && (now - lastEditTime) < EDIT_COOLDOWN_MS) {
            sendAck(session, json.getString("editId"), false, "操作过于频繁");
            return;
        }
        userLastEditTime.put(sessionId, now);

        long clientVersion = json.getLongValue("version");
        AtomicLong serverVersion = roomVersions.get(roomId);
        if (serverVersion == null) return;

        long currentVersion = serverVersion.get();
        if (clientVersion < currentVersion) {
            JSONObject conflictMsg = new JSONObject();
            conflictMsg.put("type", "conflict");
            conflictMsg.put("clientVersion", clientVersion);
            conflictMsg.put("serverVersion", currentVersion);
            conflictMsg.put("state", roomState.get(roomId));
            sendMessage(session, conflictMsg.toJSONString());
            return;
        }

        String field = json.getString("field");
        Object value = json.get("value");
        String editId = json.getString("editId");

        JSONObject state = roomState.computeIfAbsent(roomId, k -> new JSONObject());
        state.put(field, value);

        long newVersion = serverVersion.incrementAndGet();

        JSONObject broadcastMsg = new JSONObject();
        broadcastMsg.put("type", "edit");
        broadcastMsg.put("field", field);
        broadcastMsg.put("value", value);
        broadcastMsg.put("userId", roomUsers.get(sessionId));
        broadcastMsg.put("version", newVersion);
        broadcastMsg.put("editId", editId);
        broadcastMsg.put("timestamp", now);

        broadcastToRoom(roomId, broadcastMsg.toJSONString(), sessionId);
        sendAck(session, editId, true, null);
    }

    private void handleCursor(WebSocketSession session, JSONObject json) {
        String roomId = userRooms.get(session.getId());
        if (roomId == null) return;

        JSONObject cursorMsg = new JSONObject();
        cursorMsg.put("type", "cursor");
        cursorMsg.put("userId", roomUsers.get(session.getId()));
        cursorMsg.put("x", json.getDouble("x"));
        cursorMsg.put("y", json.getDouble("y"));
        cursorMsg.put("selection", json.get("selection"));

        broadcastToRoom(roomId, cursorMsg.toJSONString(), session.getId());
    }

    private void handleSync(WebSocketSession session, JSONObject json) {
        String roomId = userRooms.get(session.getId());
        if (roomId == null) return;

        AtomicLong version = roomVersions.get(roomId);
        JSONObject state = roomState.get(roomId);

        JSONObject syncMsg = new JSONObject();
        syncMsg.put("type", "sync");
        syncMsg.put("version", version != null ? version.get() : 0);
        syncMsg.put("state", state != null ? state : new JSONObject());

        sendMessage(session, syncMsg.toJSONString());
    }

    private void handleCommit(WebSocketSession session, JSONObject json) {
        String roomId = userRooms.get(session.getId());
        if (roomId == null) return;

        long clientVersion = json.getLongValue("version");
        AtomicLong serverVersion = roomVersions.get(roomId);
        if (serverVersion == null || clientVersion < serverVersion.get()) {
            sendAck(session, json.getString("commitId"), false, "版本冲突，请先同步");
            return;
        }

        JSONObject commitMsg = new JSONObject();
        commitMsg.put("type", "commit");
        commitMsg.put("userId", roomUsers.get(session.getId()));
        commitMsg.put("commitId", json.getString("commitId"));
        commitMsg.put("data", json.get("data"));
        commitMsg.put("timestamp", System.currentTimeMillis());

        broadcastToRoom(roomId, commitMsg.toJSONString(), session.getId());
        sendAck(session, json.getString("commitId"), true, null);
    }

    private void sendAck(WebSocketSession session, String id, boolean success, String message) {
        JSONObject ack = new JSONObject();
        ack.put("type", "ack");
        ack.put("id", id);
        ack.put("success", success);
        if (message != null) {
            ack.put("message", message);
        }
        sendMessage(session, ack.toJSONString());
    }

    private void sendError(WebSocketSession session, String message) {
        JSONObject error = new JSONObject();
        error.put("type", "error");
        error.put("message", message);
        sendMessage(session, error.toJSONString());
    }

    private void sendMessage(WebSocketSession session, String message) {
        if (session != null && session.isOpen()) {
            try {
                session.sendMessage(new TextMessage(message));
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }

    private void broadcastToRoom(String roomId, String message, String excludeSessionId) {
        for (Map.Entry<String, String> entry : userRooms.entrySet()) {
            if (entry.getValue().equals(roomId) && !entry.getKey().equals(excludeSessionId)) {
                WebSocketSession targetSession = sessions.get(entry.getKey());
                if (targetSession != null && targetSession.isOpen()) {
                    try {
                        targetSession.sendMessage(new TextMessage(message));
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
            }
        }
    }

    private void broadcastToRoom(WebSocketSession sourceSession, JSONObject json) {
        String roomId = userRooms.get(sourceSession.getId());
        if (roomId != null) {
            broadcastToRoom(roomId, json.toJSONString(), sourceSession.getId());
        }
    }

    private int getUserCountInRoom(String roomId) {
        int count = 0;
        for (String r : userRooms.values()) {
            if (r.equals(roomId)) count++;
        }
        return count;
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        handleLeave(session);
        sessions.remove(session.getId());
        userLastEditTime.remove(session.getId());
        System.out.println("连接关闭: " + session.getId());
    }
}

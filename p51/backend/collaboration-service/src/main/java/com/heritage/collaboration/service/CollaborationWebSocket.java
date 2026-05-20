package com.heritage.collaboration.service;

import com.alibaba.fastjson.JSON;
import com.heritage.collaboration.model.CollaborationMessage;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

import javax.websocket.*;
import javax.websocket.server.PathParam;
import javax.websocket.server.ServerEndpoint;
import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
@ServerEndpoint("/ws/collaborate/{sessionId}/{userId}/{userName}")
public class CollaborationWebSocket {
    
    private static RedisTemplate<String, Object> redisTemplate;
    
    @Autowired
    public void setRedisTemplate(RedisTemplate<String, Object> redisTemplate) {
        CollaborationWebSocket.redisTemplate = redisTemplate;
    }
    
    private static final Map<String, Map<String, Session>> sessionMap = new ConcurrentHashMap<>();
    private static final Map<String, Map<String, String>> userSessionMap = new ConcurrentHashMap<>();
    
    @OnOpen
    public void onOpen(Session session, 
                       @PathParam("sessionId") String sessionId,
                       @PathParam("userId") String userId,
                       @PathParam("userName") String userName) {
        
        sessionMap.computeIfAbsent(sessionId, k -> new ConcurrentHashMap<>())
                  .put(userId, session);
        
        userSessionMap.computeIfAbsent(sessionId, k -> new ConcurrentHashMap<>())
                      .put(userId, userName);
        
        broadcastUserList(sessionId);
        
        CollaborationMessage joinMsg = new CollaborationMessage();
        joinMsg.setType("USER_JOIN");
        joinMsg.setSessionId(sessionId);
        joinMsg.setUserId(userId);
        joinMsg.setUserName(userName);
        joinMsg.setMessage(userName + " 加入了协同设计");
        broadcast(sessionId, JSON.toJSONString(joinMsg));
        
        System.out.println("User joined: " + userName + " in session: " + sessionId);
    }
    
    @OnMessage
    public void onMessage(String message, Session session,
                          @PathParam("sessionId") String sessionId,
                          @PathParam("userId") String userId,
                          @PathParam("userName") String userName) {
        try {
            CollaborationMessage msg = JSON.parseObject(message, CollaborationMessage.class);
            msg.setUserId(userId);
            msg.setUserName(userName);
            msg.setTimestamp(LocalDateTime.now());
            
            saveOperationLog(sessionId, msg);
            broadcast(sessionId, JSON.toJSONString(msg));
            
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
    
    @OnClose
    public void onClose(Session session,
                        @PathParam("sessionId") String sessionId,
                        @PathParam("userId") String userId,
                        @PathParam("userName") String userName) {
        
        Map<String, Session> userMap = sessionMap.get(sessionId);
        if (userMap != null) {
            userMap.remove(userId);
            if (userMap.isEmpty()) {
                sessionMap.remove(sessionId);
                userSessionMap.remove(sessionId);
            }
        }
        
        Map<String, String> userNameMap = userSessionMap.get(sessionId);
        if (userNameMap != null) {
            userNameMap.remove(userId);
        }
        
        broadcastUserList(sessionId);
        
        CollaborationMessage leaveMsg = new CollaborationMessage();
        leaveMsg.setType("USER_LEAVE");
        leaveMsg.setSessionId(sessionId);
        leaveMsg.setUserId(userId);
        leaveMsg.setUserName(userName);
        leaveMsg.setMessage(userName + " 离开了协同设计");
        broadcast(sessionId, JSON.toJSONString(leaveMsg));
        
        System.out.println("User left: " + userName + " from session: " + sessionId);
    }
    
    @OnError
    public void onError(Session session, Throwable error) {
        error.printStackTrace();
    }
    
    private void broadcast(String sessionId, String message) {
        Map<String, Session> userMap = sessionMap.get(sessionId);
        if (userMap != null) {
            userMap.values().forEach(s -> {
                try {
                    if (s.isOpen()) {
                        s.getBasicRemote().sendText(message);
                    }
                } catch (IOException e) {
                    e.printStackTrace();
                }
            });
        }
    }
    
    private void broadcastUserList(String sessionId) {
        Map<String, String> userNameMap = userSessionMap.get(sessionId);
        if (userNameMap != null) {
            CollaborationMessage userListMsg = new CollaborationMessage();
            userListMsg.setType("USER_LIST");
            userListMsg.setSessionId(sessionId);
            userListMsg.setUserList(userNameMap);
            
            broadcast(sessionId, JSON.toJSONString(userListMsg));
        }
    }
    
    private void saveOperationLog(String sessionId, CollaborationMessage msg) {
        String key = "collab:log:" + sessionId;
        redisTemplate.opsForList().rightPush(key, JSON.toJSONString(msg));
        redisTemplate.opsForList().trim(key, -100, -1);
    }
    
    public static Set<String> getActiveSessions() {
        return sessionMap.keySet();
    }
    
    public static Map<String, String> getSessionUsers(String sessionId) {
        return userSessionMap.get(sessionId);
    }
}
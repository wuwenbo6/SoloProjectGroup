package com.heritage.collaboration.controller;

import com.alibaba.fastjson.JSON;
import com.heritage.collaboration.model.CollaborationMessage;
import com.heritage.collaboration.service.CollaborationWebSocket;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/collaboration")
@CrossOrigin(origins = "*")
public class CollaborationController {
    
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    
    @GetMapping("/sessions")
    public Map<String, Object> getActiveSessions() {
        Map<String, Object> result = new HashMap<>();
        Set<String> sessions = CollaborationWebSocket.getActiveSessions();
        result.put("sessions", sessions);
        result.put("count", sessions.size());
        
        Map<String, Map<String, String>> sessionUsers = new HashMap<>();
        for (String sessionId : sessions) {
            sessionUsers.put(sessionId, CollaborationWebSocket.getSessionUsers(sessionId));
        }
        result.put("sessionUsers", sessionUsers);
        
        return result;
    }
    
    @GetMapping("/session/{sessionId}/users")
    public Map<String, String> getSessionUsers(@PathVariable String sessionId) {
        return CollaborationWebSocket.getSessionUsers(sessionId);
    }
    
    @GetMapping("/session/{sessionId}/logs")
    public List<CollaborationMessage> getSessionLogs(@PathVariable String sessionId) {
        String key = "collab:log:" + sessionId;
        List<Object> logs = redisTemplate.opsForList().range(key, 0, -1);
        List<CollaborationMessage> result = new ArrayList<>();
        if (logs != null) {
            for (Object log : logs) {
                result.add(JSON.parseObject((String) log, CollaborationMessage.class));
            }
        }
        return result;
    }
    
    @PostMapping("/session/create")
    public Map<String, String> createSession(@RequestBody Map<String, String> request) {
        String equipmentId = request.get("equipmentId");
        String userId = request.get("userId");
        String sessionId = "SESSION-" + System.currentTimeMillis() + "-" + equipmentId;
        
        Map<String, String> result = new HashMap<>();
        result.put("sessionId", sessionId);
        result.put("equipmentId", equipmentId);
        result.put("creatorId", userId);
        result.put("createTime", String.valueOf(System.currentTimeMillis()));
        
        return result;
    }
    
    @DeleteMapping("/session/{sessionId}")
    public Map<String, Object> clearSessionLogs(@PathVariable String sessionId) {
        String key = "collab:log:" + sessionId;
        Boolean deleted = redisTemplate.delete(key);
        
        Map<String, Object> result = new HashMap<>();
        result.put("success", deleted);
        result.put("message", deleted ? "操作日志已清空" : "清空失败");
        return result;
    }
    
    @GetMapping("/statistics")
    public Map<String, Object> getStatistics() {
        Map<String, Object> stats = new HashMap<>();
        Set<String> sessions = CollaborationWebSocket.getActiveSessions();
        
        int totalUsers = 0;
        for (String sessionId : sessions) {
            Map<String, String> users = CollaborationWebSocket.getSessionUsers(sessionId);
            if (users != null) {
                totalUsers += users.size();
            }
        }
        
        stats.put("activeSessions", sessions.size());
        stats.put("totalOnlineUsers", totalUsers);
        stats.put("avgUsersPerSession", sessions.size() > 0 ? 
                (double) totalUsers / sessions.size() : 0);
        
        return stats;
    }
}
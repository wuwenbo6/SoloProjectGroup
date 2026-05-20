package com.bamboo.craft.controller;

import com.bamboo.craft.entity.interaction.Comment;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;

@Controller
public class WebSocketController {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/craft/{craftId}/comment")
    @SendTo("/topic/craft/{craftId}/comments")
    public Map<String, Object> sendComment(@DestinationVariable Long craftId, Comment comment) {
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("data", comment);
        result.put("timestamp", LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
        return result;
    }

    @MessageMapping("/craft/{craftId}/like")
    @SendTo("/topic/craft/{craftId}/likes")
    public Map<String, Object> sendLikeNotification(@DestinationVariable Long craftId, Map<String, Object> payload) {
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("craftId", craftId);
        result.put("userId", payload.get("userId"));
        result.put("timestamp", LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
        return result;
    }

    public void broadcastNewComment(Long craftId, Comment comment) {
        messagingTemplate.convertAndSend("/topic/craft/" + craftId + "/comments", comment);
    }

    public void broadcastLikeUpdate(Long craftId, Integer likes) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("craftId", craftId);
        payload.put("likes", likes);
        payload.put("timestamp", LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
        messagingTemplate.convertAndSend("/topic/craft/" + craftId + "/likes", payload);
    }
}

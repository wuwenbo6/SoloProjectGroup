package com.fittrack.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fittrack.dto.RoomMessageDTO;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

@Service
public class RoomMessagePublisher {

    private static final String CHANNEL_PREFIX = "room:";

    private final RedisTemplate<String, Object> redisTemplate;
    private final ObjectMapper objectMapper;
    private final RoomService roomService;

    public RoomMessagePublisher(RedisTemplate<String, Object> redisTemplate,
                                ObjectMapper objectMapper,
                                RoomService roomService) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
        this.roomService = roomService;
    }

    public void publishCoachCommand(String roomId, Long coachId, String coachName, String command) {
        RoomMessageDTO message = RoomMessageDTO.createCoachCommand(roomId, coachId, coachName, command);
        publish(roomId, message);
        roomService.updateCurrentAction(roomId, command);
    }

    public void publishUserJoin(String roomId, Long userId, String userName) {
        RoomMessageDTO message = RoomMessageDTO.createJoinNotification(roomId, userId, userName);
        publish(roomId, message);
    }

    public void publishUserLeave(String roomId, Long userId, String userName) {
        RoomMessageDTO message = RoomMessageDTO.createLeaveNotification(roomId, userId, userName);
        publish(roomId, message);
    }

    public void publishCustomMessage(String roomId, RoomMessageDTO message) {
        publish(roomId, message);
    }

    private void publish(String roomId, RoomMessageDTO message) {
        try {
            String channel = CHANNEL_PREFIX + roomId;
            String json = objectMapper.writeValueAsString(message);
            redisTemplate.convertAndSend(channel, json);
            System.out.println("Published message to channel " + channel + ": " + message.getType());
        } catch (Exception e) {
            System.err.println("Failed to publish room message: " + e.getMessage());
        }
    }
}

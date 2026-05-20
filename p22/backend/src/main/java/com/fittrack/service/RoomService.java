package com.fittrack.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fittrack.dto.CreateRoomRequest;
import com.fittrack.dto.RoomDTO;
import com.fittrack.dto.RoomMessageDTO;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@Service
public class RoomService {

    private static final String ROOM_KEY_PREFIX = "room:";
    private static final String ROOM_SET_KEY = "rooms:active";
    private static final int MAX_PARTICIPANTS = 20;
    private static final long ROOM_EXPIRE_HOURS = 24;

    private final RedisTemplate<String, Object> redisTemplate;
    private final ObjectMapper objectMapper;
    private final Map<String, Set<String>> sessionToRooms = new ConcurrentHashMap<>();

    public RoomService(RedisTemplate<String, Object> redisTemplate, ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    public RoomDTO createRoom(CreateRoomRequest request) {
        String roomId = generateRoomId();

        RoomDTO room = new RoomDTO();
        room.setRoomId(roomId);
        room.setRoomName(request.getRoomName());
        room.setCoachId(request.getCoachId());
        room.setCoachName(request.getCoachName());
        room.setParticipantIds(Collections.synchronizedSet(new HashSet<>()));
        room.setParticipantCount(0);
        room.setMaxParticipants(Math.min(request.getMaxParticipants(), MAX_PARTICIPANTS));
        room.setStatus("ACTIVE");
        room.setCreatedAt(LocalDateTime.now());
        room.setExerciseTemplateId(request.getExerciseTemplateId());

        saveRoom(room);
        redisTemplate.opsForSet().add(ROOM_SET_KEY, roomId);

        return room;
    }

    public RoomDTO joinRoom(String roomId, Long userId, String userName, String sessionId) {
        RoomDTO room = getRoom(roomId);
        if (room == null) {
            throw new RuntimeException("Room not found: " + roomId);
        }

        if (!"ACTIVE".equals(room.getStatus())) {
            throw new RuntimeException("Room is not active");
        }

        if (room.getParticipantCount() >= room.getMaxParticipants()) {
            throw new RuntimeException("Room is full");
        }

        String userIdStr = String.valueOf(userId);
        if (!room.getParticipantIds().contains(userIdStr)) {
            room.getParticipantIds().add(userIdStr);
            room.setParticipantCount(room.getParticipantCount() + 1);
            saveRoom(room);

            sessionToRooms.computeIfAbsent(sessionId, k -> ConcurrentHashMap.newKeySet())
                    .add(roomId);
        }

        return room;
    }

    public void leaveRoom(String roomId, Long userId, String sessionId) {
        RoomDTO room = getRoom(roomId);
        if (room == null) {
            return;
        }

        String userIdStr = String.valueOf(userId);
        if (room.getParticipantIds().remove(userIdStr)) {
            room.setParticipantCount(room.getParticipantCount() - 1);
            saveRoom(room);
        }

        Set<String> rooms = sessionToRooms.get(sessionId);
        if (rooms != null) {
            rooms.remove(roomId);
        }

        if (room.getParticipantCount() == 0 && !userId.equals(room.getCoachId())) {
            room.setStatus("INACTIVE");
            saveRoom(room);
        }
    }

    public void cleanupSession(String sessionId) {
        Set<String> rooms = sessionToRooms.remove(sessionId);
        if (rooms != null) {
            for (String roomId : rooms) {
                RoomDTO room = getRoom(roomId);
                if (room != null) {
                    room.getParticipantIds().removeIf(id -> true);
                    room.setParticipantCount(room.getParticipantIds().size());
                    saveRoom(room);
                }
            }
        }
    }

    public RoomDTO getRoom(String roomId) {
        String key = ROOM_KEY_PREFIX + roomId;
        Object obj = redisTemplate.opsForValue().get(key);
        if (obj != null) {
            return objectMapper.convertValue(obj, RoomDTO.class);
        }
        return null;
    }

    public List<RoomDTO> getAllActiveRooms() {
        Set<Object> roomIds = redisTemplate.opsForSet().members(ROOM_SET_KEY);
        List<RoomDTO> rooms = new ArrayList<>();
        if (roomIds != null) {
            for (Object roomId : roomIds) {
                RoomDTO room = getRoom(roomId.toString());
                if (room != null && "ACTIVE".equals(room.getStatus())) {
                    rooms.add(room);
                }
            }
        }
        return rooms;
    }

    public void updateCurrentAction(String roomId, String action) {
        RoomDTO room = getRoom(roomId);
        if (room != null) {
            room.setCurrentAction(action);
            saveRoom(room);
        }
    }

    public void closeRoom(String roomId, Long coachId) {
        RoomDTO room = getRoom(roomId);
        if (room != null && coachId.equals(room.getCoachId())) {
            room.setStatus("CLOSED");
            saveRoom(room);
            redisTemplate.opsForSet().remove(ROOM_SET_KEY, roomId);
        }
    }

    private void saveRoom(RoomDTO room) {
        String key = ROOM_KEY_PREFIX + room.getRoomId();
        redisTemplate.opsForValue().set(key, room, ROOM_EXPIRE_HOURS, TimeUnit.HOURS);
    }

    private String generateRoomId() {
        return "ROOM-" + System.currentTimeMillis() + "-" +
                UUID.randomUUID().toString().substring(0, 6).toUpperCase();
    }

    public Set<String> getSessionRooms(String sessionId) {
        return sessionToRooms.getOrDefault(sessionId, Collections.emptySet());
    }
}

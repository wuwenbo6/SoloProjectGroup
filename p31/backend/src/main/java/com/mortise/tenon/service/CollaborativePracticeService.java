package com.mortise.tenon.service;

import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class CollaborativePracticeService {

    private final Map<String, PracticeRoom> rooms = new ConcurrentHashMap<>();
    private final Map<String, User> onlineUsers = new ConcurrentHashMap<>();
    private final AtomicInteger roomIdGenerator = new AtomicInteger(1);

    public static class User {
        public String id;
        public String name;
        public String avatar;
        public String role;
        public String currentRoomId;
        public boolean isOnline;
        public long lastActiveTime;
        public int score;
        public int level;
        public String color;
    }

    public static class PracticeRoom {
        public String id;
        public String name;
        public String modelId;
        public String hostId;
        public int maxPlayers;
        public Map<String, User> players = new ConcurrentHashMap<>();
        public Map<String, Double> playerProgress = new ConcurrentHashMap<>();
        public Map<String, Integer> componentAssignments = new ConcurrentHashMap<>();
        public boolean isStarted;
        public boolean isFinished;
        public long createTime;
        public long startTime;
        public String practiceMode;
        public Map<Integer, Double> componentProgress = new ConcurrentHashMap<>();
        public List<String> chatHistory = new ArrayList<>();
        public int difficulty;
    }

    public static class PracticeRecord {
        public String userId;
        public String roomId;
        public String modelId;
        public int score;
        public int timeUsed;
        public int accuracy;
        public Date finishTime;
        public String mode;
    }

    private final List<PracticeRecord> practiceHistory = new ArrayList<>();

    @PostConstruct
    public void init() {
        createDemoUser("user_1", "木匠大师", "master");
        createDemoUser("user_2", "学徒小王", "student");
        createDemoUser("user_3", "古建专家", "expert");
        createDemoUser("user_4", "修复工程师", "engineer");
    }

    private void createDemoUser(String id, String name, String role) {
        User user = new User();
        user.id = id;
        user.name = name;
        user.role = role;
        user.avatar = id;
        user.isOnline = true;
        user.lastActiveTime = System.currentTimeMillis();
        user.score = new Random().nextInt(5000) + 1000;
        user.level = user.score / 1000 + 1;
        user.color = getRandomColor();
        onlineUsers.put(id, user);
    }

    private String getRandomColor() {
        String[] colors = {"#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F"};
        return colors[new Random().nextInt(colors.length)];
    }

    public JSONObject createRoom(String hostId, String name, String modelId, int maxPlayers, String mode, int difficulty) {
        String roomId = "room_" + roomIdGenerator.getAndIncrement();
        
        PracticeRoom room = new PracticeRoom();
        room.id = roomId;
        room.name = name;
        room.modelId = modelId;
        room.hostId = hostId;
        room.maxPlayers = maxPlayers;
        room.practiceMode = mode;
        room.difficulty = difficulty;
        room.isStarted = false;
        room.isFinished = false;
        room.createTime = System.currentTimeMillis();
        
        User host = onlineUsers.get(hostId);
        if (host != null) {
            room.players.put(hostId, host);
            host.currentRoomId = roomId;
        }
        
        rooms.put(roomId, room);
        
        JSONObject result = new JSONObject();
        result.put("success", true);
        result.put("roomId", roomId);
        result.put("message", "房间创建成功");
        return result;
    }

    public JSONObject joinRoom(String userId, String roomId) {
        JSONObject result = new JSONObject();
        
        PracticeRoom room = rooms.get(roomId);
        if (room == null) {
            result.put("success", false);
            result.put("message", "房间不存在");
            return result;
        }
        
        if (room.players.size() >= room.maxPlayers) {
            result.put("success", false);
            result.put("message", "房间已满");
            return result;
        }
        
        if (room.isStarted) {
            result.put("success", false);
            result.put("message", "练习已开始，无法加入");
            return result;
        }
        
        User user = onlineUsers.get(userId);
        if (user == null) {
            result.put("success", false);
            result.put("message", "用户不存在");
            return result;
        }
        
        room.players.put(userId, user);
        user.currentRoomId = roomId;
        room.playerProgress.put(userId, 0.0);
        
        result.put("success", true);
        result.put("message", "加入成功");
        result.put("room", roomToJson(room));
        return result;
    }

    public JSONObject leaveRoom(String userId, String roomId) {
        JSONObject result = new JSONObject();
        
        PracticeRoom room = rooms.get(roomId);
        if (room == null) {
            result.put("success", false);
            result.put("message", "房间不存在");
            return result;
        }
        
        User user = room.players.remove(userId);
        if (user != null) {
            user.currentRoomId = null;
            room.playerProgress.remove(userId);
            room.componentAssignments.entrySet().removeIf(e -> e.getValue().equals(userId));
        }
        
        if (room.players.isEmpty()) {
            rooms.remove(roomId);
            result.put("message", "房间已解散");
        } else if (room.hostId.equals(userId)) {
            room.hostId = room.players.keySet().iterator().next();
            result.put("message", "已离开房间，房主已转移");
        } else {
            result.put("message", "已离开房间");
        }
        
        result.put("success", true);
        return result;
    }

    public JSONObject startPractice(String userId, String roomId) {
        JSONObject result = new JSONObject();
        
        PracticeRoom room = rooms.get(roomId);
        if (room == null) {
            result.put("success", false);
            result.put("message", "房间不存在");
            return result;
        }
        
        if (!room.hostId.equals(userId)) {
            result.put("success", false);
            result.put("message", "只有房主可以开始练习");
            return result;
        }
        
        room.isStarted = true;
        room.startTime = System.currentTimeMillis();
        
        int componentIndex = 0;
        for (String playerId : room.players.keySet()) {
            room.componentAssignments.put(String.valueOf(componentIndex % 4), componentIndex);
            componentIndex++;
        }
        
        for (int i = 0; i < 4; i++) {
            room.componentProgress.put(i, 0.0);
        }
        
        result.put("success", true);
        result.put("message", "练习开始");
        result.put("startTime", room.startTime);
        result.put("assignments", room.componentAssignments);
        return result;
    }

    public JSONObject updateComponentProgress(String userId, String roomId, int componentIndex, double progress) {
        JSONObject result = new JSONObject();
        
        PracticeRoom room = rooms.get(roomId);
        if (room == null || !room.isStarted) {
            result.put("success", false);
            result.put("message", "练习未开始或已结束");
            return result;
        }
        
        Integer assignedComponent = room.componentAssignments.get(userId);
        if (assignedComponent == null || assignedComponent != componentIndex) {
            result.put("success", false);
            result.put("message", "您没有操作该构件的权限");
            return result;
        }
        
        room.componentProgress.put(componentIndex, progress);
        room.playerProgress.put(userId, progress);
        
        double totalProgress = room.componentProgress.values().stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
        
        if (totalProgress >= 1.0) {
            room.isFinished = true;
            for (String playerId : room.players.keySet()) {
                PracticeRecord record = new PracticeRecord();
                record.userId = playerId;
                record.roomId = roomId;
                record.modelId = room.modelId;
                record.score = (int)(totalProgress * 1000) + room.players.size() * 100;
                record.timeUsed = (int)((System.currentTimeMillis() - room.startTime) / 1000);
                record.accuracy = 95 + new Random().nextInt(5);
                record.finishTime = new Date();
                record.mode = room.practiceMode;
                practiceHistory.add(record);
                
                User user = room.players.get(playerId);
                if (user != null) {
                    user.score += record.score;
                    user.level = user.score / 1000 + 1;
                }
            }
        }
        
        result.put("success", true);
        result.put("componentProgress", room.componentProgress);
        result.put("playerProgress", room.playerProgress);
        result.put("totalProgress", totalProgress);
        result.put("isFinished", room.isFinished);
        return result;
    }

    public JSONObject sendMessage(String userId, String roomId, String message) {
        JSONObject result = new JSONObject();
        
        PracticeRoom room = rooms.get(roomId);
        if (room == null) {
            result.put("success", false);
            result.put("message", "房间不存在");
            return result;
        }
        
        User user = room.players.get(userId);
        if (user == null) {
            result.put("success", false);
            result.put("message", "您不在此房间");
            return result;
        }
        
        JSONObject chatMsg = new JSONObject();
        chatMsg.put("userId", userId);
        chatMsg.put("userName", user.name);
        chatMsg.put("color", user.color);
        chatMsg.put("message", message);
        chatMsg.put("timestamp", System.currentTimeMillis());
        
        room.chatHistory.add(chatMsg.toJSONString());
        if (room.chatHistory.size() > 50) {
            room.chatHistory.remove(0);
        }
        
        result.put("success", true);
        result.put("chat", chatMsg);
        return result;
    }

    public JSONObject getRoomState(String roomId) {
        JSONObject result = new JSONObject();
        
        PracticeRoom room = rooms.get(roomId);
        if (room == null) {
            result.put("success", false);
            result.put("message", "房间不存在");
            return result;
        }
        
        result.put("success", true);
        result.put("room", roomToJson(room));
        return result;
    }

    public JSONArray listRooms() {
        JSONArray list = new JSONArray();
        for (PracticeRoom room : rooms.values()) {
            list.add(roomToJson(room));
        }
        return list;
    }

    public JSONArray getOnlineUsers() {
        JSONArray list = new JSONArray();
        for (User user : onlineUsers.values()) {
            JSONObject userJson = new JSONObject();
            userJson.put("id", user.id);
            userJson.put("name", user.name);
            userJson.put("role", user.role);
            userJson.put("level", user.level);
            userJson.put("score", user.score);
            userJson.put("color", user.color);
            userJson.put("isOnline", user.isOnline);
            userJson.put("currentRoomId", user.currentRoomId);
            list.add(userJson);
        }
        return list;
    }

    public JSONArray getPracticeHistory(String userId) {
        JSONArray list = new JSONArray();
        for (PracticeRecord record : practiceHistory) {
            if (userId == null || record.userId.equals(userId)) {
                JSONObject rec = new JSONObject();
                rec.put("userId", record.userId);
                rec.put("roomId", record.roomId);
                rec.put("modelId", record.modelId);
                rec.put("score", record.score);
                rec.put("timeUsed", record.timeUsed);
                rec.put("accuracy", record.accuracy);
                rec.put("finishTime", record.finishTime);
                rec.put("mode", record.mode);
                list.add(rec);
            }
        }
        return list;
    }

    private JSONObject roomToJson(PracticeRoom room) {
        JSONObject json = new JSONObject();
        json.put("id", room.id);
        json.put("name", room.name);
        json.put("modelId", room.modelId);
        json.put("hostId", room.hostId);
        json.put("maxPlayers", room.maxPlayers);
        json.put("currentPlayers", room.players.size());
        json.put("isStarted", room.isStarted);
        json.put("isFinished", room.isFinished);
        json.put("practiceMode", room.practiceMode);
        json.put("difficulty", room.difficulty);
        json.put("createTime", room.createTime);
        json.put("startTime", room.startTime);
        
        JSONArray players = new JSONArray();
        for (User user : room.players.values()) {
            JSONObject p = new JSONObject();
            p.put("id", user.id);
            p.put("name", user.name);
            p.put("role", user.role);
            p.put("level", user.level);
            p.put("color", user.color);
            p.put("progress", room.playerProgress.getOrDefault(user.id, 0.0));
            players.add(p);
        }
        json.put("players", players);
        
        json.put("componentProgress", room.componentProgress);
        json.put("componentAssignments", room.componentAssignments);
        
        JSONArray chat = new JSONArray();
        for (String msg : room.chatHistory) {
            chat.add(JSONObject.parseObject(msg));
        }
        json.put("chatHistory", chat);
        
        return json;
    }

    public JSONObject getRanking() {
        JSONObject result = new JSONObject();
        List<User> sortedUsers = new ArrayList<>(onlineUsers.values());
        sortedUsers.sort((a, b) -> Integer.compare(b.score, a.score));
        
        JSONArray ranking = new JSONArray();
        for (int i = 0; i < sortedUsers.size(); i++) {
            User user = sortedUsers.get(i);
            JSONObject rank = new JSONObject();
            rank.put("rank", i + 1);
            rank.put("userId", user.id);
            rank.put("userName", user.name);
            rank.put("score", user.score);
            rank.put("level", user.level);
            ranking.add(rank);
        }
        
        result.put("ranking", ranking);
        return result;
    }
}

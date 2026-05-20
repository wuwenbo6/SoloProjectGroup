package com.mortise.tenon.controller;

import com.alibaba.fastjson.JSONObject;
import com.mortise.tenon.common.Result;
import com.mortise.tenon.service.CollaborativePracticeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/collaborative")
@CrossOrigin(origins = "*")
public class CollaborativePracticeController {

    @Autowired
    private CollaborativePracticeService practiceService;

    @GetMapping("/rooms")
    public Result<?> listRooms() {
        return Result.success(practiceService.listRooms());
    }

    @GetMapping("/users")
    public Result<?> getOnlineUsers() {
        return Result.success(practiceService.getOnlineUsers());
    }

    @PostMapping("/room/create")
    public Result<?> createRoom(@RequestBody JSONObject params) {
        String hostId = params.getString("hostId");
        String name = params.getString("name");
        String modelId = params.getString("modelId");
        int maxPlayers = params.getIntValue("maxPlayers");
        String mode = params.getString("mode");
        int difficulty = params.getIntValue("difficulty");
        
        JSONObject result = practiceService.createRoom(hostId, name, modelId, maxPlayers, mode, difficulty);
        return result.getBoolean("success") ? Result.success(result) : Result.error(result.getString("message"));
    }

    @PostMapping("/room/join")
    public Result<?> joinRoom(@RequestBody JSONObject params) {
        String userId = params.getString("userId");
        String roomId = params.getString("roomId");
        
        JSONObject result = practiceService.joinRoom(userId, roomId);
        return result.getBoolean("success") ? Result.success(result) : Result.error(result.getString("message"));
    }

    @PostMapping("/room/leave")
    public Result<?> leaveRoom(@RequestBody JSONObject params) {
        String userId = params.getString("userId");
        String roomId = params.getString("roomId");
        
        JSONObject result = practiceService.leaveRoom(userId, roomId);
        return result.getBoolean("success") ? Result.success(result) : Result.error(result.getString("message"));
    }

    @PostMapping("/room/start")
    public Result<?> startPractice(@RequestBody JSONObject params) {
        String userId = params.getString("userId");
        String roomId = params.getString("roomId");
        
        JSONObject result = practiceService.startPractice(userId, roomId);
        return result.getBoolean("success") ? Result.success(result) : Result.error(result.getString("message"));
    }

    @PostMapping("/room/progress")
    public Result<?> updateProgress(@RequestBody JSONObject params) {
        String userId = params.getString("userId");
        String roomId = params.getString("roomId");
        int componentIndex = params.getIntValue("componentIndex");
        double progress = params.getDoubleValue("progress");
        
        JSONObject result = practiceService.updateComponentProgress(userId, roomId, componentIndex, progress);
        return result.getBoolean("success") ? Result.success(result) : Result.error(result.getString("message"));
    }

    @PostMapping("/room/chat")
    public Result<?> sendMessage(@RequestBody JSONObject params) {
        String userId = params.getString("userId");
        String roomId = params.getString("roomId");
        String message = params.getString("message");
        
        JSONObject result = practiceService.sendMessage(userId, roomId, message);
        return result.getBoolean("success") ? Result.success(result) : Result.error(result.getString("message"));
    }

    @GetMapping("/room/{roomId}")
    public Result<?> getRoomState(@PathVariable String roomId) {
        JSONObject result = practiceService.getRoomState(roomId);
        return result.getBoolean("success") ? Result.success(result) : Result.error(result.getString("message"));
    }

    @GetMapping("/history/{userId}")
    public Result<?> getPracticeHistory(@PathVariable String userId) {
        return Result.success(practiceService.getPracticeHistory(userId));
    }

    @GetMapping("/ranking")
    public Result<?> getRanking() {
        return Result.success(practiceService.getRanking());
    }
}

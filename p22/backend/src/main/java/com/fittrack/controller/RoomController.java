package com.fittrack.controller;

import com.fittrack.dto.*;
import com.fittrack.service.RoomMessagePublisher;
import com.fittrack.service.RoomMessageSubscriber;
import com.fittrack.service.RoomService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/rooms")
@CrossOrigin(origins = "*")
public class RoomController {

    private final RoomService roomService;
    private final RoomMessagePublisher messagePublisher;
    private final RoomMessageSubscriber messageSubscriber;

    public RoomController(RoomService roomService,
                          RoomMessagePublisher messagePublisher,
                          RoomMessageSubscriber messageSubscriber) {
        this.roomService = roomService;
        this.messagePublisher = messagePublisher;
        this.messageSubscriber = messageSubscriber;
    }

    @PostMapping("/create")
    public ResponseEntity<RoomDTO> createRoom(@RequestBody CreateRoomRequest request) {
        RoomDTO room = roomService.createRoom(request);
        return ResponseEntity.ok(room);
    }

    @PostMapping("/{roomId}/join")
    public ResponseEntity<RoomDTO> joinRoom(
            @PathVariable String roomId,
            @RequestParam Long userId,
            @RequestParam String userName,
            @RequestParam(required = false) String sessionId) {
        RoomDTO room = roomService.joinRoom(roomId, userId, userName, sessionId != null ? sessionId : "");
        if (sessionId != null) {
            messageSubscriber.addSessionToRoom(roomId, sessionId);
        }
        messagePublisher.publishUserJoin(roomId, userId, userName);
        return ResponseEntity.ok(room);
    }

    @PostMapping("/{roomId}/leave")
    public ResponseEntity<Void> leaveRoom(
            @PathVariable String roomId,
            @RequestParam Long userId,
            @RequestParam String userName,
            @RequestParam(required = false) String sessionId) {
        roomService.leaveRoom(roomId, userId, sessionId != null ? sessionId : "");
        if (sessionId != null) {
            messageSubscriber.removeSessionFromRoom(roomId, sessionId);
        }
        messagePublisher.publishUserLeave(roomId, userId, userName);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{roomId}/broadcast")
    public ResponseEntity<Void> broadcastCommand(
            @PathVariable String roomId,
            @RequestParam Long coachId,
            @RequestParam String coachName,
            @RequestParam String command) {
        RoomDTO room = roomService.getRoom(roomId);
        if (room == null || !coachId.equals(room.getCoachId())) {
            return ResponseEntity.badRequest().build();
        }
        messagePublisher.publishCoachCommand(roomId, coachId, coachName, command);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{roomId}/message")
    public ResponseEntity<Void> sendMessage(
            @PathVariable String roomId,
            @RequestBody RoomMessageDTO message) {
        messagePublisher.publishCustomMessage(roomId, message);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{roomId}")
    public ResponseEntity<RoomDTO> getRoom(@PathVariable String roomId) {
        RoomDTO room = roomService.getRoom(roomId);
        return room != null ? ResponseEntity.ok(room) : ResponseEntity.notFound().build();
    }

    @GetMapping
    public ResponseEntity<List<RoomDTO>> getAllActiveRooms() {
        return ResponseEntity.ok(roomService.getAllActiveRooms());
    }

    @PostMapping("/{roomId}/close")
    public ResponseEntity<Void> closeRoom(
            @PathVariable String roomId,
            @RequestParam Long coachId) {
        roomService.closeRoom(roomId, coachId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/presets/actions")
    public ResponseEntity<List<Map<String, String>>> getPresetActions() {
        List<Map<String, String>> actions = List.of(
                Map.of("id", "squat_start", "name", "开始深蹲", "description", "双脚与肩同宽，挺胸收腹"),
                Map.of("id", "squat_down", "name", "下蹲", "description", "缓慢下蹲，膝盖不超过脚尖"),
                Map.of("id", "squat_up", "name", "起立", "description", "发力站起，保持平衡"),
                Map.of("id", "pushup_start", "name", "开始俯卧撑", "description", "身体成一条直线，双手略宽于肩"),
                Map.of("id", "pushup_down", "name", "下降", "description", "缓慢屈肘下降，胸部接近地面"),
                Map.of("id", "pushup_up", "name", "撑起", "description", "发力撑起，保持身体稳定"),
                Map.of("id", "rest", "name", "休息", "description", "调整呼吸，准备下一组"),
                Map.of("id", "correct_form", "name", "纠正动作", "description", "注意动作标准，避免受伤")
        );
        return ResponseEntity.ok(actions);
    }
}

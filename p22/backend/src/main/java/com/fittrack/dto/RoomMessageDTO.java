package com.fittrack.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class RoomMessageDTO implements Serializable {
    private String type;
    private String roomId;
    private Long senderId;
    private String senderName;
    private String content;
    private LocalDateTime timestamp;
    private Object data;

    public static RoomMessageDTO createCoachCommand(String roomId, Long coachId, String coachName, String command) {
        return new RoomMessageDTO("COACH_COMMAND", roomId, coachId, coachName, command, LocalDateTime.now(), null);
    }

    public static RoomMessageDTO createJoinNotification(String roomId, Long userId, String userName) {
        return new RoomMessageDTO("USER_JOIN", roomId, userId, userName, "加入了房间", LocalDateTime.now(), null);
    }

    public static RoomMessageDTO createLeaveNotification(String roomId, Long userId, String userName) {
        return new RoomMessageDTO("USER_LEAVE", roomId, userId, userName, "离开了房间", LocalDateTime.now(), null);
    }
}

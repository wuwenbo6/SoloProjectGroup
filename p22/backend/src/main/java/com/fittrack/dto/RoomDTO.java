package com.fittrack.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.Set;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class RoomDTO implements Serializable {
    private String roomId;
    private String roomName;
    private Long coachId;
    private String coachName;
    private Set<String> participantIds;
    private int participantCount;
    private int maxParticipants;
    private String status;
    private LocalDateTime createdAt;
    private Long exerciseTemplateId;
    private String currentAction;
}

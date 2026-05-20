package com.fittrack.dto;

import lombok.Data;

@Data
public class CreateRoomRequest {
    private String roomName;
    private Long coachId;
    private String coachName;
    private Long exerciseTemplateId;
    private int maxParticipants = 20;
}

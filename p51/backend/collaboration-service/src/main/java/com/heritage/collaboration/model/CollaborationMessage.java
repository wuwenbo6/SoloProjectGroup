package com.heritage.collaboration.model;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class CollaborationMessage {
    private String type;
    private String sessionId;
    private Long equipmentId;
    private String userId;
    private String userName;
    private String action;
    private String target;
    private String data;
    private Double positionX;
    private Double positionY;
    private Double positionZ;
    private Double rotationX;
    private Double rotationY;
    private Double rotationZ;
    private String damageId;
    private String restorationStep;
    private String comment;
    private LocalDateTime timestamp;

    public CollaborationMessage() {
        this.timestamp = LocalDateTime.now();
    }
}

@Data
class UserCursor {
    private String userId;
    private String userName;
    private String color;
    private Double x;
    private Double y;
    private Double z;
}

@Data
class OperationLog {
    private String userId;
    private String userName;
    private String action;
    private String description;
    private LocalDateTime time;
}
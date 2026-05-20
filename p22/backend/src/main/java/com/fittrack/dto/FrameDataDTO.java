package com.fittrack.dto;

import lombok.Data;
import java.util.List;

@Data
public class FrameDataDTO {
    private Long timestamp;
    private Integer frameNumber;
    private List<KeypointDTO> keypoints;
    private String sessionId;
    private Long userId;
    private Long exerciseTemplateId;
}

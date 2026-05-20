package com.rubbing.dto;

import lombok.Data;

@Data
public class CaptureProgressDTO {
    private Integer current;
    private Integer total;
    private String status;
    private Integer estimatedTime;
}

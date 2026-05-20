package com.rubbing.dto;

import lombok.Data;

@Data
public class CaptureParamsDTO {
    private String resolution;
    private String colorDepth;
    private String scanMode;
    private Integer brightness;
    private Integer contrast;
    private Integer threshold;
    private Double sharpness;
    private Integer noiseLevel;
}

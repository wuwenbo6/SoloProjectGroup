package com.rubbing.dto;

import lombok.Data;

@Data
public class QualityAnalysisDTO {
    private Resolution resolution;
    private Integer sharpness;
    private Integer contrast;
    private Integer noise;
    private Integer score;

    @Data
    public static class Resolution {
        private Integer width;
        private Integer height;
    }
}

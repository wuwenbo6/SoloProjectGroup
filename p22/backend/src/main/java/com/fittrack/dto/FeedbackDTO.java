package com.fittrack.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class FeedbackDTO {
    private String type;
    private String message;
    private String voiceText;
    private Double accuracy;
    private Integer repsCount;
    private List<String> corrections;
    private Long timestamp;
}

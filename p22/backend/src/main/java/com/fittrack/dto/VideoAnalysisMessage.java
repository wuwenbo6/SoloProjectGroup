package com.fittrack.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class VideoAnalysisMessage implements Serializable {

    private String taskId;
    private Long userId;
    private Long exerciseTemplateId;
    private String videoPath;
    private int frameRate = 10;
    private int width = 640;
    private int height = 480;
}

package com.crafthub.preview3d.dto;

import lombok.Data;

@Data
public class CustomSolutionDTO {
    private Long requirementId;
    private Long baseModelId;
    private String name;
    private String description;
    private String materialSelections;
    private String colorConfig;
    private String sizeConfig;
    private String customParams;
    private String previewImage;
}

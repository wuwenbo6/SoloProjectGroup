package com.crafthub.supplychain.dto;

import lombok.Data;

@Data
public class MaterialSelectionDTO {
    private Long requirementId;
    private Long materialId;
    private Long specId;
    private Integer quantity;
    private String customizationNotes;
}

package com.mortise.furniture.dto;

import com.mortise.furniture.entity.Furniture;
import lombok.Data;

@Data
public class SimilarFurnitureDTO {
    private Furniture furniture;
    private Double similarityScore;
    private String similarityReason;
}

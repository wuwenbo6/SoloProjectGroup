package com.fittrack.dto;

import lombok.Data;

@Data
public class KeypointDTO {
    private String name;
    private Double x;
    private Double y;
    private Double z;
    private Double visibility;
}

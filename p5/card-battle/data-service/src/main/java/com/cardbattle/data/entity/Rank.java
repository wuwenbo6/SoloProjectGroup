package com.cardbattle.data.entity;

import lombok.Data;

@Data
public class Rank {
    private Integer id;
    private String name;
    private Integer minPoints;
    private Integer maxPoints;
    private String icon;
    private Integer order;
}
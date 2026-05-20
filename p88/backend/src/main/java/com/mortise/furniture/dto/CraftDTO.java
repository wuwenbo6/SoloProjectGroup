package com.mortise.furniture.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class CraftDTO {
    private Long id;
    private Long furnitureId;
    private Long mortiseId;
    private String title;
    private String content;
    private String steps;
    private Integer difficulty;
    private Integer estimatedTime;
    private String tools;
    private String materials;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}

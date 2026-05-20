package com.mortise.furniture.dto;

import lombok.Data;

@Data
public class CraftI18nDTO {
    private Long id;
    private String lang;
    private String title;
    private String content;
    private String steps;
    private String tools;
    private String materials;
}

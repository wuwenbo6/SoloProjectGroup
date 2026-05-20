package com.ancientbook.rarebook.dto;

import lombok.Data;

@Data
public class RareBookQueryDTO {

    private String bookCode;

    private String bookName;

    private String author;

    private String dynasty;

    private Integer conditionLevel;

    private Integer status;

    private Integer pageNum = 1;

    private Integer pageSize = 10;
}

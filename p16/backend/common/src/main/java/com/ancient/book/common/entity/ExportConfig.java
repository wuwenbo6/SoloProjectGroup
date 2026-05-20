package com.ancient.book.common.entity;

import lombok.Data;
import java.util.List;

@Data
public class ExportConfig {

    private List<Long> pageIds;

    private String bookName;

    private String format;

    private String layout;

    private String fontFamily;

    private Integer fontSize;

    private Integer lineSpacing;

    private String textDirection;

    private Boolean includeImages;

    private Boolean includeAnnotations;

    private Boolean includeRestorationMarks;

    private Boolean generateCover;

    private Boolean generateTableOfContents;

    private String pageSize;

    private Integer marginLeft;

    private Integer marginRight;

    private Integer marginTop;

    private Integer marginBottom;

    private String watermarkText;

    private Boolean enableWatermark;

    private String outputFileName;
}

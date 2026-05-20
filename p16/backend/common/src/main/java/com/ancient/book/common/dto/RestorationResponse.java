package com.ancient.book.common.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class RestorationResponse {

    private Long pageId;

    private String bookName;

    private Integer pageNumber;

    private String originalImagePath;

    private String restoredImagePath;

    private String extractedText;

    private String segmentedText;

    private String restoredText;

    private String aiSuggestions;

    private String variantCharacters;

    private Integer status;

    private String damageAreas;

    private Integer damageLevel;

    private Long draftId;

    private LocalDateTime processTime;

    private Boolean success = true;

    private String message;
}

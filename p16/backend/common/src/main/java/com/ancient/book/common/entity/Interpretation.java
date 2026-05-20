package com.ancient.book.common.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("interpretations")
public class Interpretation {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String ancientText;

    private String modernTranslation;

    private String pinyin;

    private String variantForms;

    private String semanticMeaning;

    private String historicalContext;

    private String sourceReferences;

    private String partOfSpeech;

    private String usageExamples;

    private String relatedWords;

    private Double confidence;

    private String sourceType;

    private Long verifierId;

    private LocalDateTime verifiedTime;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}

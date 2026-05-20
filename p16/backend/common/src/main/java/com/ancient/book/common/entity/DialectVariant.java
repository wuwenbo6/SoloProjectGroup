package com.ancient.book.common.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("dialect_variants")
public class DialectVariant {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String variantChar;

    private String standardChar;

    private String dialectRegion;

    private String dialectType;

    private String pinyin;

    private String usageContext;

    private String historicalPeriod;

    private String sourceReference;

    private Double confidence;

    private Integer frequency;

    private String examples;

    private String notes;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}

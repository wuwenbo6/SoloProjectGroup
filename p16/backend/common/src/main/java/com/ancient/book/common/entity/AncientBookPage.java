package com.ancient.book.common.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("ancient_book_pages")
public class AncientBookPage {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long bookId;

    private String bookName;

    private Integer pageNumber;

    private String originalImagePath;

    private String restoredImagePath;

    private String extractedText;

    private String segmentedText;

    private String semanticTags;

    private Integer status;

    private String damageAreas;

    private Integer damageLevel;

    private String variantCharacters;

    private Integer restorationStatus;

    private Long operatorId;

    private String remark;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}

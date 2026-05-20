package com.ancient.book.common.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@TableName("ancient_book_records")
public class AncientBookRecord {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String externalId;

    private Long dataSourceId;

    private String title;

    private String originalTitle;

    private String author;

    private String dynasty;

    private String era;

    private String category;

    private String subject;

    private String description;

    private String language;

    private String scriptType;

    private Integer pageCount;

    private Integer volumeCount;

    private String dimensions;

    private String material;

    private String condition;

    private String repositoryLocation;

    private String callNumber;

    private String accessLevel;

    private String copyrightStatus;

    private List<String> thumbnailUrls;

    private List<String> imageUrls;

    private List<String> fullTextUrls;

    private Map<String, Object> metadata;

    private String fetchStatus;

    private LocalDateTime fetchTime;

    private String fetchError;

    private Integer retryCount;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}

package com.ancient.book.common.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("ancient_data_sources")
public class AncientDataSource {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String sourceName;

    private String institution;

    private String region;

    private String apiEndpoint;

    private String authType;

    private String authCredentials;

    private String dataFormat;

    private String syncFrequency;

    private Integer maxRetries;

    private Integer retryIntervalSeconds;

    private Long timeoutMs;

    private Boolean isEnabled;

    private String status;

    private LocalDateTime lastSyncTime;

    private String lastSyncResult;

    private Long totalRecordsFetched;

    private String description;

    private Map<String, Object> metadata;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}

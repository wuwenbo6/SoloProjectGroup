package com.ancientbook.progress.entity;

import com.ancientbook.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
public class ProgressWarning extends BaseEntity {

    private String warningCode;

    private Long bookId;

    private String bookCode;

    private String bookName;

    private Long progressId;

    private String progressCode;

    private Integer warningType;

    private String warningTypeName;

    private Integer warningLevel;

    private String warningLevelName;

    private String warningTitle;

    private String warningContent;

    private String detailJson;

    private Integer status;

    private String handlerId;

    private String handlerName;

    private LocalDateTime handleTime;

    private String handleResult;

    private String remark;
}

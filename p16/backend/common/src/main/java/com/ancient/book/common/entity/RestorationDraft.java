package com.ancient.book.common.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("restoration_drafts")
public class RestorationDraft {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long pageId;

    private String draftName;

    private String draftContent;

    private String draftImagePath;

    private Integer restorationStep;

    private String aiSuggestions;

    private String manualEdits;

    private Long operatorId;

    private String operationLog;

    private Long parentDraftId;

    private Integer version;

    private Integer isCurrent;

    private Integer status;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}

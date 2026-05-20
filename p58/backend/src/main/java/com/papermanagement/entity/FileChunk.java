package com.papermanagement.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("file_chunk")
public class FileChunk {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String fileId;

    private Integer chunkNumber;

    private Integer chunkSize;

    private Long totalSize;

    private Integer totalChunks;

    private String chunkPath;

    private String fileName;

    private String contentType;

    private String batchNo;

    private String processCode;

    private Long createUserId;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableLogic
    private Integer deleted;
}

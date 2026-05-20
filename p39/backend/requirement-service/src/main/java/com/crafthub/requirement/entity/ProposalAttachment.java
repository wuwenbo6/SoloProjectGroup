package com.crafthub.requirement.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("proposal_attachment")
public class ProposalAttachment {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long proposalId;

    private String fileName;

    private String fileUrl;

    private String fileType;

    private Long fileSize;

    private Integer sortOrder;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @Version
    private Integer version;

    @TableLogic
    private Integer deleted;
}

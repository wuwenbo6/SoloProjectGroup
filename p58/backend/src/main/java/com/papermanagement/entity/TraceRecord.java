package com.papermanagement.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("trace_record")
public class TraceRecord {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String traceCode;

    private String batchNo;

    private String idempotentKey;

    private String qrCodeUrl;

    private String status;

    private Long createUserId;

    private LocalDateTime generateTime;

    private LocalDateTime verifyTime;

    private Integer verifyCount;

    private String remark;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}

package com.papermanagement.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("process_log")
public class ProcessLog {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String batchNo;

    private String processCode;

    private String processName;

    private Long craftsmanId;

    private String craftsmanName;

    private LocalDateTime startTime;

    private LocalDateTime endTime;

    private String parameters;

    private String status;

    private String abnormalFlag;

    private String abnormalDesc;

    private String remark;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}

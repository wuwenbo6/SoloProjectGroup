package com.papermanagement.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("sms_log")
public class SmsLog {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String mobile;

    private String content;

    private String templateCode;

    private String batchNo;

    private String processCode;

    private String alertType;

    private String sendStatus;

    private String resultCode;

    private String resultMsg;

    private LocalDateTime sendTime;

    private Long createUserId;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableLogic
    private Integer deleted;
}

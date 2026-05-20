package com.ancient.book.common.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.Map;

@Data
@TableName("audit_logs")
public class AuditLog {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String traceId;

    private Long userId;

    private String username;

    private String userRealName;

    private String module;

    private String operation;

    private String operationType;

    private String resourceType;

    private Long resourceId;

    private String resourceName;

    private String method;

    private String requestPath;

    private String requestParams;

    private String requestBody;

    private String responseResult;

    private Integer statusCode;

    private String clientIp;

    private String userAgent;

    private Long executionTime;

    private String beforeData;

    private String afterData;

    private String changeDescription;

    private String riskLevel;

    private String status;

    private String errorMessage;

    private String errorStack;

    private Map<String, Object> extra;

    private LocalDateTime createTime;
}

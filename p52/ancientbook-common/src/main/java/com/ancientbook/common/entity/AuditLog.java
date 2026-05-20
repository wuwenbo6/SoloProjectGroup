package com.ancientbook.common.entity;

import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
public class AuditLog extends BaseEntity {

    private String logId;

    private String traceId;

    private String module;

    private String operation;

    private String method;

    private String url;

    private String ipAddress;

    private String userAgent;

    private Long userId;

    private String username;

    private String requestParams;

    private String responseResult;

    private Integer status;

    private String errorMessage;

    private Long duration;

    private LocalDateTime requestTime;

    private LocalDateTime responseTime;

    private String bookCode;

    private Long workerId;

    private String workerName;

    private String processType;

    private String operationType;
}

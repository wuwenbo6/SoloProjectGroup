package com.folk.activity.audit.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.folk.activity.common.core.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_audit_record")
public class AuditRecord extends BaseEntity {
    private String bizType;
    private Long bizId;
    private String bizName;
    private Long applicantId;
    private String applicantName;
    private Integer status;
    private Long auditorId;
    private String auditorName;
    private String auditOpinion;
    private String remark;
    private Integer deleted;
}

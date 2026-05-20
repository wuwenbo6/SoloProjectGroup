package com.ancientbook.process.entity;

import com.ancientbook.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
public class ProcessVersion extends BaseEntity {

    private String versionCode;

    private String processCode;

    private String processName;

    private Integer majorVersion;

    private Integer minorVersion;

    private Integer patchVersion;

    private String versionName;

    private String description;

    private String changeLog;

    private Integer processType;

    private String materials;

    private String tools;

    private String steps;

    private String standard;

    private Integer difficultyLevel;

    private String applicableMaterials;

    private Integer minConditionLevel;

    private Integer maxConditionLevel;

    private String creatorId;

    private String creatorName;

    private String auditorId;

    private String auditorName;

    private LocalDateTime auditTime;

    private String auditOpinion;

    private Integer status;

    private Boolean isCurrent;

    private String remark;

    public String getVersionNumber() {
        return majorVersion + "." + minorVersion + "." + patchVersion;
    }
}

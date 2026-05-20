package com.ancientbook.archive.entity;

import com.ancientbook.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
public class RepairArchive extends BaseEntity {

    @NotBlank(message = "档案编号不能为空")
    private String archiveCode;

    @NotNull(message = "善本ID不能为空")
    private Long bookId;

    @NotBlank(message = "善本编号不能为空")
    private String bookCode;

    @NotBlank(message = "善本名称不能为空")
    private String bookName;

    private LocalDateTime startTime;

    private LocalDateTime endTime;

    private Integer totalDuration;

    private String restorerIds;

    private String restorerNames;

    private String processIds;

    private String materialUsage;

    private String beforeImages;

    private String duringImages;

    private String afterImages;

    private java.math.BigDecimal qualityScore;

    private byte[] archiveContent;

    private String contentHash;

    private String encryptAlgorithm;

    private Integer exportCount;

    private LocalDateTime lastExportTime;

    private Long archivistId;

    private String archivistName;

    private LocalDateTime archiveTime;

    private Integer status;

    private String remark;
}

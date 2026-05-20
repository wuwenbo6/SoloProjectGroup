package com.rubbing.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("rubbing_record")
public class RubbingRecord {
    @TableId(type = IdType.AUTO)
    private Long id;

    private String rubbingId;

    private String name;

    private String dynasty;

    private Integer resolutionWidth;

    private Integer resolutionHeight;

    private Integer dpi;

    private String colorDepth;

    private String fileFormat;

    private BigDecimal fileSize;

    private Integer qualityScore;

    private String qualityLevel;

    private Integer brightness;

    private Integer contrast;

    private Integer threshold;

    private String scanMode;

    private String imagePath;

    private String location;

    private String archiveLevel;

    private LocalDateTime archiveTime;

    private String operator;

    private LocalDateTime captureTime;

    private String remark;

    private Integer paramBrightness;

    private Integer paramContrast;

    private Integer paramThreshold;

    private String paramResolution;

    private String paramColorDepth;

    private String paramScanMode;

    private Double paramSharpness;

    private Integer paramNoiseLevel;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedTime;

    @TableLogic
    private Integer deleted;
}

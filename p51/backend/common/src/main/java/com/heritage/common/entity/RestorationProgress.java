package com.heritage.common.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("restoration_progress")
public class RestorationProgress {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long planId;
    private Long equipmentId;
    private String stepName;
    private Integer stepOrder;
    private String status;
    private String description;
    private String operator;
    private LocalDateTime createTime;
    private LocalDateTime completeTime;
}

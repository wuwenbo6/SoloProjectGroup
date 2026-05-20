package com.heritage.common.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("restoration_plan")
public class RestorationPlan {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long equipmentId;
    private String planName;
    private String description;
    private String restorer;
    private BigDecimal estimatedCost;
    private Integer estimatedDays;
    private String status;
    private String restoredModelPath;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}

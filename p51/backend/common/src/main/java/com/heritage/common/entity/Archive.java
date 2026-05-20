package com.heritage.common.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("archive")
public class Archive {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long equipmentId;
    private String archiveType;
    private String title;
    private String content;
    private String fileUrl;
    private LocalDate recordDate;
    private String recorder;
    private LocalDateTime createTime;
}

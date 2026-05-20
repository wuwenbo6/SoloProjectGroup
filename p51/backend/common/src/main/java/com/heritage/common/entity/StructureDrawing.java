package com.heritage.common.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("structure_drawing")
public class StructureDrawing {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long equipmentId;
    private String drawingName;
    private String drawingType;
    private String fileUrl;
    private String version;
    private String description;
    private LocalDateTime createTime;
}

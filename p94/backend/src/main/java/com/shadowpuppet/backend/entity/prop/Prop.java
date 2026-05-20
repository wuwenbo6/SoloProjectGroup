package com.shadowpuppet.backend.entity.prop;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("props")
public class Prop {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String name;
    private String category;
    private String description;
    private String imageUrl;
    private String material;
    private String size;
    private String origin;
    private Long collectorId;
    private Integer status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

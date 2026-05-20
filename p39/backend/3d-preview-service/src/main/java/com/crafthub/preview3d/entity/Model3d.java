package com.crafthub.preview3d.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
@TableName("model_3d")
public class Model3d {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String name;

    private String description;

    private Long categoryId;

    private String modelUrl;

    private String thumbnailUrl;

    private String textureUrls;

    private String materialConfig;

    private String defaultCamera;

    private String defaultLights;

    private Integer isCustomizable;

    private String customizableParams;

    private Long artisanId;

    private Integer viewCount;

    private Integer usageCount;

    private Integer status;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @Version
    private Integer version;

    @TableLogic
    private Integer deleted;

    @TableField(exist = false)
    private String categoryName;

    @TableField(exist = false)
    private String artisanName;
}

package com.crafthub.preview3d.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("custom_3d_solution")
public class Custom3dSolution {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    private Long requirementId;

    private Long orderId;

    private Long baseModelId;

    private String name;

    private String description;

    private String materialSelections;

    private String colorConfig;

    private String sizeConfig;

    private String customParams;

    private String previewImage;

    private String modelUrl;

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
    private String modelName;

    @TableField(exist = false)
    private String modelThumbnail;
}

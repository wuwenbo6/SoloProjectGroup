package com.mortise.furniture.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("model_feature")
public class ModelFeature {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long furnitureId;

    private Double width;

    private Double height;

    private Double depth;

    private Double volume;

    private Integer componentCount;

    private Integer mortiseCount;

    private String category;

    private String material;

    private String style;

    private String featureVector;

    private String colorPalette;

    private Double complexityScore;

    private String hash;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;

    private Boolean deleted;
}

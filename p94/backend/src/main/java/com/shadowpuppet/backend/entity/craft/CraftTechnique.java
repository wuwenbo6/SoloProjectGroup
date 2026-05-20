package com.shadowpuppet.backend.entity.craft;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("craft_techniques")
public class CraftTechnique {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String title;
    private String category;
    private String content;
    private String materials;
    private String tools;
    private Integer difficultyLevel;
    private String duration;
    private Long authorId;
    private String videoUrl;
    private Integer status;
    private Integer viewCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

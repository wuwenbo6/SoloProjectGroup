package com.shadowpuppet.backend.entity.craft;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("craft_steps")
public class CraftStep {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long craftId;
    private Integer stepOrder;
    private String title;
    private String description;
    private String imageUrl;
    private String videoUrl;
    private Integer duration;
    private String tips;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

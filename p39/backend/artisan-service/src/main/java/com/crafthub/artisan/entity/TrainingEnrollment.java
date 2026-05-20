package com.crafthub.artisan.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("training_enrollment")
public class TrainingEnrollment {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long courseId;

    private Long userId;

    private String userName;

    private String userPhone;

    private Integer status;

    private LocalDateTime enrollTime;

    private LocalDateTime completeTime;

    private Integer rating;

    private String review;

    private String certificateUrl;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @Version
    private Integer version;

    @TableLogic
    private Integer deleted;
}

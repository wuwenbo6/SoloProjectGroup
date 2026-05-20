package com.crafthub.artisan.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("training_course")
public class TrainingCourse {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String title;

    private String description;

    private String coverImage;

    private String category;

    private Integer courseType;

    private Integer level;

    private Integer duration;

    private BigDecimal price;

    private Long instructorId;

    private String instructorName;

    private LocalDate startDate;

    private LocalDate endDate;

    private String location;

    private Integer maxStudents;

    private Integer currentStudents;

    private String content;

    private String syllabus;

    private String materials;

    private Integer status;

    private Integer viewCount;

    private Integer enrollCount;

    private BigDecimal rating;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @Version
    private Integer version;

    @TableLogic
    private Integer deleted;
}

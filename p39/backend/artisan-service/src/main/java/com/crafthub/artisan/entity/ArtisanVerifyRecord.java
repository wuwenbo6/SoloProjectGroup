package com.crafthub.artisan.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("t_artisan_verify_record")
public class ArtisanVerifyRecord {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long artisanId;

    private Integer status;

    private String reason;

    private Long verifyUserId;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
}

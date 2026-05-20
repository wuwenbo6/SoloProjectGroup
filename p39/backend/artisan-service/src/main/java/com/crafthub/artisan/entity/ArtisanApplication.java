package com.crafthub.artisan.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("artisan_application")
public class ArtisanApplication {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    private String realName;

    private String idCard;

    private String phone;

    private String email;

    private String province;

    private String city;

    private String address;

    private String craftType;

    private String craftTitle;

    private Integer experienceYears;

    private String bio;

    private String skillDesc;

    private String representativeWorks;

    private String idCardFront;

    private String idCardBack;

    private String certificateImages;

    private Integer status;

    private String rejectReason;

    private Long auditorId;

    private LocalDateTime auditTime;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @Version
    private Integer version;

    @TableLogic
    private Integer deleted;
}

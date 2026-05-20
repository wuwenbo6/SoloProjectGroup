package com.crafthub.requirement.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@TableName("proposal")
public class Proposal {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long requirementId;

    private Long artisanId;

    private String title;

    private String description;

    private BigDecimal price;

    private Integer deliveryDays;

    private String materialDesc;

    private String craftDesc;

    private Integer revision;

    private Integer status;

    private Integer isFinal;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @Version
    private Integer version;

    @TableLogic
    private Integer deleted;

    @TableField(exist = false)
    private String artisanName;

    @TableField(exist = false)
    private String artisanAvatar;

    @TableField(exist = false)
    private BigDecimal artisanRating;

    @TableField(exist = false)
    private List<ProposalAttachment> attachments;
}

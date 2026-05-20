package com.ancient.book.common.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
@TableName("permissions")
public class Permission {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String permissionName;

    private String permissionCode;

    private String resourceType;

    private String resourcePath;

    private String action;

    private String description;

    private Long parentId;

    private Integer level;

    private Integer sortOrder;

    private List<Long> childIds;

    private String status;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}

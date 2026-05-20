package com.ancient.book.common.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@TableName("roles")
public class Role {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String roleName;

    private String roleCode;

    private String description;

    private List<String> permissionCodes;

    private Map<String, Object> dataScope;

    private Integer sortOrder;

    private String status;

    private Boolean isSystem;

    private Long createdBy;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}

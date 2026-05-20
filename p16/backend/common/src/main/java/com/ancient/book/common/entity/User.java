package com.ancient.book.common.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@TableName("users")
public class User {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String username;

    private String passwordHash;

    private String email;

    private String phone;

    private String realName;

    private String avatar;

    private String department;

    private String title;

    private String status;

    private List<Long> roleIds;

    private Map<String, Object> permissions;

    private LocalDateTime lastLoginTime;

    private String lastLoginIp;

    private Integer loginCount;

    private Boolean isActive;

    private Boolean isLocked;

    private LocalDateTime lockExpireTime;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}

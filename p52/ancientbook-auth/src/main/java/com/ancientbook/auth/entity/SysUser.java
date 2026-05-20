package com.ancientbook.auth.entity;

import com.ancientbook.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import javax.validation.constraints.NotBlank;

@Data
@EqualsAndHashCode(callSuper = true)
public class SysUser extends BaseEntity {

    @NotBlank(message = "用户名不能为空")
    private String username;

    @NotBlank(message = "密码不能为空")
    private String password;

    @NotBlank(message = "真实姓名不能为空")
    private String realName;

    private String phone;

    private String email;

    private String avatar;

    private Integer skillLevel;

    private String specialty;

    private Integer status;

    private java.time.LocalDateTime lastLoginTime;
}

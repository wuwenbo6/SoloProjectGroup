package com.dye.traceability.auth.controller;

import com.dye.traceability.auth.dto.LoginDTO;
import com.dye.traceability.auth.dto.LoginVO;
import com.dye.traceability.auth.entity.SysUser;
import com.dye.traceability.auth.service.SysUserService;
import com.dye.traceability.common.core.Result;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@Api(tags = "权限认证接口")
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final SysUserService sysUserService;
    private final PasswordEncoder passwordEncoder;

    @ApiOperation("用户登录")
    @PostMapping("/login")
    public Result<LoginVO> login(@Validated @RequestBody LoginDTO dto) {
        return Result.success(sysUserService.login(dto));
    }

    @ApiOperation("用户注册")
    @PostMapping("/register")
    public Result<Void> register(@Validated @RequestBody LoginDTO dto) {
        SysUser user = new SysUser();
        user.setUsername(dto.getUsername());
        user.setPassword(passwordEncoder.encode(dto.getPassword()));
        user.setRealName(dto.getUsername());
        user.setRole("ROLE_USER");
        user.setStatus(1);
        sysUserService.save(user);
        return Result.success();
    }

    @ApiOperation("获取用户信息")
    @GetMapping("/info")
    public Result<SysUser> info(@RequestHeader("Authorization") String authorization) {
        return Result.success();
    }
}

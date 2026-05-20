package com.papermanagement.controller;

import com.papermanagement.dto.LoginDTO;
import com.papermanagement.dto.Result;
import com.papermanagement.entity.User;
import com.papermanagement.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/auth")
public class AuthController {

    @Autowired
    private AuthService authService;

    @PostMapping("/login")
    public Result<Map<String, Object>> login(@Valid @RequestBody LoginDTO loginDTO) {
        return authService.login(loginDTO);
    }

    @PostMapping("/register")
    public Result<User> register(@RequestBody User user) {
        return authService.register(user);
    }
}

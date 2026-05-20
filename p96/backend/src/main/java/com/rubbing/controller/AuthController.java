package com.rubbing.controller;

import com.rubbing.dto.ApiResponse;
import com.rubbing.dto.LoginRequest;
import com.rubbing.entity.user.User;
import com.rubbing.security.JwtUtil;
import com.rubbing.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AuthController {

    private final AuthService authService;
    private final JwtUtil jwtUtil;

    @PostMapping("/login")
    public ApiResponse<Map<String, Object>> login(@RequestBody LoginRequest request) {
        try {
            Map<String, Object> result = authService.login(request);
            return ApiResponse.success("登录成功", result);
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @PostMapping("/register")
    public ApiResponse<User> register(@RequestBody User user) {
        try {
            User saved = authService.register(user);
            saved.setPassword(null);
            return ApiResponse.success("注册成功", saved);
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @GetMapping("/userinfo")
    public ApiResponse<User> getUserInfo(HttpServletRequest request) {
        try {
            String token = request.getHeader("Authorization");
            if (token != null && token.startsWith("Bearer ")) {
                token = token.substring(7);
                Long userId = jwtUtil.getUserIdFromToken(token);
                User user = authService.getUserById(userId);
                if (user != null) {
                    user.setPassword(null);
                    return ApiResponse.success(user);
                }
            }
            return ApiResponse.error("未登录");
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }
}

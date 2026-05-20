package com.rubbing.controller;

import com.rubbing.dto.ApiResponse;
import com.rubbing.entity.rubbing.Rubbing;
import com.rubbing.security.JwtUtil;
import com.rubbing.service.RubbingService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/rubbing")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class RubbingController {

    private final RubbingService rubbingService;
    private final JwtUtil jwtUtil;

    @PostMapping("/upload")
    public ApiResponse<Rubbing> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam("name") String name,
            @RequestParam(value = "description", required = false) String description,
            HttpServletRequest request) {
        try {
            Long userId = getUserIdFromRequest(request);
            if (userId == null) {
                return ApiResponse.error("未登录");
            }
            Rubbing rubbing = rubbingService.uploadRubbing(file, name, description, userId);
            return ApiResponse.success("上传成功", rubbing);
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @GetMapping("/list")
    public ApiResponse<Map<String, Object>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            HttpServletRequest request) {
        try {
            Long userId = getUserIdFromRequest(request);
            if (userId == null) {
                return ApiResponse.error("未登录");
            }
            Map<String, Object> result = rubbingService.listRubbingsWithPaging(page, size, userId);
            return ApiResponse.success(result);
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @GetMapping("/{id}")
    public ApiResponse<Rubbing> getById(@PathVariable Long id) {
        try {
            Rubbing rubbing = rubbingService.getRubbingById(id);
            return ApiResponse.success(rubbing);
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        try {
            rubbingService.deleteRubbing(id);
            return ApiResponse.success("删除成功", null);
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    private Long getUserIdFromRequest(HttpServletRequest request) {
        String token = request.getHeader("Authorization");
        if (token != null && token.startsWith("Bearer ")) {
            token = token.substring(7);
            return jwtUtil.getUserIdFromToken(token);
        }
        return null;
    }
}

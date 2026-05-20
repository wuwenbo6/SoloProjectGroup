package com.rubbing.controller;

import com.rubbing.dto.ApiResponse;
import com.rubbing.entity.interpretation.Annotation;
import com.rubbing.entity.interpretation.Interpretation;
import com.rubbing.security.JwtUtil;
import com.rubbing.service.InterpretationService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/interpretation")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class InterpretationController {

    private final InterpretationService interpretationService;
    private final JwtUtil jwtUtil;

    @PostMapping("/recognize/{rubbingId}")
    public ApiResponse<Map<String, Object>> recognize(@PathVariable Long rubbingId) {
        try {
            Map<String, Object> result = interpretationService.recognizeText(rubbingId);
            return ApiResponse.success(result);
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @PostMapping("/annotation")
    public ApiResponse<Map<String, Object>> saveAnnotations(
            @RequestBody Map<String, Object> body,
            HttpServletRequest request) {
        try {
            Long userId = getUserIdFromRequest(request);
            if (userId == null) {
                return ApiResponse.error("未登录");
            }
            Long rubbingId = Long.valueOf(body.get("rubbingId").toString());
            List<Map<String, Object>> annotationMaps = (List<Map<String, Object>>) body.get("annotations");
            
            List<Annotation> annotations = annotationMaps.stream().map(map -> {
                Annotation ann = new Annotation();
                if (map.get("id") != null) {
                    ann.setId(Long.valueOf(map.get("id").toString()));
                }
                if (map.get("version") != null) {
                    ann.setVersion(Long.valueOf(map.get("version").toString()));
                }
                ann.setX(Double.valueOf(map.get("x").toString()));
                ann.setY(Double.valueOf(map.get("y").toString()));
                ann.setWidth(Double.valueOf(map.get("width").toString()));
                ann.setHeight(Double.valueOf(map.get("height").toString()));
                ann.setText(map.get("text") != null ? map.get("text").toString() : "");
                if (map.get("confidence") != null) {
                    ann.setConfidence(Double.valueOf(map.get("confidence").toString()));
                }
                return ann;
            }).toList();
            
            Map<String, Object> result = interpretationService.saveAnnotations(rubbingId, userId, annotations);
            
            if ((boolean) result.get("success")) {
                return ApiResponse.success("保存成功", result);
            } else {
                return ApiResponse.error("存在冲突: " + String.join(", ", (List<String>) result.get("conflicts")));
            }
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @GetMapping("/annotations/{rubbingId}")
    public ApiResponse<List<Annotation>> getAnnotations(@PathVariable Long rubbingId) {
        try {
            List<Annotation> annotations = interpretationService.getAnnotations(rubbingId);
            return ApiResponse.success(annotations);
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @GetMapping("/rubbing/{rubbingId}")
    public ApiResponse<Interpretation> getByRubbingId(
            @PathVariable Long rubbingId,
            HttpServletRequest request) {
        try {
            Long userId = getUserIdFromRequest(request);
            if (userId == null) {
                return ApiResponse.error("未登录");
            }
            Interpretation interpretation = interpretationService.getInterpretationByRubbingId(rubbingId, userId);
            return ApiResponse.success(interpretation);
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

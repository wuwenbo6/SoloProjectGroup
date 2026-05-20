package com.rubbing.controller;

import com.rubbing.dto.ApiResponse;
import com.rubbing.entity.interpretation.Interpretation;
import com.rubbing.service.InterpretationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/comparison")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ComparisonController {

    private final InterpretationService interpretationService;

    @PostMapping("/compare")
    public ApiResponse<Map<String, Object>> compare(
            @RequestBody Map<String, Object> body,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            List<Long> interpretationIds = (List<Long>) body.get("interpretationIds");
            Map<String, Object> result = interpretationService.compareInterpretations(interpretationIds, page, size);
            return ApiResponse.success("对比完成", result);
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @GetMapping("/history")
    public ApiResponse<Map<String, Object>> getHistory(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        try {
            Map<String, Object> result = interpretationService.getInterpretationsWithPaging(page, size);
            return ApiResponse.success(result);
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }
}

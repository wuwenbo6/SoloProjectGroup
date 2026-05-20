package com.ancientbook.process.controller;

import com.ancientbook.common.result.Result;
import com.ancientbook.process.service.ProcessRecommendService;
import com.ancientbook.process.service.RepairProcessService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/process")
@RequiredArgsConstructor
public class ProcessController {

    private final ProcessRecommendService recommendService;
    private final RepairProcessService processService;

    @GetMapping("/recommend")
    public Result<List<Map<String, Object>>> recommend(
            @RequestParam Integer conditionLevel,
            @RequestParam String material,
            @RequestParam(required = false) Integer skillLevel) {

        if (skillLevel != null) {
            return Result.success(recommendService.recommendByBookInfo(
                    conditionLevel, material, skillLevel));
        }
        return Result.success(recommendService.recommendProcesses(conditionLevel, material));
    }

    @GetMapping("/list")
    public Result<List<?>> list() {
        return Result.success(processService.getAllEnabled());
    }
}

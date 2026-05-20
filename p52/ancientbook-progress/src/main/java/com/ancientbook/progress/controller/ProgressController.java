package com.ancientbook.progress.controller;

import com.ancientbook.common.result.Result;
import com.ancientbook.progress.entity.RepairProgress;
import com.ancientbook.progress.service.RepairProgressService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/progress")
@RequiredArgsConstructor
public class ProgressController {

    private final RepairProgressService progressService;

    @PostMapping
    public Result<RepairProgress> createProgress(@RequestBody RepairProgress progress) {
        return Result.success(progressService.createProgress(progress));
    }

    @PutMapping("/{progressCode}")
    public Result<RepairProgress> updateProgress(
            @PathVariable String progressCode,
            @RequestBody RepairProgress progress) {
        return Result.success(progressService.updateProgress(progressCode, progress));
    }

    @GetMapping("/book/{bookId}")
    public Result<List<RepairProgress>> getProgressByBookId(@PathVariable Long bookId) {
        return Result.success(progressService.getProgressByBookId(bookId));
    }

    @GetMapping("/{progressCode}")
    public Result<RepairProgress> getProgressByCode(@PathVariable String progressCode) {
        return Result.success(progressService.getByProgressCode(progressCode));
    }

    @GetMapping("/steps")
    public Result<List<Map<String, Object>>> getProgressSteps() {
        return Result.success(progressService.getProgressSteps());
    }
}

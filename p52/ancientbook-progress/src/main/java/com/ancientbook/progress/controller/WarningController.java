package com.ancientbook.progress.controller;

import com.ancientbook.common.result.Result;
import com.ancientbook.progress.entity.ProgressWarning;
import com.ancientbook.progress.service.ProgressWarningService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/warning")
@RequiredArgsConstructor
public class WarningController {

    private final ProgressWarningService warningService;

    @PostMapping("/check/{bookId}")
    public Result<Map<String, Object>> autoCheck(
            @PathVariable Long bookId,
            @RequestParam String bookCode) {
        return Result.success(warningService.autoCheckAndWarn(bookId, bookCode));
    }

    @PostMapping("/handle/{warningCode}")
    public Result<ProgressWarning> handleWarning(
            @PathVariable String warningCode,
            @RequestParam String handlerId,
            @RequestParam String handlerName,
            @RequestParam String handleResult) {
        return Result.success(warningService.handleWarning(
                warningCode, handlerId, handlerName, handleResult));
    }

    @GetMapping("/book/{bookCode}")
    public Result<List<ProgressWarning>> getWarningsByBook(@PathVariable String bookCode) {
        return Result.success(warningService.getWarningsByBook(bookCode));
    }

    @GetMapping("/pending")
    public Result<List<ProgressWarning>> getPendingWarnings() {
        return Result.success(warningService.getPendingWarnings());
    }

    @GetMapping("/statistics")
    public Result<Map<String, Object>> getWarningStatistics() {
        return Result.success(warningService.getWarningStatistics());
    }

    @GetMapping("/{warningCode}")
    public Result<ProgressWarning> getWarningDetail(@PathVariable String warningCode) {
        return Result.success(warningService.getWarningByCode(warningCode));
    }
}

package com.ancientbook.detection.controller;

import com.ancientbook.common.result.Result;
import com.ancientbook.detection.service.ThirdPartyDetectionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/detection")
@RequiredArgsConstructor
public class DetectionController {

    private final ThirdPartyDetectionService detectionService;

    @PostMapping("/sync")
    public Result<Map<String, Object>> syncReport(
            @RequestParam String thirdPartyCode,
            @RequestParam Long bookId,
            @RequestParam String bookCode) {
        return Result.success(detectionService.syncDetectionReport(
                thirdPartyCode, bookId, bookCode));
    }

    @GetMapping("/orgs")
    public Result<Map<String, Object>> getOrgList() {
        return Result.success(detectionService.getDetectionOrgList());
    }

    @GetMapping("/status/{reportCode}")
    public Result<Map<String, Object>> getSyncStatus(@PathVariable String reportCode) {
        return Result.success(detectionService.getSyncStatus(reportCode));
    }
}

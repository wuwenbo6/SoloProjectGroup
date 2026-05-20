package com.ancientbook.detection.controller;

import com.ancientbook.detection.dto.DetectionTrendDTO;
import com.ancientbook.detection.dto.OrgComparisonDTO;
import com.ancientbook.detection.service.DetectionComparisonService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/detection/comparison")
@RequiredArgsConstructor
public class DetectionComparisonController {

    private final DetectionComparisonService comparisonService;

    @GetMapping("/orgs")
    public List<OrgComparisonDTO> getOrgComparison() {
        return comparisonService.getOrgComparison();
    }

    @GetMapping("/trend")
    public List<DetectionTrendDTO> getDetectionTrend(
            @RequestParam(defaultValue = "12") int months) {
        return comparisonService.getDetectionTrend(months);
    }

    @GetMapping("/org/{orgCode}")
    public Map<String, Object> getOrgDetail(@PathVariable String orgCode) {
        return comparisonService.getOrgDetail(orgCode);
    }

    @GetMapping("/summary")
    public Map<String, Object> getComparisonSummary() {
        return comparisonService.getComparisonSummary();
    }
}

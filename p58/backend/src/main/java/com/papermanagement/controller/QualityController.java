package com.papermanagement.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.papermanagement.dto.Result;
import com.papermanagement.entity.QualityReport;
import com.papermanagement.service.QualityService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/quality")
public class QualityController {

    @Autowired
    private QualityService qualityService;

    @PostMapping("/report")
    public Result<QualityReport> createReport(@RequestBody QualityReport report) {
        return qualityService.createReport(report);
    }

    @GetMapping("/list")
    public Result<IPage<QualityReport>> getReportList(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String batchNo,
            @RequestParam(required = false) String qualityLevel) {
        return qualityService.getReportList(page, size, batchNo, qualityLevel);
    }

    @GetMapping("/report/{id}")
    public Result<QualityReport> getReportById(@PathVariable Long id) {
        return qualityService.getReportById(id);
    }
}

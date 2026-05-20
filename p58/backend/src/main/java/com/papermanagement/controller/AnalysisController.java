package com.papermanagement.controller;

import com.papermanagement.dto.Result;
import com.papermanagement.entity.ProcessNode;
import com.papermanagement.service.ProcessAnalysisService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/analysis")
public class AnalysisController {

    @Autowired
    private ProcessAnalysisService processAnalysisService;

    @GetMapping("/process-nodes/cached")
    public Result<List<ProcessNode>> getCachedProcessNodes() {
        return processAnalysisService.getCachedProcessNodes();
    }

    @GetMapping("/batch-progress/{batchNo}")
    public Result<Map<String, Object>> getBatchProgress(@PathVariable String batchNo) {
        return processAnalysisService.getBatchProgress(batchNo);
    }

    @PostMapping("/compare-batches")
    public Result<Map<String, Object>> compareBatches(@RequestBody Map<String, Object> params) {
        List<String> batchNos = (List<String>) params.get("batchNos");
        return processAnalysisService.compareBatches(batchNos);
    }
}

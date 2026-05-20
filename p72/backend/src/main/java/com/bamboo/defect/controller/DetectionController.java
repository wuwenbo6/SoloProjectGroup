package com.bamboo.defect.controller;

import com.bamboo.defect.common.Result;
import com.bamboo.defect.entity.DetectionRecord;
import com.bamboo.defect.service.DetectionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/detection")
@CrossOrigin
public class DetectionController {
    
    @Autowired
    private DetectionService detectionService;
    
    @PostMapping("/start")
    public Result<Void> startDetection() {
        detectionService.startDetection();
        return Result.success("检测已启动");
    }
    
    @PostMapping("/stop")
    public Result<Void> stopDetection() {
        detectionService.stopDetection();
        return Result.success("检测已停止");
    }
    
    @GetMapping("/status")
    public Result<Boolean> getStatus() {
        return Result.success(detectionService.isDetectionRunning());
    }
    
    @GetMapping("/latest")
    public Result<DetectionRecord> getLatestResult() {
        return Result.success(detectionService.getLatestRecord());
    }
    
    @GetMapping("/statistics")
    public Result<Map<String, Object>> getStatistics() {
        return Result.success(detectionService.getStatistics());
    }
    
    @GetMapping("/history")
    public Result<Page<DetectionRecord>> getHistory(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size) {
        return Result.success(detectionService.getHistory(page, size));
    }
    
    @GetMapping("/recent")
    public Result<List<DetectionRecord>> getRecentRecords() {
        return Result.success(detectionService.getRecentRecords(10));
    }
    
    @GetMapping("/defects")
    public Result<?> getRecentDefects() {
        return Result.success(detectionService.getRecentDefects(10));
    }
    
    @PostMapping("/defects/{id}/handle")
    public Result<Void> markHandled(@PathVariable Long id) {
        boolean success = detectionService.markHandled(id);
        if (success) {
            return Result.success("标记成功");
        }
        return Result.error("标记失败，缺陷不存在");
    }
}

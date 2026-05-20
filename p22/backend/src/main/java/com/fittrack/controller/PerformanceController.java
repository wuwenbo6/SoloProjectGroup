package com.fittrack.controller;

import com.fittrack.service.MotionAnalysisService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/performance")
@CrossOrigin(origins = "*")
public class PerformanceController {

    private final MotionAnalysisService motionAnalysisService;

    public PerformanceController(MotionAnalysisService motionAnalysisService) {
        this.motionAnalysisService = motionAnalysisService;
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getPerformanceStats() {
        return ResponseEntity.ok(motionAnalysisService.getPerformanceStats());
    }

    @PostMapping("/reset")
    public ResponseEntity<Map<String, Object>> resetStats() {
        motionAnalysisService.resetPerformanceStats();
        Map<String, Object> response = new HashMap<>();
        response.put("message", "Performance statistics reset successfully");
        response.put("success", true);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/optimization-info")
    public ResponseEntity<Map<String, Object>> getOptimizationInfo() {
        Map<String, Object> info = new HashMap<>();

        Map<String, String> optimizations = new HashMap<>();
        optimizations.put("motionPhaseDetection", "识别动作阶段（静止/起势/下蹲/起身/完成），仅在关键阶段执行DTW");
        optimizations.put("slidingWindowFilter", "滑动窗口过滤，跳过70%非关键帧，关键帧跳帧间隔3");
        optimizations.put("sakoeChibaBand", "DTW窗口约束，宽度5，减少约60%计算量");
        optimizations.put("earlyTermination", "距离超过阈值时提前终止计算，阈值1000");
        optimizations.put("fastDistanceEstimate", "快速距离估计，5点采样，过滤明显偏差帧");
        optimizations.put("rowOptimization", "仅使用2行DP数组，O(n)空间复杂度");
        info.put("optimizations", optimizations);

        Map<String, Object> expectedImprovements = new HashMap<>();
        expectedImprovements.put("frameReductionRate", "约70%-80%帧被跳过");
        expectedImprovements.put("cpuUsageReduction", "从100%降至约20%-30%");
        expectedImprovements.put("maxConcurrentSessions", "从5提升至20+");
        expectedImprovements.put("avgLatencyPerFrame", "<1ms（优化前约5ms）");
        info.put("expectedImprovements", expectedImprovements);

        Map<String, String> phases = new HashMap<>();
        phases.put("IDLE", "静止 - 跳过DTW");
        phases.put("STARTING", "起势 - 跳过DTW");
        phases.put("DESCENDING", "下蹲 - 执行DTW");
        phases.put("ASCENDING", "起身 - 执行DTW");
        phases.put("COMPLETED", "完成 - 跳过DTW");
        phases.put("UNKNOWN", "未知 - 跳过DTW");
        info.put("motionPhases", phases);

        return ResponseEntity.ok(info);
    }
}

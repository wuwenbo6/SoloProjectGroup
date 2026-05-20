package com.heritage.scoring.controller;

import com.heritage.scoring.common.Result;
import com.heritage.scoring.entity.*;
import com.heritage.scoring.service.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/scoring")
@CrossOrigin(origins = "*")
public class ScoringController {
    
    @Autowired
    private ScoringService scoringService;
    
    @Autowired
    private ReviewService reviewService;
    
    @PostMapping("/evaluate")
    public Result<RestorationScore> evaluate(@RequestBody RestorationScore score) {
        try {
            RestorationScore result = scoringService.calculateScore(score);
            return Result.success(result);
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error("评分失败: " + e.getMessage());
        }
    }
    
    @GetMapping("/equipment/{equipmentId}")
    public Result<List<RestorationScore>> getScoresByEquipment(@PathVariable Long equipmentId) {
        try {
            return Result.success(scoringService.getScoresByEquipment(equipmentId));
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error("查询失败: " + e.getMessage());
        }
    }
    
    @GetMapping("/statistics/{equipmentId}")
    public Result<Map<String, Object>> getStatistics(@PathVariable Long equipmentId) {
        try {
            return Result.success(scoringService.getScoreStatistics(equipmentId));
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error("查询失败: " + e.getMessage());
        }
    }
    
    @PostMapping("/review/submit")
    public Result<ExpertReview> submitReview(@RequestBody ExpertReview review) {
        try {
            ExpertReview result = reviewService.submitReview(review);
            return Result.success(result);
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error("提交审核失败: " + e.getMessage());
        }
    }
    
    @GetMapping("/review/plan/{planId}")
    public Result<List<ExpertReview>> getReviewsByPlan(@PathVariable Long planId) {
        try {
            return Result.success(reviewService.getReviewsByPlan(planId));
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error("查询失败: " + e.getMessage());
        }
    }
    
    @GetMapping("/review/expert/{expertId}")
    public Result<List<ExpertReview>> getReviewsByExpert(@PathVariable String expertId) {
        try {
            return Result.success(reviewService.getReviewsByExpert(expertId));
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error("查询失败: " + e.getMessage());
        }
    }
    
    @PostMapping("/workflow/start")
    public Result<ReviewWorkflow> startWorkflow(@RequestBody Map<String, Object> request) {
        try {
            Long planId = Long.valueOf(request.get("planId").toString());
            String creatorId = request.get("creatorId").toString();
            return Result.success(reviewService.startWorkflow(planId, creatorId));
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error("启动流程失败: " + e.getMessage());
        }
    }
    
    @GetMapping("/workflow/{planId}")
    public Result<ReviewWorkflow> getWorkflow(@PathVariable Long planId) {
        try {
            return Result.success(reviewService.getWorkflowByPlan(planId));
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error("查询失败: " + e.getMessage());
        }
    }
    
    @GetMapping("/review/statistics")
    public Result<Map<String, Object>> getReviewStatistics() {
        try {
            return Result.success(reviewService.getReviewStatistics());
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error("查询失败: " + e.getMessage());
        }
    }
    
    @GetMapping("/weights")
    public Result<Map<String, Double>> getWeights() {
        Map<String, Double> weights = new HashMap<>();
        weights.put("technicalAccuracy", 0.20);
        weights.put("historicalAuthenticity", 0.25);
        weights.put("materialCompatibility", 0.15);
        weights.put("processReliability", 0.15);
        weights.put("aestheticEffect", 0.10);
        weights.put("durability", 0.10);
        weights.put("costEffectiveness", 0.05);
        return Result.success(weights);
    }
}
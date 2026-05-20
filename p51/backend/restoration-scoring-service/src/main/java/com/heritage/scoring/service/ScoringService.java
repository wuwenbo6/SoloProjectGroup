package com.heritage.scoring.service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.heritage.scoring.entity.*;
import com.heritage.scoring.mapper.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class ScoringService extends ServiceImpl<RestorationScoreMapper, RestorationScore> {
    
    @Autowired
    private RestorationPlanMapper planMapper;
    
    @Autowired
    private ExpertReviewMapper reviewMapper;
    
    @Autowired
    private ReviewWorkflowMapper workflowMapper;
    
    private static final Map<String, Double> WEIGHTS = new HashMap<>();
    
    static {
        WEIGHTS.put("technicalAccuracy", 0.20);
        WEIGHTS.put("historicalAuthenticity", 0.25);
        WEIGHTS.put("materialCompatibility", 0.15);
        WEIGHTS.put("processReliability", 0.15);
        WEIGHTS.put("aestheticEffect", 0.10);
        WEIGHTS.put("durability", 0.10);
        WEIGHTS.put("costEffectiveness", 0.05);
    }
    
    public RestorationScore calculateScore(RestorationScore score) {
        double total = 0.0;
        total += (score.getTechnicalAccuracy() != null ? score.getTechnicalAccuracy() : 0) * WEIGHTS.get("technicalAccuracy");
        total += (score.getHistoricalAuthenticity() != null ? score.getHistoricalAuthenticity() : 0) * WEIGHTS.get("historicalAuthenticity");
        total += (score.getMaterialCompatibility() != null ? score.getMaterialCompatibility() : 0) * WEIGHTS.get("materialCompatibility");
        total += (score.getProcessReliability() != null ? score.getProcessReliability() : 0) * WEIGHTS.get("processReliability");
        total += (score.getAestheticEffect() != null ? score.getAestheticEffect() : 0) * WEIGHTS.get("aestheticEffect");
        total += (score.getDurability() != null ? score.getDurability() : 0) * WEIGHTS.get("durability");
        total += (score.getCostEffectiveness() != null ? score.getCostEffectiveness() : 0) * WEIGHTS.get("costEffectiveness");
        
        score.setTotalScore(Math.round(total * 100.0) / 100.0);
        score.setGrade(determineGrade(total));
        score.setCreateTime(LocalDateTime.now());
        score.setUpdateTime(LocalDateTime.now());
        
        save(score);
        return score;
    }
    
    private String determineGrade(double score) {
        if (score >= 90) return "S";
        if (score >= 80) return "A";
        if (score >= 70) return "B";
        if (score >= 60) return "C";
        return "D";
    }
    
    public List<RestorationScore> getScoresByEquipment(Long equipmentId) {
        return lambdaQuery()
                .eq(RestorationScore::getEquipmentId, equipmentId)
                .orderByDesc(RestorationScore::getCreateTime)
                .list();
    }
    
    public Map<String, Object> getScoreStatistics(Long equipmentId) {
        List<RestorationScore> scores = getScoresByEquipment(equipmentId);
        
        double avgScore = scores.stream()
                .mapToDouble(RestorationScore::getTotalScore)
                .average()
                .orElse(0.0);
        
        double maxScore = scores.stream()
                .mapToDouble(RestorationScore::getTotalScore)
                .max()
                .orElse(0.0);
        
        Map<String, Long> gradeDistribution = new HashMap<>();
        for (RestorationScore score : scores) {
            gradeDistribution.merge(score.getGrade(), 1L, Long::sum);
        }
        
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalEvaluations", scores.size());
        stats.put("averageScore", Math.round(avgScore * 100.0) / 100.0);
        stats.put("maxScore", maxScore);
        stats.put("gradeDistribution", gradeDistribution);
        stats.put("weights", WEIGHTS);
        
        return stats;
    }
}
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
public class ReviewService extends ServiceImpl<ExpertReviewMapper, ExpertReview> {
    
    @Autowired
    private RestorationPlanMapper planMapper;
    
    @Autowired
    private ReviewWorkflowMapper workflowMapper;
    
    @Transactional
    public ExpertReview submitReview(ExpertReview review) {
        int total = review.getTechnicalAccuracy() +
                     review.getHistoricalAuthenticity() +
                     review.getMaterialCompatibility() +
                     review.getProcessReliability() +
                     review.getSafetyStandard() +
                     review.getDocumentation();
        
        review.setOverallScore(total / 6);
        review.setReviewResult(determineReviewResult(total / 6));
        review.setReviewTime(LocalDateTime.now());
        review.setCreateTime(LocalDateTime.now());
        save(review);
        
        updatePlanReviewStatus(review.getPlanId(), review.getReviewResult(), review);
        updateWorkflow(review.getPlanId(), review);
        
        return review;
    }
    
    private String determineReviewResult(int score) {
        if (score >= 90) return "PASS";
        if (score >= 75) return "CONDITIONAL_PASS";
        if (score >= 60) return "NEEDS_REVISION";
        return "REJECT";
    }
    
    private void updatePlanReviewStatus(Long planId, String result, ExpertReview review) {
        RestorationPlan plan = planMapper.selectById(planId);
        if (plan != null) {
            plan.setReviewStatus(result);
            plan.setReviewerId(review.getExpertId());
            plan.setReviewerName(review.getExpertName());
            plan.setReviewComment(review.getReviewComment());
            plan.setReviewTime(LocalDateTime.now());
            planMapper.updateById(plan);
        }
    }
    
    private void updateWorkflow(Long planId, ExpertReview review) {
        ReviewWorkflow workflow = workflowMapper.selectOne(
            lambdaQuery().getWrapper()
                .eq(ReviewWorkflow::getPlanId, planId)
                .eq(ReviewWorkflow::getStatus, "IN_PROGRESS")
        );
        
        if (workflow != null) {
            String completed = workflow.getCompletedApprovers();
            if (completed == null || completed.isEmpty()) {
                completed = review.getExpertId();
            } else {
                completed += "," + review.getExpertId();
            }
            workflow.setCompletedApprovers(completed);
            workflow.setLastReviewTime(LocalDateTime.now());
            
            if ("PASS".equals(review.getReviewResult())) {
                if (workflow.getCurrentLevel() >= 3) {
                    workflow.setStatus("COMPLETED");
                    workflow.setCompleteTime(LocalDateTime.now());
                } else {
                    workflow.setCurrentLevel(workflow.getCurrentLevel() + 1);
                }
            } else if ("REJECT".equals(review.getReviewResult())) {
                workflow.setStatus("REJECTED");
                workflow.setCompleteTime(LocalDateTime.now());
            }
            
            workflowMapper.updateById(workflow);
        }
    }
    
    @Transactional
    public ReviewWorkflow startWorkflow(Long planId, String creatorId) {
        ReviewWorkflow workflow = new ReviewWorkflow();
        workflow.setPlanId(planId);
        workflow.setCurrentStage("SUBMITTED");
        workflow.setCurrentLevel(1);
        workflow.setApproverIds("expert1,expert2,expert3");
        workflow.setStatus("IN_PROGRESS");
        workflow.setSubmitTime(LocalDateTime.now());
        workflowMapper.insert(workflow);
        
        RestorationPlan plan = planMapper.selectById(planId);
        if (plan != null) {
            plan.setStatus("UNDER_REVIEW");
            plan.setReviewStatus("PENDING");
            planMapper.updateById(plan);
        }
        
        return workflow;
    }
    
    public List<ExpertReview> getReviewsByPlan(Long planId) {
        return lambdaQuery()
                .eq(ExpertReview::getPlanId, planId)
                .orderByDesc(ExpertReview::getReviewTime)
                .list();
    }
    
    public List<ExpertReview> getReviewsByExpert(String expertId) {
        return lambdaQuery()
                .eq(ExpertReview::getExpertId, expertId)
                .orderByDesc(ExpertReview::getReviewTime)
                .list();
    }
    
    public ReviewWorkflow getWorkflowByPlan(Long planId) {
        return workflowMapper.selectOne(
            lambdaQuery().getWrapper()
                .eq(ReviewWorkflow::getPlanId, planId)
                .orderByDesc(ReviewWorkflow::getSubmitTime)
                .last("LIMIT 1")
        );
    }
    
    public Map<String, Object> getReviewStatistics() {
        List<ExpertReview> allReviews = list();
        
        Map<String, Long> resultDistribution = new HashMap<>();
        for (ExpertReview review : allReviews) {
            resultDistribution.merge(review.getReviewResult(), 1L, Long::sum);
        }
        
        double avgScore = allReviews.stream()
                .mapToInt(ExpertReview::getOverallScore)
                .average()
                .orElse(0.0);
        
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalReviews", allReviews.size());
        stats.put("averageScore", Math.round(avgScore * 100.0) / 100.0);
        stats.put("resultDistribution", resultDistribution);
        
        return stats;
    }
}
package com.folk.activity.order.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.folk.activity.common.core.entity.Activity;
import com.folk.activity.common.core.result.Result;
import com.folk.activity.order.mapper.ActivityMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/activity")
@RequiredArgsConstructor
public class ActivityCompareController {
    private final ActivityMapper activityMapper;

    @GetMapping("/compare")
    public Result<Map<String, Object>> compareActivities(@RequestParam List<Long> activityIds) {
        List<Activity> activities = activityMapper.selectList(
            new LambdaQueryWrapper<Activity>()
                .in(Activity::getId, activityIds)
                .eq(Activity::getStatus, 1)
        );

        Map<String, Object> comparisonResult = Map.of(
            "activities", activities,
            "compareFields", List.of(
                Map.of("field", "price", "label", "价格", "type", "currency"),
                Map.of("field", "location", "label", "地点", "type", "text"),
                Map.of("field", "startTime", "label", "开始时间", "type", "date"),
                Map.of("field", "endTime", "label", "结束时间", "type", "date"),
                Map.of("field", "maxParticipants", "label", "最大人数", "type", "number"),
                Map.of("field", "currentParticipants", "label", "已报名人数", "type", "number"),
                Map.of("field", "requirements", "label", "报名要求", "type", "list"),
                Map.of("field", "processSteps", "label", "报名流程", "type", "list"),
                Map.of("field", "highlights", "label", "活动亮点", "type", "list"),
                Map.of("field", "rating", "label", "评分", "type", "rating"),
                Map.of("field", "ratingCount", "label", "评价数", "type", "number")
            ),
            "recommendation", generateRecommendation(activities)
        );

        return Result.success(comparisonResult);
    }

    @GetMapping("/list")
    public Result<List<Activity>> getActivityList(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size) {
        
        LambdaQueryWrapper<Activity> queryWrapper = new LambdaQueryWrapper<>();
        queryWrapper.eq(Activity::getStatus, 1);
        
        if (category != null && !category.isEmpty()) {
            queryWrapper.eq(Activity::getCategory, category);
        }
        
        if (keyword != null && !keyword.isEmpty()) {
            queryWrapper.like(Activity::getName, keyword);
        }
        
        queryWrapper.orderByDesc(Activity::getCreateTime);
        
        List<Activity> activities = activityMapper.selectList(queryWrapper);
        return Result.success(activities);
    }

    @GetMapping("/{id}")
    public Result<Activity> getActivityDetail(@PathVariable Long id) {
        return Result.success(activityMapper.selectById(id));
    }

    private String generateRecommendation(List<Activity> activities) {
        if (activities.isEmpty()) return "";
        
        Activity bestRating = activities.stream()
            .max((a, b) -> Double.compare(a.getRating() != null ? a.getRating() : 0, 
                                         b.getRating() != null ? b.getRating() : 0))
            .orElse(null);
        
        Activity mostPopular = activities.stream()
            .max((a, b) -> Integer.compare(a.getCurrentParticipants() != null ? a.getCurrentParticipants() : 0,
                                           b.getCurrentParticipants() != null ? b.getCurrentParticipants() : 0))
            .orElse(null);
        
        StringBuilder recommendation = new StringBuilder();
        if (bestRating != null && bestRating.getRating() != null) {
            recommendation.append("评分最高推荐：").append(bestRating.getName()).append(" (").append(bestRating.getRating()).append("分)；");
        }
        if (mostPopular != null) {
            recommendation.append("人气最高推荐：").append(mostPopular.getName()).append(" (已报名").append(mostPopular.getCurrentParticipants()).append("人)");
        }
        
        return recommendation.toString();
    }
}

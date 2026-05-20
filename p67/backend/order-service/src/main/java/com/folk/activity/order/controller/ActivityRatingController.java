package com.folk.activity.order.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.folk.activity.common.core.entity.Activity;
import com.folk.activity.common.core.entity.ActivityRating;
import com.folk.activity.common.core.result.Result;
import com.folk.activity.order.mapper.ActivityMapper;
import com.folk.activity.order.mapper.ActivityRatingMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/rating")
@RequiredArgsConstructor
public class ActivityRatingController {
    private final ActivityRatingMapper ratingMapper;
    private final ActivityMapper activityMapper;

    @PostMapping("/submit")
    @Transactional(rollbackFor = Exception.class)
    public Result<ActivityRating> submitRating(@RequestBody ActivityRating rating) {
        LambdaQueryWrapper<ActivityRating> queryWrapper = new LambdaQueryWrapper<>();
        queryWrapper.eq(ActivityRating::getActivityId, rating.getActivityId())
                    .eq(ActivityRating::getUserId, rating.getUserId());
        
        if (ratingMapper.selectCount(queryWrapper) > 0) {
            return Result.fail("您已经评价过该活动");
        }

        rating.setStatus(1);
        rating.setLikeCount(0);
        rating.setCreateTime(LocalDateTime.now());
        ratingMapper.insert(rating);

        updateActivityRating(rating.getActivityId());

        return Result.success(rating);
    }

    @GetMapping("/list/{activityId}")
    public Result<List<ActivityRating>> getRatingList(
            @PathVariable Long activityId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size) {
        
        LambdaQueryWrapper<ActivityRating> queryWrapper = new LambdaQueryWrapper<>();
        queryWrapper.eq(ActivityRating::getActivityId, activityId)
                    .eq(ActivityRating::getStatus, 1)
                    .orderByDesc(ActivityRating::getCreateTime);
        
        List<ActivityRating> ratings = ratingMapper.selectList(queryWrapper);
        return Result.success(ratings);
    }

    @GetMapping("/stats/{activityId}")
    public Result<Map<String, Object>> getRatingStats(@PathVariable Long activityId) {
        List<ActivityRating> ratings = ratingMapper.selectList(
            new LambdaQueryWrapper<ActivityRating>()
                .eq(ActivityRating::getActivityId, activityId)
                .eq(ActivityRating::getStatus, 1)
        );

        if (ratings.isEmpty()) {
            return Result.success(Map.of(
                "avgRating", 0.0,
                "totalCount", 0,
                "ratingDistribution", Map.of("5", 0, "4", 0, "3", 0, "2", 0, "1", 0)
            ));
        }

        double avgRating = ratings.stream()
            .mapToInt(ActivityRating::getRating)
            .average()
            .orElse(0.0);

        Map<String, Long> distribution = Map.of(
            "5", ratings.stream().filter(r -> r.getRating() == 5).count(),
            "4", ratings.stream().filter(r -> r.getRating() == 4).count(),
            "3", ratings.stream().filter(r -> r.getRating() == 3).count(),
            "2", ratings.stream().filter(r -> r.getRating() == 2).count(),
            "1", ratings.stream().filter(r -> r.getRating() == 1).count()
        );

        return Result.success(Map.of(
            "avgRating", Math.round(avgRating * 10) / 10.0,
            "totalCount", ratings.size(),
            "ratingDistribution", distribution
        ));
    }

    @GetMapping("/user/{userId}")
    public Result<List<ActivityRating>> getUserRatings(@PathVariable Long userId) {
        List<ActivityRating> ratings = ratingMapper.selectList(
            new LambdaQueryWrapper<ActivityRating>()
                .eq(ActivityRating::getUserId, userId)
                .orderByDesc(ActivityRating::getCreateTime)
        );
        return Result.success(ratings);
    }

    @PostMapping("/like/{ratingId}")
    public Result<Boolean> likeRating(@PathVariable Long ratingId) {
        ActivityRating rating = ratingMapper.selectById(ratingId);
        if (rating != null) {
            rating.setLikeCount(rating.getLikeCount() + 1);
            ratingMapper.updateById(rating);
            return Result.success(true);
        }
        return Result.fail("评价不存在");
    }

    @PostMapping("/reply/{ratingId}")
    public Result<Boolean> replyRating(@PathVariable Long ratingId, @RequestParam String reply) {
        ActivityRating rating = ratingMapper.selectById(ratingId);
        if (rating != null) {
            rating.setReply(reply);
            ratingMapper.updateById(rating);
            return Result.success(true);
        }
        return Result.fail("评价不存在");
    }

    private void updateActivityRating(Long activityId) {
        List<ActivityRating> ratings = ratingMapper.selectList(
            new LambdaQueryWrapper<ActivityRating>()
                .eq(ActivityRating::getActivityId, activityId)
                .eq(ActivityRating::getStatus, 1)
        );

        double avgRating = ratings.stream()
            .mapToInt(ActivityRating::getRating)
            .average()
            .orElse(0.0);

        Activity activity = activityMapper.selectById(activityId);
        if (activity != null) {
            activity.setRating(Math.round(avgRating * 10) / 10.0);
            activity.setRatingCount(ratings.size());
            activityMapper.updateById(activity);
        }
    }
}

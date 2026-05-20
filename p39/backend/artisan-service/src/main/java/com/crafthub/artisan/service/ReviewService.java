package com.crafthub.artisan.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.crafthub.artisan.dto.ReviewCreateDTO;
import com.crafthub.artisan.entity.ArtisanRatingStats;
import com.crafthub.artisan.entity.ArtisanReview;
import com.crafthub.artisan.entity.ReviewHelpful;
import com.crafthub.artisan.mapper.ArtisanRatingStatsMapper;
import com.crafthub.artisan.mapper.ArtisanReviewMapper;
import com.crafthub.artisan.mapper.ReviewHelpfulMapper;
import com.crafthub.common.result.Result;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ReviewService extends ServiceImpl<ArtisanReviewMapper, ArtisanReview> {

    private static final Logger log = LoggerFactory.getLogger(ReviewService.class);

    private final ArtisanRatingStatsMapper ratingStatsMapper;
    private final ReviewHelpfulMapper reviewHelpfulMapper;
    private final ObjectMapper objectMapper;

    @Transactional(rollbackFor = Exception.class)
    public Result<ArtisanReview> createReview(ReviewCreateDTO dto, Long userId) {
        log.info("创建评价，订单ID: {}, 匠人ID: {}", dto.getOrderId(), dto.getArtisanId());

        ArtisanReview existReview = getOne(
            new LambdaQueryWrapper<ArtisanReview>()
                .eq(ArtisanReview::getOrderId, dto.getOrderId())
                .eq(ArtisanReview::getUserId, userId)
        );
        if (existReview != null) {
            return Result.error("该订单已评价");
        }

        ArtisanReview review = new ArtisanReview();
        review.setOrderId(dto.getOrderId());
        review.setArtisanId(dto.getArtisanId());
        review.setUserId(userId);
        review.setPortfolioId(dto.getPortfolioId());
        review.setOverallRating(dto.getOverallRating());
        review.setSkillRating(dto.getSkillRating());
        review.setAttitudeRating(dto.getAttitudeRating());
        review.setDeliveryRating(dto.getDeliveryRating());
        review.setContent(dto.getContent());
        review.setIsAnonymous(dto.getIsAnonymous() ? 1 : 0);
        review.setHelpfulCount(0);
        review.setStatus(1);

        if (dto.getImages() != null && !dto.getImages().isEmpty()) {
            try {
                review.setImages(objectMapper.writeValueAsString(dto.getImages()));
            } catch (JsonProcessingException e) {
                log.error("图片序列化失败", e);
            }
        }

        save(review);
        log.info("评价创建成功，评价ID: {}", review.getId());

        updateRatingStats(dto.getArtisanId());

        return Result.success("评价成功", review);
    }

    @Transactional(rollbackFor = Exception.class)
    public void updateRatingStats(Long artisanId) {
        log.info("更新匠人评分统计，匠人ID: {}", artisanId);

        List<ArtisanReview> reviews = list(
            new LambdaQueryWrapper<ArtisanReview>()
                .eq(ArtisanReview::getArtisanId, artisanId)
                .eq(ArtisanReview::getStatus, 1)
        );

        if (reviews.isEmpty()) {
            return;
        }

        int total = reviews.size();
        BigDecimal avgOverall = calculateAverage(reviews, ArtisanReview::getOverallRating);
        BigDecimal avgSkill = calculateAverage(reviews, ArtisanReview::getSkillRating);
        BigDecimal avgAttitude = calculateAverage(reviews, ArtisanReview::getAttitudeRating);
        BigDecimal avgDelivery = calculateAverage(reviews, ArtisanReview::getDeliveryRating);

        int fiveStar = 0, fourStar = 0, threeStar = 0, twoStar = 0, oneStar = 0;
        for (ArtisanReview review : reviews) {
            int rating = review.getOverallRating().intValue();
            if (rating >= 5) fiveStar++;
            else if (rating >= 4) fourStar++;
            else if (rating >= 3) threeStar++;
            else if (rating >= 2) twoStar++;
            else oneStar++;
        }

        ArtisanRatingStats stats = ratingStatsMapper.selectOne(
            new LambdaQueryWrapper<ArtisanRatingStats>()
                .eq(ArtisanRatingStats::getArtisanId, artisanId)
        );

        if (stats == null) {
            stats = new ArtisanRatingStats();
            stats.setArtisanId(artisanId);
            stats.setTotalReviews(total);
            stats.setAvgOverallRating(avgOverall);
            stats.setAvgSkillRating(avgSkill);
            stats.setAvgAttitudeRating(avgAttitude);
            stats.setAvgDeliveryRating(avgDelivery);
            stats.setFiveStarCount(fiveStar);
            stats.setFourStarCount(fourStar);
            stats.setThreeStarCount(threeStar);
            stats.setTwoStarCount(twoStar);
            stats.setOneStarCount(oneStar);
            ratingStatsMapper.insert(stats);
        } else {
            stats.setTotalReviews(total);
            stats.setAvgOverallRating(avgOverall);
            stats.setAvgSkillRating(avgSkill);
            stats.setAvgAttitudeRating(avgAttitude);
            stats.setAvgDeliveryRating(avgDelivery);
            stats.setFiveStarCount(fiveStar);
            stats.setFourStarCount(fourStar);
            stats.setThreeStarCount(threeStar);
            stats.setTwoStarCount(twoStar);
            stats.setOneStarCount(oneStar);
            ratingStatsMapper.updateById(stats);
        }
    }

    private BigDecimal calculateAverage(List<ArtisanReview> reviews, 
                                         java.util.function.Function<ArtisanReview, BigDecimal> getter) {
        if (reviews.isEmpty()) {
            return BigDecimal.ZERO;
        }
        BigDecimal sum = reviews.stream()
            .map(getter)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(reviews.size()), 2, RoundingMode.HALF_UP);
    }

    public Result<Page<ArtisanReview>> getArtisanReviews(Long artisanId, Integer page, Integer size, Long userId) {
        Page<ArtisanReview> pageParam = new Page<>(page, size);
        Page<ArtisanReview> resultPage = page(pageParam,
            new LambdaQueryWrapper<ArtisanReview>()
                .eq(ArtisanReview::getArtisanId, artisanId)
                .eq(ArtisanReview::getStatus, 1)
                .orderByDesc(ArtisanReview::getCreateTime)
        );

        if (userId != null) {
            for (ArtisanReview review : resultPage.getRecords()) {
                ReviewHelpful helpful = reviewHelpfulMapper.selectOne(
                    new LambdaQueryWrapper<ReviewHelpful>()
                        .eq(ReviewHelpful::getReviewId, review.getId())
                        .eq(ReviewHelpful::getUserId, userId)
                );
                review.setIsHelpful(helpful != null);
            }
        }

        return Result.success(resultPage);
    }

    public Result<ArtisanRatingStats> getRatingStats(Long artisanId) {
        ArtisanRatingStats stats = ratingStatsMapper.selectOne(
            new LambdaQueryWrapper<ArtisanRatingStats>()
                .eq(ArtisanRatingStats::getArtisanId, artisanId)
        );
        if (stats == null) {
            stats = new ArtisanRatingStats();
            stats.setArtisanId(artisanId);
            stats.setTotalReviews(0);
            stats.setAvgOverallRating(BigDecimal.ZERO);
            stats.setAvgSkillRating(BigDecimal.ZERO);
            stats.setAvgAttitudeRating(BigDecimal.ZERO);
            stats.setAvgDeliveryRating(BigDecimal.ZERO);
        }
        return Result.success(stats);
    }

    @Transactional(rollbackFor = Exception.class)
    public Result<Void> markHelpful(Long reviewId, Long userId) {
        log.info("标记评价为有用，评价ID: {}, 用户ID: {}", reviewId, userId);

        ReviewHelpful exist = reviewHelpfulMapper.selectOne(
            new LambdaQueryWrapper<ReviewHelpful>()
                .eq(ReviewHelpful::getReviewId, reviewId)
                .eq(ReviewHelpful::getUserId, userId)
        );

        if (exist != null) {
            return Result.error("已标记过有用");
        }

        ReviewHelpful helpful = new ReviewHelpful();
        helpful.setReviewId(reviewId);
        helpful.setUserId(userId);
        reviewHelpfulMapper.insert(helpful);

        ArtisanReview review = getById(reviewId);
        if (review != null) {
            review.setHelpfulCount(review.getHelpfulCount() + 1);
            updateById(review);
        }

        return Result.success();
    }

    public Result<ArtisanReview> getReviewByOrderId(Long orderId, Long userId) {
        ArtisanReview review = getOne(
            new LambdaQueryWrapper<ArtisanReview>()
                .eq(ArtisanReview::getOrderId, orderId)
                .eq(ArtisanReview::getUserId, userId)
        );
        return Result.success(review);
    }
}

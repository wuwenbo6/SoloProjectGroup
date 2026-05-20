package com.crafthub.artisan.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.crafthub.artisan.dto.ReviewCreateDTO;
import com.crafthub.artisan.entity.ArtisanRatingStats;
import com.crafthub.artisan.entity.ArtisanReview;
import com.crafthub.artisan.service.ReviewService;
import com.crafthub.common.result.Result;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/review")
@RequiredArgsConstructor
public class ReviewController {

    private final ReviewService reviewService;

    @PostMapping
    public Result<ArtisanReview> createReview(
            @Valid @RequestBody ReviewCreateDTO dto,
            @RequestHeader(required = false) Long userId) {
        if (userId == null) {
            userId = 1L;
        }
        return reviewService.createReview(dto, userId);
    }

    @GetMapping("/artisan/{artisanId}")
    public Result<Page<ArtisanReview>> getArtisanReviews(
            @PathVariable Long artisanId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestHeader(required = false) Long userId) {
        return reviewService.getArtisanReviews(artisanId, page, size, userId);
    }

    @GetMapping("/artisan/{artisanId}/stats")
    public Result<ArtisanRatingStats> getRatingStats(@PathVariable Long artisanId) {
        return reviewService.getRatingStats(artisanId);
    }

    @PostMapping("/{reviewId}/helpful")
    public Result<Void> markHelpful(
            @PathVariable Long reviewId,
            @RequestHeader(required = false) Long userId) {
        if (userId == null) {
            userId = 1L;
        }
        return reviewService.markHelpful(reviewId, userId);
    }

    @GetMapping("/order/{orderId}")
    public Result<ArtisanReview> getReviewByOrderId(
            @PathVariable Long orderId,
            @RequestHeader(required = false) Long userId) {
        if (userId == null) {
            userId = 1L;
        }
        return reviewService.getReviewByOrderId(orderId, userId);
    }
}

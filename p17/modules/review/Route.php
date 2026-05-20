<?php
namespace Modules\review;

class Route
{
    public static function getRoutes(): array
    {
        return [
            'POST' => [
                '/api/review/create' => fn($data, $request) => ReviewController::createReview($data, $request),
                '/api/review/batch-create' => fn($data, $request) => ReviewController::batchCreateReview($data, $request),
                '/api/review/audit' => fn($data, $request) => ReviewController::manualReview($data, $request),
                '/api/review/trigger-auto' => fn($data, $request) => ReviewController::triggerAutoReview($data, $request),
            ],
            'GET' => [
                '/api/review/list' => fn($data, $request) => ReviewController::getReviewList($data, $request),
                '/api/review/detail' => fn($data, $request) => ReviewController::getReviewDetail($data, $request),
                '/api/review/stats' => fn($data, $request) => ReviewController::getReviewStats($data, $request),
            ],
        ];
    }
}
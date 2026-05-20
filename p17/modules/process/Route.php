<?php
namespace Modules\process;

class Route
{
    public static function getRoutes(): array
    {
        return [
            'GET' => [
                '/api/process/score/list' => fn($data, $request) => ProcessController::getScoreList($data, $request),
                '/api/process/calculate/result' => fn($data, $request) => ProcessController::getCalculateResult($data, $request),
                '/api/process/standard/list' => fn($data, $request) => ProcessController::getStandardList($data, $request),
            ],
            'POST' => [
                '/api/process/score/create' => fn($data, $request) => ProcessController::createScore($data, $request),
                '/api/process/score/confirm' => fn($data, $request) => ProcessController::confirmScore($data, $request),
                '/api/process/calculate' => fn($data, $request) => ProcessController::calculate($data, $request),
                '/api/process/batch/score' => fn($data, $request) => ProcessController::batchScore($data, $request),
            ],
        ];
    }
}

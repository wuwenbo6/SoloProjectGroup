<?php
namespace Modules\video;

class Route
{
    public static function getRoutes(): array
    {
        return [
            'POST' => [
                '/api/video/upload' => fn($data, $request) => VideoController::upload($data, $request),
                '/api/video/delete' => fn($data, $request) => VideoController::delete($data, $request),
            ],
            'GET' => [
                '/api/video/list' => fn($data, $request) => VideoController::getList($data, $request),
                '/api/video/detail' => fn($data, $request) => VideoController::getDetail($data, $request),
                '/api/video/stream' => fn($data, $request) => VideoController::stream($data, $request),
                '/api/video/download' => fn($data, $request) => VideoController::download($data, $request),
            ],
        ];
    }
}
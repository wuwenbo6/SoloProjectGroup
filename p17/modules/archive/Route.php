<?php
namespace Modules\archive;

class Route
{
    public static function getRoutes(): array
    {
        return [
            'POST' => [
                '/api/archive/create' => fn($data, $request) => ArchiveController::create($data, $request),
                '/api/archive/verify' => fn($data, $request) => ArchiveController::verify($data, $request),
                '/api/archive/batch/verify' => fn($data, $request) => ArchiveController::batchVerify($data, $request),
                '/api/archive/trace' => fn($data, $request) => ArchiveController::trace($data, $request),
                '/api/archive/void' => fn($data, $request) => ArchiveController::voidArchive($data, $request),
            ],
            'GET' => [
                '/api/archive/list' => fn($data, $request) => ArchiveController::getList($data, $request),
                '/api/archive/detail' => fn($data, $request) => ArchiveController::getDetail($data, $request),
                '/api/archive/trace/logs' => fn($data, $request) => ArchiveController::getTraceLogs($data, $request),
            ],
        ];
    }
}

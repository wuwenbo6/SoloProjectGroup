<?php
namespace Modules\audit;

class Route
{
    public static function getRoutes(): array
    {
        return [
            'GET' => [
                '/api/audit/list' => fn($data, $request) => AuditController::getLogList($data, $request),
                '/api/audit/detail' => fn($data, $request) => AuditController::getLogDetail($data, $request),
                '/api/audit/trace' => fn($data, $request) => AuditController::getTraceDetail($data, $request),
                '/api/audit/stats' => fn($data, $request) => AuditController::getStats($data, $request),
                '/api/audit/modules' => fn($data, $request) => AuditController::getModuleList($data, $request),
                '/api/audit/operations' => fn($data, $request) => AuditController::getOperationList($data, $request),
                '/api/audit/export' => fn($data, $request) => AuditController::exportLogs($data, $request),
            ],
        ];
    }
}
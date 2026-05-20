<?php
namespace Modules\integration;

class Route
{
    public static function getRoutes(): array
    {
        return [
            'POST' => [
                '/api/integration/webhook/culture' => fn($data, $request) => IntegrationController::cultureWebhook($data, $request),
                '/api/integration/sync/skills/out' => fn($data, $request) => IntegrationController::syncSkillsOut($data, $request),
                '/api/integration/sync/skills/in' => fn($data, $request) => IntegrationController::syncSkillsIn($data, $request),
                '/api/integration/sync/heritors/out' => fn($data, $request) => IntegrationController::syncHeritorsOut($data, $request),
                '/api/integration/sync/heritors/in' => fn($data, $request) => IntegrationController::syncHeritorsIn($data, $request),
                '/api/integration/sync/archives/out' => fn($data, $request) => IntegrationController::syncArchivesOut($data, $request),
                '/api/integration/sync/archives/in' => fn($data, $request) => IntegrationController::syncArchivesIn($data, $request),
                '/api/platform/create' => fn($data, $request) => PlatformController::createPlatform($data, $request),
                '/api/platform/update' => fn($data, $request) => PlatformController::updatePlatform($data, $request),
                '/api/platform/test' => fn($data, $request) => PlatformController::testConnection($data, $request),
                '/api/platform/refresh-token' => fn($data, $request) => PlatformController::refreshToken($data, $request),
                '/api/platform/pull' => fn($data, $request) => PlatformController::pullData($data, $request),
                '/api/platform/push' => fn($data, $request) => PlatformController::pushData($data, $request),
                '/api/platform/delete' => fn($data, $request) => PlatformController::deletePlatform($data, $request),
            ],
            'GET' => [
                '/api/integration/sync/logs' => fn($data, $request) => IntegrationController::getSyncLogs($data, $request),
                '/api/integration/sync/status' => fn($data, $request) => IntegrationController::getSyncStatus($data, $request),
                '/api/platform/list' => fn($data, $request) => PlatformController::getPlatformList($data, $request),
                '/api/platform/detail' => fn($data, $request) => PlatformController::getPlatformDetail($data, $request),
                '/api/platform/stats' => fn($data, $request) => PlatformController::getSyncStats($data, $request),
            ],
        ];
    }
}

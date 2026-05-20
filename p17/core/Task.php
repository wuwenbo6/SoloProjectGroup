<?php
namespace Core;

class Task
{
    public static function handle(array $data)
    {
        $taskType = $data['type'] ?? '';
        $payload = $data['payload'] ?? [];

        switch ($taskType) {
            case 'sync_tourism_data':
                return self::syncTourismData($payload);
            case 'batch_verify_archive':
                return self::batchVerifyArchive($payload);
            case 'send_notification':
                return self::sendNotification($payload);
            case 'generate_report':
                return self::generateReport($payload);
            default:
                return ['error' => '未知任务类型'];
        }
    }

    private static function syncTourismData(array $payload): array
    {
        $module = new \Modules\tourism\TourismService();
        return $module->syncData($payload);
    }

    private static function batchVerifyArchive(array $payload): array
    {
        $archiveIds = $payload['archive_ids'] ?? [];
        $results = [];
        $db = Database::getInstance();

        foreach ($archiveIds as $id) {
            $archive = $db->fetchOne("SELECT * FROM heritage_archives WHERE id = ?", [$id]);
            if ($archive) {
                $verifyResult = \Modules\archive\ArchiveService::verifyArchive($archive);
                $results[] = [
                    'archive_id' => $id,
                    'verify_result' => $verifyResult,
                    'verified_at' => date('Y-m-d H:i:s'),
                ];
            }
        }

        return ['total' => count($results), 'results' => $results];
    }

    private static function sendNotification(array $payload): array
    {
        $userId = $payload['user_id'] ?? 0;
        $content = $payload['content'] ?? '';
        $type = $payload['type'] ?? 'system';

        $db = Database::getInstance();
        $db->insert('system_notifications', [
            'user_id' => $userId,
            'type' => $type,
            'content' => $content,
            'is_read' => 0,
            'created_at' => date('Y-m-d H:i:s'),
        ]);

        return ['status' => 'sent', 'user_id' => $userId];
    }

    private static function generateReport(array $payload): array
    {
        $reportType = $payload['type'] ?? 'monthly';
        $startDate = $payload['start_date'] ?? date('Y-m-01');
        $endDate = $payload['end_date'] ?? date('Y-m-t');

        $db = Database::getInstance();

        $skillCount = $db->fetchColumn("SELECT COUNT(*) FROM heritage_skills WHERE created_at BETWEEN ? AND ?", [$startDate, $endDate]);
        $processCount = $db->fetchColumn("SELECT COUNT(*) FROM skill_processes WHERE created_at BETWEEN ? AND ?", [$startDate, $endDate]);
        $archiveCount = $db->fetchColumn("SELECT COUNT(*) FROM heritage_archives WHERE created_at BETWEEN ? AND ?", [$startDate, $endDate]);

        return [
            'report_type' => $reportType,
            'period' => [$startDate, $endDate],
            'statistics' => [
                'new_skills' => $skillCount,
                'new_processes' => $processCount,
                'new_archives' => $archiveCount,
            ],
            'generated_at' => date('Y-m-d H:i:s'),
        ];
    }
}

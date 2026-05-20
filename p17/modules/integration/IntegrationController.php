<?php
namespace Modules\integration;

use Swoole\Http\Request;
use Core\Database;
use Middleware\AuthMiddleware;
use Utils\Crypto;
use Modules\integration\FieldMapping;

class IntegrationController
{
    private static $cultureSystems = [
        'whhc' => '文旅部非遗数据库',
        'prowh' => '省文旅数据库',
        'citywh' => '市文旅数据库',
    ];

    private static $syncTypes = [
        'skill' => '技艺信息',
        'heritor' => '传承人信息',
        'archive' => '定级档案',
    ];

    public static function cultureWebhook(array $data, Request $request)
    {
        $requiredError = validateRequired($data, ['system_id', 'event_type', 'timestamp', 'signature']);
        if ($requiredError) {
            return error($requiredError);
        }

        if (!isset(self::$cultureSystems[$data['system_id']])) {
            return error('未知的系统标识');
        }

        $signature = self::generateSignature($data, $data['system_id']);
        if (!hash_equals($signature, $data['signature'])) {
            logWrite('warning', '文旅系统webhook签名验证失败', [
                'system_id' => $data['system_id'],
                'received_signature' => $data['signature'],
                'expected_signature' => $signature,
            ]);
            return error('签名验证失败', 401);
        }

        if (abs(time() - $data['timestamp']) > 300) {
            return error('请求已过期', 408);
        }

        $db = Database::getInstance();
        $db->insert('sync_logs', [
            'sync_type' => 'webhook_' . $data['event_type'],
            'sync_direction' => 'in',
            'target_system' => $data['system_id'],
            'record_count' => 1,
            'success_count' => 0,
            'sync_status' => 1,
            'request_data' => json_encode($data, JSON_UNESCAPED_UNICODE),
            'response_data' => '',
            'created_at' => date('Y-m-d H:i:s'),
        ]);

        logWrite('info', '接收文旅系统webhook', [
            'system_id' => $data['system_id'],
            'event_type' => $data['event_type'],
        ]);

        return success([
            'received' => true,
            'event_type' => $data['event_type'],
            'processed_at' => date('Y-m-d H:i:s'),
        ], '接收成功');
    }

    private static function generateSignature(array $data, string $systemId): string
    {
        $secret = self::getSystemSecret($systemId);
        unset($data['signature']);
        ksort($data);
        $signString = http_build_query($data) . $secret;
        return hash('sha256', $signString);
    }

    private static function getSystemSecret(string $systemId): string
    {
        $secrets = [
            'whhc' => 'heritage_2024_secret_whhc',
            'prowh' => 'heritage_2024_secret_prowh',
            'citywh' => 'heritage_2024_secret_citywh',
        ];
        return $secrets[$systemId] ?? 'default_secret_key';
    }

    public static function syncSkillsOut(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'integration:sync')) {
            return error('权限不足', 403);
        }

        $requiredError = validateRequired($data, ['target_system']);
        if ($requiredError) {
            return error($requiredError);
        }

        if (!isset(self::$cultureSystems[$data['target_system']])) {
            return error('未知的目标系统');
        }

        $db = Database::getInstance();
        $where = ['status' => 1];
        if (!empty($data['last_sync_time'])) {
            $where[] = 'updated_at >= ?';
            $params[] = $data['last_sync_time'];
        }

        $skills = $db->fetchAll("
            SELECT s.*, h.name as heritor_name, h.id_card as heritor_id_card
            FROM heritage_skills s
            LEFT JOIN heritors h ON s.heritor_id = h.id
            WHERE s.status = 1
            ORDER BY s.id DESC
        ");

        $syncData = [];
        foreach ($skills as $skill) {
            $localData = [
                'skill_no' => $skill['skill_no'],
                'name' => $skill['name'],
                'category' => $skill['category'],
                'level' => $skill['level'],
                'heritor_name' => $skill['heritor_name'],
                'heritor_id_card' => $skill['heritor_id_card'],
                'application_area' => $skill['application_area'],
                'materials' => $skill['materials'],
                'tools' => $skill['tools'],
                'tech_description' => $skill['tech_description'],
                'status' => $skill['status'],
                'updated_at' => $skill['updated_at'],
            ];
            $syncData[] = FieldMapping::mapFields($localData, 'Skill', 'local_to_remote');
        }

        $db->insert('sync_logs', [
            'sync_type' => 'skill',
            'sync_direction' => 'out',
            'target_system' => $data['target_system'],
            'record_count' => count($syncData),
            'success_count' => count($syncData),
            'sync_status' => 2,
            'request_data' => json_encode($data, JSON_UNESCAPED_UNICODE),
            'response_data' => json_encode(['count' => count($syncData)], JSON_UNESCAPED_UNICODE),
            'operator_user_id' => $user['id'],
            'created_at' => date('Y-m-d H:i:s'),
        ]);

        logWrite('info', '技艺信息同步到文旅系统', [
            'target_system' => $data['target_system'],
            'count' => count($syncData),
            'user_id' => $user['id'],
        ]);

        return success([
            'target_system' => $data['target_system'],
            'system_name' => self::$cultureSystems[$data['target_system']],
            'sync_type' => '技艺信息',
            'record_count' => count($syncData),
            'data' => $syncData,
            'sync_time' => date('Y-m-d H:i:s'),
        ], '同步成功');
    }

    public static function syncSkillsIn(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'integration:sync')) {
            return error('权限不足', 403);
        }

        if (empty($data['skills']) || !is_array($data['skills'])) {
            return error('技艺数据不能为空');
        }

        $db = Database::getInstance();
        $successCount = 0;
        $failCount = 0;
        $errors = [];

        $db->beginTransaction();
        try {
            foreach ($data['skills'] as $skillData) {
                $mappedData = FieldMapping::mapFields($skillData, 'Skill', 'remote_to_local');
                $skillNo = $mappedData['skill_no'] ?? '';
                if (empty($skillNo)) {
                    $failCount++;
                    $errors[] = '技艺编号不能为空';
                    continue;
                }

                $existing = $db->fetchOne("SELECT id FROM heritage_skills WHERE skill_no = ?", [$skillNo]);

                $skillParams = [
                    'name' => $mappedData['name'] ?? '',
                    'category' => $mappedData['category'] ?? 0,
                    'level' => $mappedData['level'] ?? 4,
                    'application_area' => $mappedData['application_area'] ?? '',
                    'materials' => $mappedData['materials'] ?? '',
                    'tools' => $mappedData['tools'] ?? '',
                    'tech_description' => $mappedData['tech_description'] ?? '',
                    'status' => $mappedData['status'] ?? 1,
                    'updated_at' => date('Y-m-d H:i:s'),
                ];

                if ($existing) {
                    $db->update('heritage_skills', $skillParams, 'skill_no = ?', [$skillNo]);
                    $successCount++;
                } else {
                    $skillParams['skill_no'] = $skillNo;
                    $skillParams['created_at'] = date('Y-m-d H:i:s');
                    $db->insert('heritage_skills', $skillParams);
                    $successCount++;
                }
            }

            $db->commit();
        } catch (\Exception $e) {
            $db->rollback();
            logWrite('error', '技艺信息同步失败', ['error' => $e->getMessage()]);
            return error('同步失败: ' . $e->getMessage());
        }

        $db->insert('sync_logs', [
            'sync_type' => 'skill',
            'sync_direction' => 'in',
            'target_system' => $data['source_system'] ?? 'unknown',
            'record_count' => count($data['skills']),
            'success_count' => $successCount,
            'sync_status' => 2,
            'request_data' => json_encode($data, JSON_UNESCAPED_UNICODE),
            'response_data' => json_encode(['success' => $successCount, 'fail' => $failCount], JSON_UNESCAPED_UNICODE),
            'operator_user_id' => $user['id'],
            'created_at' => date('Y-m-d H:i:s'),
        ]);

        return success([
            'total' => count($data['skills']),
            'success_count' => $successCount,
            'fail_count' => $failCount,
            'errors' => $errors,
        ], '技艺信息同步完成');
    }

    public static function syncHeritorsOut(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'integration:sync')) {
            return error('权限不足', 403);
        }

        $requiredError = validateRequired($data, ['target_system']);
        if ($requiredError) {
            return error($requiredError);
        }

        $db = Database::getInstance();
        $heritors = $db->fetchAll("
            SELECT h.*, s.name as skill_name
            FROM heritors h
            LEFT JOIN heritage_skills s ON h.skill_id = s.id
            WHERE h.status = 1
            ORDER BY h.id DESC
        ");

        $syncData = [];
        foreach ($heritors as $heritor) {
            $localData = [
                'heritor_no' => $heritor['heritor_no'],
                'name' => $heritor['name'],
                'gender' => $heritor['gender'],
                'birth_date' => $heritor['birth_date'],
                'id_card' => maskString($heritor['id_card'], 6, 4),
                'ethnicity' => $heritor['ethnicity'],
                'education' => $heritor['education'],
                'profession' => $heritor['profession'],
                'skill_name' => $heritor['skill_name'],
                'qualification_level' => $heritor['qualification_level'],
                'address' => $heritor['address'],
                'phone' => maskString($heritor['phone'], 3, 4),
                'status' => $heritor['status'],
                'updated_at' => $heritor['updated_at'],
            ];
            $syncData[] = FieldMapping::mapFields($localData, 'Heritor', 'local_to_remote');
        }

        $db->insert('sync_logs', [
            'sync_type' => 'heritor',
            'sync_direction' => 'out',
            'target_system' => $data['target_system'],
            'record_count' => count($syncData),
            'success_count' => count($syncData),
            'sync_status' => 2,
            'request_data' => json_encode($data, JSON_UNESCAPED_UNICODE),
            'response_data' => json_encode(['count' => count($syncData)], JSON_UNESCAPED_UNICODE),
            'operator_user_id' => $user['id'],
            'created_at' => date('Y-m-d H:i:s'),
        ]);

        return success([
            'target_system' => $data['target_system'],
            'system_name' => self::$cultureSystems[$data['target_system']],
            'sync_type' => '传承人信息',
            'record_count' => count($syncData),
            'data' => $syncData,
            'sync_time' => date('Y-m-d H:i:s'),
        ], '同步成功');
    }

    public static function syncHeritorsIn(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'integration:sync')) {
            return error('权限不足', 403);
        }

        if (empty($data['heritors']) || !is_array($data['heritors'])) {
            return error('传承人数据不能为空');
        }

        $db = Database::getInstance();
        $successCount = 0;
        $failCount = 0;
        $errors = [];

        $db->beginTransaction();
        try {
            foreach ($data['heritors'] as $heritorData) {
                $mappedData = FieldMapping::mapFields($heritorData, 'Heritor', 'remote_to_local');
                $heritorNo = $mappedData['heritor_no'] ?? '';
                if (empty($heritorNo)) {
                    $failCount++;
                    $errors[] = '传承人编号不能为空';
                    continue;
                }

                $existing = $db->fetchOne("SELECT id FROM heritors WHERE heritor_no = ?", [$heritorNo]);

                $heritorParams = [
                    'name' => $mappedData['name'] ?? '',
                    'gender' => $mappedData['gender'] ?? 1,
                    'birth_date' => $mappedData['birth_date'] ?? null,
                    'id_card' => $mappedData['id_card'] ?? '',
                    'ethnicity' => $mappedData['ethnicity'] ?? '',
                    'education' => $mappedData['education'] ?? '',
                    'profession' => $mappedData['profession'] ?? '',
                    'qualification_level' => $mappedData['qualification_level'] ?? 4,
                    'address' => $mappedData['address'] ?? '',
                    'phone' => $mappedData['phone'] ?? '',
                    'status' => $mappedData['status'] ?? 1,
                    'updated_at' => date('Y-m-d H:i:s'),
                ];

                if ($existing) {
                    $db->update('heritors', $heritorParams, 'heritor_no = ?', [$heritorNo]);
                    $successCount++;
                } else {
                    $heritorParams['heritor_no'] = $heritorNo;
                    $heritorParams['created_at'] = date('Y-m-d H:i:s');
                    $db->insert('heritors', $heritorParams);
                    $successCount++;
                }
            }

            $db->commit();
        } catch (\Exception $e) {
            $db->rollback();
            logWrite('error', '传承人信息同步失败', ['error' => $e->getMessage()]);
            return error('同步失败: ' . $e->getMessage());
        }

        $db->insert('sync_logs', [
            'sync_type' => 'heritor',
            'sync_direction' => 'in',
            'target_system' => $data['source_system'] ?? 'unknown',
            'record_count' => count($data['heritors']),
            'success_count' => $successCount,
            'sync_status' => 2,
            'request_data' => json_encode($data, JSON_UNESCAPED_UNICODE),
            'response_data' => json_encode(['success' => $successCount, 'fail' => $failCount], JSON_UNESCAPED_UNICODE),
            'operator_user_id' => $user['id'],
            'created_at' => date('Y-m-d H:i:s'),
        ]);

        return success([
            'total' => count($data['heritors']),
            'success_count' => $successCount,
            'fail_count' => $failCount,
            'errors' => $errors,
        ], '传承人信息同步完成');
    }

    public static function syncArchivesOut(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'integration:sync')) {
            return error('权限不足', 403);
        }

        $requiredError = validateRequired($data, ['target_system']);
        if ($requiredError) {
            return error($requiredError);
        }

        $db = Database::getInstance();
        $archives = $db->fetchAll("
            SELECT a.*, s.name as skill_name, s.skill_no, h.name as heritor_name
            FROM heritage_archives a
            LEFT JOIN heritage_skills s ON a.skill_id = s.id
            LEFT JOIN heritors h ON a.heritor_id = h.id
            WHERE a.archive_status = 1
            ORDER BY a.id DESC
        ");

        $syncData = [];
        foreach ($archives as $archive) {
            $localData = [
                'archive_no' => $archive['archive_no'],
                'skill_no' => $archive['skill_no'],
                'skill_name' => $archive['skill_name'],
                'heritor_name' => $archive['heritor_name'],
                'final_level' => $archive['final_level'],
                'total_score' => $archive['total_score'],
                'archive_hash' => $archive['archive_hash'],
                'archive_status' => $archive['archive_status'],
                'archiver_user_id' => $archive['archiver_user_id'],
                'archived_at' => $archive['archived_at'],
                'updated_at' => $archive['updated_at'],
            ];
            $syncData[] = FieldMapping::mapFields($localData, 'Archive', 'local_to_remote');
        }

        $db->insert('sync_logs', [
            'sync_type' => 'archive',
            'sync_direction' => 'out',
            'target_system' => $data['target_system'],
            'record_count' => count($syncData),
            'success_count' => count($syncData),
            'sync_status' => 2,
            'request_data' => json_encode($data, JSON_UNESCAPED_UNICODE),
            'response_data' => json_encode(['count' => count($syncData)], JSON_UNESCAPED_UNICODE),
            'operator_user_id' => $user['id'],
            'created_at' => date('Y-m-d H:i:s'),
        ]);

        return success([
            'target_system' => $data['target_system'],
            'system_name' => self::$cultureSystems[$data['target_system']],
            'sync_type' => '定级档案',
            'record_count' => count($syncData),
            'data' => $syncData,
            'sync_time' => date('Y-m-d H:i:s'),
        ], '同步成功');
    }

    public static function syncArchivesIn(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'integration:sync')) {
            return error('权限不足', 403);
        }

        if (empty($data['archives']) || !is_array($data['archives'])) {
            return error('档案数据不能为空');
        }

        $db = Database::getInstance();
        $successCount = 0;
        $failCount = 0;
        $errors = [];

        $db->beginTransaction();
        try {
            foreach ($data['archives'] as $archiveData) {
                $mappedData = FieldMapping::mapFields($archiveData, 'Archive', 'remote_to_local');
                $archiveNo = $mappedData['archive_no'] ?? '';
                if (empty($archiveNo)) {
                    $failCount++;
                    $errors[] = '档案编号不能为空';
                    continue;
                }

                $existing = $db->fetchOne("SELECT id FROM heritage_archives WHERE archive_no = ?", [$archiveNo]);

                $archiveParams = [
                    'final_level' => $mappedData['final_level'] ?? 4,
                    'total_score' => $mappedData['total_score'] ?? 0,
                    'archive_hash' => $mappedData['archive_hash'] ?? '',
                    'archive_status' => $mappedData['archive_status'] ?? 1,
                    'updated_at' => date('Y-m-d H:i:s'),
                ];

                if ($existing) {
                    $db->update('heritage_archives', $archiveParams, 'archive_no = ?', [$archiveNo]);
                    $successCount++;
                } else {
                    $archiveParams['archive_no'] = $archiveNo;
                    $archiveParams['created_at'] = date('Y-m-d H:i:s');
                    $db->insert('heritage_archives', $archiveParams);
                    $successCount++;
                }
            }

            $db->commit();
        } catch (\Exception $e) {
            $db->rollback();
            logWrite('error', '档案信息同步失败', ['error' => $e->getMessage()]);
            return error('同步失败: ' . $e->getMessage());
        }

        $db->insert('sync_logs', [
            'sync_type' => 'archive',
            'sync_direction' => 'in',
            'target_system' => $data['source_system'] ?? 'unknown',
            'record_count' => count($data['archives']),
            'success_count' => $successCount,
            'sync_status' => 2,
            'request_data' => json_encode($data, JSON_UNESCAPED_UNICODE),
            'response_data' => json_encode(['success' => $successCount, 'fail' => $failCount], JSON_UNESCAPED_UNICODE),
            'operator_user_id' => $user['id'],
            'created_at' => date('Y-m-d H:i:s'),
        ]);

        return success([
            'total' => count($data['archives']),
            'success_count' => $successCount,
            'fail_count' => $failCount,
            'errors' => $errors,
        ], '档案信息同步完成');
    }

    public static function getSyncLogs(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'integration:view')) {
            return error('权限不足', 403);
        }

        $db = Database::getInstance();
        $page = max(1, intval($data['page'] ?? 1));
        $pageSize = min(100, max(10, intval($data['page_size'] ?? 20)));
        $offset = ($page - 1) * $pageSize;

        $where = [];
        $params = [];

        if (!empty($data['sync_type'])) {
            $where[] = 'sync_type = ?';
            $params[] = $data['sync_type'];
        }
        if (!empty($data['target_system'])) {
            $where[] = 'target_system = ?';
            $params[] = $data['target_system'];
        }
        if (!empty($data['sync_direction'])) {
            $where[] = 'sync_direction = ?';
            $params[] = $data['sync_direction'];
        }
        if (isset($data['sync_status']) && $data['sync_status'] !== '') {
            $where[] = 'sync_status = ?';
            $params[] = $data['sync_status'];
        }

        $whereClause = !empty($where) ? implode(' AND ', $where) : '1=1';

        $total = $db->fetchColumn("
            SELECT COUNT(*) FROM sync_logs WHERE {$whereClause}
        ", $params);

        $logs = $db->fetchAll("
            SELECT l.*, u.real_name as operator_name
            FROM sync_logs l
            LEFT JOIN system_users u ON l.operator_user_id = u.id
            WHERE {$whereClause}
            ORDER BY l.created_at DESC
            LIMIT {$offset}, {$pageSize}
        ", $params);

        $statusMap = [1 => '进行中', 2 => '已完成', 3 => '失败'];
        $directionMap = ['in' => '入站', 'out' => '出站'];

        foreach ($logs as &$log) {
            $log['sync_type_name'] = self::$syncTypes[$log['sync_type']] ?? $log['sync_type'];
            $log['sync_status_name'] = $statusMap[$log['sync_status']] ?? '未知';
            $log['sync_direction_name'] = $directionMap[$log['sync_direction']] ?? '未知';
            $log['target_system_name'] = self::$cultureSystems[$log['target_system']] ?? $log['target_system'];
        }

        return success(paginate($page, $pageSize, $total, $logs));
    }

    public static function getSyncStatus(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }

        $db = Database::getInstance();
        $stats = [];

        foreach (['skill', 'heritor', 'archive'] as $type) {
            $stats[$type] = [
                'name' => self::$syncTypes[$type],
                'total' => $db->fetchColumn("SELECT COUNT(*) FROM sync_logs WHERE sync_type = ?", [$type]),
                'success' => $db->fetchColumn("SELECT COUNT(*) FROM sync_logs WHERE sync_type = ? AND sync_status = 2", [$type]),
                'failed' => $db->fetchColumn("SELECT COUNT(*) FROM sync_logs WHERE sync_type = ? AND sync_status = 3", [$type]),
            ];
        }

        $lastSync = $db->fetchOne("
            SELECT * FROM sync_logs
            ORDER BY created_at DESC
            LIMIT 1
        ");

        return success([
            'stats' => $stats,
            'last_sync' => $lastSync ? [
                'sync_type' => $lastSync['sync_type'],
                'sync_type_name' => self::$syncTypes[$lastSync['sync_type']] ?? $lastSync['sync_type'],
                'created_at' => $lastSync['created_at'],
                'status' => $lastSync['sync_status'] == 2 ? '成功' : '失败',
            ] : null,
            'available_systems' => self::$cultureSystems,
        ]);
    }
}

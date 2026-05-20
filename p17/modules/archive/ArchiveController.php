<?php
namespace Modules\archive;

use Swoole\Http\Request;
use Core\Database;
use Middleware\AuthMiddleware;
use Utils\Crypto;

class ArchiveController
{
    public static function create(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'archive:create')) {
            return error('权限不足', 403);
        }

        $requiredError = validateRequired($data, ['skill_id', 'final_level']);
        if ($requiredError) {
            return error($requiredError);
        }

        $db = Database::getInstance();
        $skill = $db->fetchOne("SELECT * FROM heritage_skills WHERE id = ?", [$data['skill_id']]);
        if (!$skill) {
            return error('技艺信息不存在');
        }

        $existingArchive = $db->fetchOne("SELECT id FROM heritage_archives WHERE skill_id = ? AND archive_status = 1", [$data['skill_id']]);
        if ($existingArchive) {
            return error('该技艺已有生效的定级档案');
        }

        $archiveNo = 'ARCH' . date('YmdHis') . rand(1000, 9999);

        $archiveData = [
            'skill' => $skill,
            'final_level' => $data['final_level'],
            'total_score' => $data['total_score'] ?? 0,
            'create_time' => date('Y-m-d H:i:s'),
            'creator' => $user['id'],
        ];

        $encryptedData = Crypto::encrypt(json_encode($archiveData));
        $archiveHash = Crypto::generateArchiveHash($archiveData);

        $db->beginTransaction();
        try {
            $archiveId = $db->insert('heritage_archives', [
                'archive_no' => $archiveNo,
                'skill_id' => $data['skill_id'],
                'heritor_id' => $data['heritor_id'] ?? $skill['heritor_id'],
                'final_level' => $data['final_level'],
                'total_score' => $data['total_score'] ?? 0,
                'archive_data' => $encryptedData,
                'archive_hash' => $archiveHash,
                'previous_hash' => $data['previous_hash'] ?? '',
                'archive_status' => 1,
                'archive_version' => $data['archive_version'] ?? '1.0',
                'archiver_user_id' => $user['id'],
                'archived_at' => date('Y-m-d H:i:s'),
                'created_at' => date('Y-m-d H:i:s'),
            ]);

            $db->insert('archive_trace_logs', [
                'archive_id' => $archiveId,
                'operation_type' => 'create',
                'operation_detail' => '创建定级档案',
                'operator_user_id' => $user['id'],
                'before_hash' => '',
                'after_hash' => $archiveHash,
                'ip_address' => getRequestIp($request),
                'created_at' => date('Y-m-d H:i:s'),
            ]);

            $db->commit();

            logWrite('info', '创建定级档案成功', [
                'archive_id' => $archiveId,
                'archive_no' => $archiveNo,
                'skill_id' => $data['skill_id'],
                'user_id' => $user['id'],
            ]);

            return success([
                'id' => $archiveId,
                'archive_no' => $archiveNo,
                'archive_hash' => $archiveHash,
            ], '档案创建成功');
        } catch (\Exception $e) {
            $db->rollback();
            logWrite('error', '创建定级档案失败', ['error' => $e->getMessage()]);
            return error('创建失败: ' . $e->getMessage());
        }
    }

    public static function getList(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'archive:view')) {
            return error('权限不足', 403);
        }

        $db = Database::getInstance();
        $page = max(1, intval($data['page'] ?? 1));
        $pageSize = min(100, max(10, intval($data['page_size'] ?? 20)));
        $offset = ($page - 1) * $pageSize;

        $where = [];
        $params = [];

        if (!empty($data['keyword'])) {
            $where[] = 'archive_no LIKE ?';
            $params[] = '%' . $data['keyword'] . '%';
        }
        if (!empty($data['skill_id'])) {
            $where[] = 'a.skill_id = ?';
            $params[] = $data['skill_id'];
        }
        if (!empty($data['final_level'])) {
            $where[] = 'final_level = ?';
            $params[] = $data['final_level'];
        }
        if (isset($data['archive_status']) && $data['archive_status'] !== '') {
            $where[] = 'archive_status = ?';
            $params[] = $data['archive_status'];
        }

        $whereClause = !empty($where) ? implode(' AND ', $where) : '1=1';

        $total = $db->fetchColumn("
            SELECT COUNT(*) FROM heritage_archives a WHERE {$whereClause}
        ", $params);

        $list = $db->fetchAll("
            SELECT a.*, s.name as skill_name, s.skill_no, h.name as heritor_name,
                   u.real_name as archiver_name
            FROM heritage_archives a
            LEFT JOIN heritage_skills s ON a.skill_id = s.id
            LEFT JOIN heritors h ON a.heritor_id = h.id
            LEFT JOIN system_users u ON a.archiver_user_id = u.id
            WHERE {$whereClause}
            ORDER BY a.id DESC
            LIMIT {$offset}, {$pageSize}
        ", $params);

        $levelMap = [1 => '国家级', 2 => '省级', 3 => '市级', 4 => '县级'];
        $statusMap = [0 => '已作废', 1 => '有效'];

        foreach ($list as &$item) {
            $item['final_level_name'] = $levelMap[$item['final_level']] ?? '未知';
            $item['archive_status_name'] = $statusMap[$item['archive_status']] ?? '未知';
            $item['archive_hash_masked'] = substr($item['archive_hash'], 0, 16) . '...';
        }

        return success(paginate($page, $pageSize, $total, $list));
    }

    public static function getDetail(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'archive:view')) {
            return error('权限不足', 403);
        }

        if (empty($data['id']) && empty($data['archive_no'])) {
            return error('档案ID或编号不能为空');
        }

        $db = Database::getInstance();

        if (!empty($data['id'])) {
            $archive = $db->fetchOne("
                SELECT a.*, s.name as skill_name, s.skill_no, h.name as heritor_name,
                       u.real_name as archiver_name
                FROM heritage_archives a
                LEFT JOIN heritage_skills s ON a.skill_id = s.id
                LEFT JOIN heritors h ON a.heritor_id = h.id
                LEFT JOIN system_users u ON a.archiver_user_id = u.id
                WHERE a.id = ?
            ", [$data['id']]);
        } else {
            $archive = $db->fetchOne("
                SELECT a.*, s.name as skill_name, s.skill_no, h.name as heritor_name,
                       u.real_name as archiver_name
                FROM heritage_archives a
                LEFT JOIN heritage_skills s ON a.skill_id = s.id
                LEFT JOIN heritors h ON a.heritor_id = h.id
                LEFT JOIN system_users u ON a.archiver_user_id = u.id
                WHERE a.archive_no = ?
            ", [$data['archive_no']]);
        }

        if (!$archive) {
            return error('档案不存在');
        }

        $decryptedData = Crypto::decrypt($archive['archive_data']);
        $archive['archive_data_decrypted'] = $decryptedData ? json_decode($decryptedData, true) : null;

        $levelMap = [1 => '国家级', 2 => '省级', 3 => '市级', 4 => '县级'];
        $statusMap = [0 => '已作废', 1 => '有效'];
        $archive['final_level_name'] = $levelMap[$archive['final_level']] ?? '未知';
        $archive['archive_status_name'] = $statusMap[$archive['archive_status']] ?? '未知';

        return success($archive);
    }

    public static function verify(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'archive:verify')) {
            return error('权限不足', 403);
        }

        if (empty($data['id']) && empty($data['archive_no'])) {
            return error('档案ID或编号不能为空');
        }

        $db = Database::getInstance();

        if (!empty($data['id'])) {
            $archive = $db->fetchOne("SELECT * FROM heritage_archives WHERE id = ?", [$data['id']]);
        } else {
            $archive = $db->fetchOne("SELECT * FROM heritage_archives WHERE archive_no = ?", [$data['archive_no']]);
        }

        if (!$archive) {
            return error('档案不存在');
        }

        $decryptedData = Crypto::decrypt($archive['archive_data']);
        if (!$decryptedData) {
            return error('档案数据解密失败');
        }

        $archiveData = json_decode($decryptedData, true);
        $currentHash = Crypto::generateArchiveHash($archiveData);
        $hashValid = hash_equals($currentHash, $archive['archive_hash']);

        $db->update('heritage_archives', [
            'verify_count' => $archive['verify_count'] + 1,
            'last_verify_time' => date('Y-m-d H:i:s'),
        ], 'id = ?', [$archive['id']]);

        $db->insert('archive_trace_logs', [
            'archive_id' => $archive['id'],
            'operation_type' => 'verify',
            'operation_detail' => '核验档案: ' . ($hashValid ? '通过' : '不通过'),
            'operator_user_id' => $user['id'],
            'before_hash' => $archive['archive_hash'],
            'after_hash' => $currentHash,
            'ip_address' => getRequestIp($request),
            'created_at' => date('Y-m-d H:i:s'),
        ]);

        $statusValid = $archive['archive_status'] == 1;
        $overallValid = $hashValid && $statusValid;

        logWrite('info', '档案核验完成', [
            'archive_id' => $archive['id'],
            'hash_valid' => $hashValid,
            'status_valid' => $statusValid,
            'user_id' => $user['id'],
        ]);

        return success([
            'archive_id' => $archive['id'],
            'archive_no' => $archive['archive_no'],
            'hash_valid' => $hashValid,
            'status_valid' => $statusValid,
            'overall_valid' => $overallValid,
            'verify_count' => $archive['verify_count'] + 1,
            'last_verify_time' => date('Y-m-d H:i:s'),
        ], $overallValid ? '档案核验通过' : '档案核验不通过');
    }

    public static function batchVerify(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'archive:verify')) {
            return error('权限不足', 403);
        }

        if (empty($data['ids']) || !is_array($data['ids'])) {
            return error('请选择要核验的档案');
        }

        $db = Database::getInstance();
        $results = [];
        $passCount = 0;
        $failCount = 0;

        foreach ($data['ids'] as $id) {
            $archive = $db->fetchOne("SELECT * FROM heritage_archives WHERE id = ?", [$id]);
            if (!$archive) {
                $results[] = ['id' => $id, 'valid' => false, 'reason' => '档案不存在'];
                $failCount++;
                continue;
            }

            $decryptedData = Crypto::decrypt($archive['archive_data']);
            if (!$decryptedData) {
                $results[] = ['id' => $id, 'valid' => false, 'reason' => '数据解密失败'];
                $failCount++;
                continue;
            }

            $archiveData = json_decode($decryptedData, true);
            $currentHash = Crypto::generateArchiveHash($archiveData);
            $hashValid = hash_equals($currentHash, $archive['archive_hash']);
            $statusValid = $archive['archive_status'] == 1;
            $overallValid = $hashValid && $statusValid;

            if ($overallValid) {
                $passCount++;
            } else {
                $failCount++;
            }

            $db->update('heritage_archives', [
                'verify_count' => $archive['verify_count'] + 1,
                'last_verify_time' => date('Y-m-d H:i:s'),
            ], 'id = ?', [$archive['id']]);

            $results[] = [
                'id' => $id,
                'archive_no' => $archive['archive_no'],
                'valid' => $overallValid,
                'hash_valid' => $hashValid,
                'status_valid' => $statusValid,
            ];
        }

        logWrite('info', '批量档案核验完成', [
            'total' => count($data['ids']),
            'pass_count' => $passCount,
            'fail_count' => $failCount,
            'user_id' => $user['id'],
        ]);

        return success([
            'total' => count($data['ids']),
            'pass_count' => $passCount,
            'fail_count' => $failCount,
            'results' => $results,
        ], '批量核验完成');
    }

    public static function trace(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'archive:view')) {
            return error('权限不足', 403);
        }

        if (empty($data['id']) && empty($data['archive_no'])) {
            return error('档案ID或编号不能为空');
        }

        $db = Database::getInstance();

        if (!empty($data['id'])) {
            $archive = $db->fetchOne("SELECT * FROM heritage_archives WHERE id = ?", [$data['id']]);
        } else {
            $archive = $db->fetchOne("SELECT * FROM heritage_archives WHERE archive_no = ?", [$data['archive_no']]);
        }

        if (!$archive) {
            return error('档案不存在');
        }

        $chain = [];
        $currentHash = $archive['archive_hash'];
        $currentArchive = $archive;
        $depth = 0;
        $maxDepth = 100;

        while ($currentArchive && $currentArchive['previous_hash'] && $depth < $maxDepth) {
            $chain[] = [
                'archive_no' => $currentArchive['archive_no'],
                'archive_hash' => $currentArchive['archive_hash'],
                'previous_hash' => $currentArchive['previous_hash'],
                'created_at' => $currentArchive['created_at'],
            ];

            $currentArchive = $db->fetchOne(
                "SELECT * FROM heritage_archives WHERE archive_hash = ?",
                [$currentArchive['previous_hash']]
            );
            $depth++;
        }

        if ($currentArchive) {
            $chain[] = [
                'archive_no' => $currentArchive['archive_no'],
                'archive_hash' => $currentArchive['archive_hash'],
                'previous_hash' => $currentArchive['previous_hash'],
                'created_at' => $currentArchive['created_at'],
            ];
        }

        $chain = array_reverse($chain);

        return success([
            'archive_no' => $archive['archive_no'],
            'chain_length' => count($chain),
            'chain' => $chain,
            'is_complete_chain' => $currentArchive && empty($currentArchive['previous_hash']),
        ]);
    }

    public static function getTraceLogs(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'archive:view')) {
            return error('权限不足', 403);
        }

        if (empty($data['archive_id'])) {
            return error('档案ID不能为空');
        }

        $db = Database::getInstance();
        $logs = $db->fetchAll("
            SELECT l.*, u.real_name as operator_name
            FROM archive_trace_logs l
            LEFT JOIN system_users u ON l.operator_user_id = u.id
            WHERE l.archive_id = ?
            ORDER BY l.created_at DESC
        ", [$data['archive_id']]);

        $operationMap = [
            'create' => '创建档案',
            'verify' => '核验档案',
            'update' => '更新档案',
            'void' => '作废档案',
        ];

        foreach ($logs as &$log) {
            $log['operation_type_name'] = $operationMap[$log['operation_type']] ?? $log['operation_type'];
            $log['before_hash_masked'] = $log['before_hash'] ? substr($log['before_hash'], 0, 16) . '...' : '';
            $log['after_hash_masked'] = $log['after_hash'] ? substr($log['after_hash'], 0, 16) . '...' : '';
        }

        return success($logs);
    }

    public static function voidArchive(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'archive:void')) {
            return error('权限不足', 403);
        }

        if (empty($data['id'])) {
            return error('档案ID不能为空');
        }

        $db = Database::getInstance();
        $archive = $db->fetchOne("SELECT * FROM heritage_archives WHERE id = ?", [$data['id']]);
        if (!$archive) {
            return error('档案不存在');
        }

        if ($archive['archive_status'] == 0) {
            return error('档案已作废');
        }

        try {
            $db->beginTransaction();

            $db->update('heritage_archives', [
                'archive_status' => 0,
                'updated_at' => date('Y-m-d H:i:s'),
            ], 'id = ?', [$archive['id']]);

            $db->insert('archive_trace_logs', [
                'archive_id' => $archive['id'],
                'operation_type' => 'void',
                'operation_detail' => '作废档案: ' . ($data['reason'] ?? '无理由'),
                'operator_user_id' => $user['id'],
                'before_hash' => $archive['archive_hash'],
                'after_hash' => '',
                'ip_address' => getRequestIp($request),
                'created_at' => date('Y-m-d H:i:s'),
            ]);

            $db->commit();

            logWrite('info', '档案作废成功', [
                'archive_id' => $archive['id'],
                'archive_no' => $archive['archive_no'],
                'user_id' => $user['id'],
            ]);

            return success(null, '档案作废成功');
        } catch (\Exception $e) {
            $db->rollback();
            logWrite('error', '档案作废失败', ['error' => $e->getMessage()]);
            return error('作废失败: ' . $e->getMessage());
        }
    }
}

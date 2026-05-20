<?php
namespace Modules\skill;

use Swoole\Http\Request;
use Core\Database;
use Middleware\AuthMiddleware;

class SkillController
{
    public static function create(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'skill:create')) {
            return error('权限不足', 403);
        }

        $requiredError = validateRequired($data, ['name', 'category', 'level']);
        if ($requiredError) {
            return error($requiredError);
        }

        $db = Database::getInstance();
        $skillNo = 'SKL' . date('YmdHis') . rand(1000, 9999);

        try {
            $db->beginTransaction();

            $skillId = $db->insert('heritage_skills', [
                'skill_no' => $skillNo,
                'name' => $data['name'],
                'category' => $data['category'],
                'level' => $data['level'],
                'origin_place' => $data['origin_place'] ?? '',
                'heritor_id' => $data['heritor_id'] ?? null,
                'description' => $data['description'] ?? '',
                'historical_origin' => $data['historical_origin'] ?? '',
                'technical_features' => $data['technical_features'] ?? '',
                'material_requirements' => $data['material_requirements'] ?? '',
                'tools_used' => $data['tools_used'] ?? '',
                'status' => $data['status'] ?? 1,
                'entry_user_id' => $user['id'],
            ]);

            if (!empty($data['processes']) && is_array($data['processes'])) {
                foreach ($data['processes'] as $index => $process) {
                    $processNo = 'PRC' . date('YmdHis') . ($index + 1);
                    $db->insert('skill_processes', [
                        'skill_id' => $skillId,
                        'process_no' => $processNo,
                        'step_number' => $process['step_number'] ?? ($index + 1),
                        'name' => $process['name'] ?? '',
                        'description' => $process['description'] ?? '',
                        'operation_points' => $process['operation_points'] ?? '',
                        'quality_standard' => $process['quality_standard'] ?? '',
                        'duration_minutes' => $process['duration_minutes'] ?? null,
                        'difficulty_level' => $process['difficulty_level'] ?? 3,
                        'is_key_process' => $process['is_key_process'] ?? 0,
                    ]);
                }
            }

            $db->commit();

            logWrite('info', '创建技艺信息成功', [
                'skill_id' => $skillId,
                'skill_no' => $skillNo,
                'user_id' => $user['id'],
            ]);

            return success([
                'id' => $skillId,
                'skill_no' => $skillNo,
            ], '技艺信息创建成功');
        } catch (\Exception $e) {
            $db->rollback();
            logWrite('error', '创建技艺信息失败', ['error' => $e->getMessage()]);
            return error('创建失败: ' . $e->getMessage());
        }
    }

    public static function update(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'skill:update')) {
            return error('权限不足', 403);
        }

        if (empty($data['id'])) {
            return error('技艺ID不能为空');
        }

        $db = Database::getInstance();
        $skill = $db->fetchOne("SELECT * FROM heritage_skills WHERE id = ?", [$data['id']]);
        if (!$skill) {
            return error('技艺信息不存在');
        }

        try {
            $updateData = array_filter([
                'name' => $data['name'] ?? null,
                'category' => $data['category'] ?? null,
                'level' => $data['level'] ?? null,
                'origin_place' => $data['origin_place'] ?? null,
                'heritor_id' => $data['heritor_id'] ?? null,
                'description' => $data['description'] ?? null,
                'historical_origin' => $data['historical_origin'] ?? null,
                'technical_features' => $data['technical_features'] ?? null,
                'material_requirements' => $data['material_requirements'] ?? null,
                'tools_used' => $data['tools_used'] ?? null,
            ], fn($v) => $v !== null);

            if (!empty($updateData)) {
                $db->update('heritage_skills', $updateData, 'id = ?', [$data['id']]);
            }

            logWrite('info', '更新技艺信息成功', [
                'skill_id' => $data['id'],
                'user_id' => $user['id'],
            ]);

            return success(['id' => $data['id']], '技艺信息更新成功');
        } catch (\Exception $e) {
            logWrite('error', '更新技艺信息失败', ['error' => $e->getMessage()]);
            return error('更新失败: ' . $e->getMessage());
        }
    }

    public static function getList(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'skill:view')) {
            return error('权限不足', 403);
        }

        $db = Database::getInstance();
        $page = max(1, intval($data['page'] ?? 1));
        $pageSize = min(100, max(10, intval($data['page_size'] ?? 20)));
        $offset = ($page - 1) * $pageSize;

        $where = [];
        $params = [];

        if (!empty($data['keyword'])) {
            $where[] = '(name LIKE ? OR skill_no LIKE ?)';
            $params[] = '%' . $data['keyword'] . '%';
            $params[] = '%' . $data['keyword'] . '%';
        }

        if (!empty($data['category'])) {
            $where[] = 'category = ?';
            $params[] = $data['category'];
        }

        if (isset($data['level']) && $data['level'] !== '') {
            $where[] = 'level = ?';
            $params[] = $data['level'];
        }

        if (isset($data['status']) && $data['status'] !== '') {
            $where[] = 'status = ?';
            $params[] = $data['status'];
        }

        $whereClause = !empty($where) ? implode(' AND ', $where) : '1=1';

        $total = $db->fetchColumn("SELECT COUNT(*) FROM heritage_skills WHERE {$whereClause}", $params);
        $list = $db->fetchAll("
            SELECT s.*, h.name as heritor_name, u.real_name as entry_user_name
            FROM heritage_skills s 
            LEFT JOIN heritors h ON s.heritor_id = h.id 
            LEFT JOIN system_users u ON s.entry_user_id = u.id 
            WHERE {$whereClause}
            ORDER BY s.id DESC 
            LIMIT {$offset}, {$pageSize}
        ", $params);

        $levelMap = [1 => '国家级', 2 => '省级', 3 => '市级', 4 => '县级'];
        $statusMap = [0 => '草稿', 1 => '待审核', 2 => '已通过', 3 => '已驳回'];

        foreach ($list as &$item) {
            $item['level_text'] = $levelMap[$item['level']] ?? '未知';
            $item['status_text'] = $statusMap[$item['status']] ?? '未知';
        }

        return success(paginate($page, $pageSize, $total, $list));
    }

    public static function getDetail(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'skill:view')) {
            return error('权限不足', 403);
        }

        if (empty($data['id']) && empty($data['skill_no'])) {
            return error('技艺ID或编号不能为空');
        }

        $db = Database::getInstance();

        if (!empty($data['id'])) {
            $skill = $db->fetchOne("
                SELECT s.*, h.name as heritor_name, u.real_name as entry_user_name
                FROM heritage_skills s 
                LEFT JOIN heritors h ON s.heritor_id = h.id 
                LEFT JOIN system_users u ON s.entry_user_id = u.id 
                WHERE s.id = ?
            ", [$data['id']]);
        } else {
            $skill = $db->fetchOne("
                SELECT s.*, h.name as heritor_name, u.real_name as entry_user_name
                FROM heritage_skills s 
                LEFT JOIN heritors h ON s.heritor_id = h.id 
                LEFT JOIN system_users u ON s.entry_user_id = u.id 
                WHERE s.skill_no = ?
            ", [$data['skill_no']]);
        }

        if (!$skill) {
            return error('技艺信息不存在');
        }

        $processes = $db->fetchAll("
            SELECT * FROM skill_processes WHERE skill_id = ? ORDER BY step_number ASC
        ", [$skill['id']]);

        $scores = $db->fetchAll("
            SELECT * FROM process_scores WHERE skill_id = ? ORDER BY id ASC
        ", [$skill['id']]);

        $levelMap = [1 => '国家级', 2 => '省级', 3 => '市级', 4 => '县级'];
        $statusMap = [0 => '草稿', 1 => '待审核', 2 => '已通过', 3 => '已驳回'];
        $skill['level_text'] = $levelMap[$skill['level']] ?? '未知';
        $skill['status_text'] = $statusMap[$skill['status']] ?? '未知';

        return success([
            'skill' => $skill,
            'processes' => $processes,
            'scores' => $scores,
        ]);
    }

    public static function audit(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'skill:audit')) {
            return error('权限不足', 403);
        }

        if (empty($data['id'])) {
            return error('技艺ID不能为空');
        }
        if (!in_array($data['status'] ?? null, [2, 3])) {
            return error('审核状态不正确');
        }

        $db = Database::getInstance();
        $skill = $db->fetchOne("SELECT * FROM heritage_skills WHERE id = ?", [$data['id']]);
        if (!$skill) {
            return error('技艺信息不存在');
        }

        try {
            $db->update('heritage_skills', [
                'status' => $data['status'],
                'audit_user_id' => $user['id'],
                'audit_time' => date('Y-m-d H:i:s'),
                'audit_remark' => $data['audit_remark'] ?? '',
            ], 'id = ?', [$data['id']]);

            logWrite('info', '技艺审核完成', [
                'skill_id' => $data['id'],
                'status' => $data['status'],
                'user_id' => $user['id'],
            ]);

            return success(null, $data['status'] == 2 ? '审核通过' : '审核驳回');
        } catch (\Exception $e) {
            logWrite('error', '技艺审核失败', ['error' => $e->getMessage()]);
            return error('审核失败: ' . $e->getMessage());
        }
    }

    public static function createProcess(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'process:create')) {
            return error('权限不足', 403);
        }

        $requiredError = validateRequired($data, ['skill_id', 'name', 'step_number']);
        if ($requiredError) {
            return error($requiredError);
        }

        $db = Database::getInstance();
        $skill = $db->fetchOne("SELECT id FROM heritage_skills WHERE id = ?", [$data['skill_id']]);
        if (!$skill) {
            return error('技艺信息不存在');
        }

        $processNo = 'PRC' . date('YmdHis') . rand(1000, 9999);

        $processId = $db->insert('skill_processes', [
            'skill_id' => $data['skill_id'],
            'process_no' => $processNo,
            'step_number' => $data['step_number'],
            'name' => $data['name'],
            'description' => $data['description'] ?? '',
            'operation_points' => $data['operation_points'] ?? '',
            'quality_standard' => $data['quality_standard'] ?? '',
            'duration_minutes' => $data['duration_minutes'] ?? null,
            'difficulty_level' => $data['difficulty_level'] ?? 3,
            'is_key_process' => $data['is_key_process'] ?? 0,
        ]);

        return success([
            'id' => $processId,
            'process_no' => $processNo,
        ], '工序创建成功');
    }

    public static function updateProcess(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'process:update')) {
            return error('权限不足', 403);
        }

        if (empty($data['id'])) {
            return error('工序ID不能为空');
        }

        $db = Database::getInstance();
        $process = $db->fetchOne("SELECT id FROM skill_processes WHERE id = ?", [$data['id']]);
        if (!$process) {
            return error('工序信息不存在');
        }

        $updateData = array_filter([
            'step_number' => $data['step_number'] ?? null,
            'name' => $data['name'] ?? null,
            'description' => $data['description'] ?? null,
            'operation_points' => $data['operation_points'] ?? null,
            'quality_standard' => $data['quality_standard'] ?? null,
            'duration_minutes' => $data['duration_minutes'] ?? null,
            'difficulty_level' => $data['difficulty_level'] ?? null,
            'is_key_process' => isset($data['is_key_process']) ? $data['is_key_process'] : null,
        ], fn($v) => $v !== null);

        if (!empty($updateData)) {
            $db->update('skill_processes', $updateData, 'id = ?', [$data['id']]);
        }

        return success(['id' => $data['id']], '工序更新成功');
    }

    public static function getProcessList(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'process:view')) {
            return error('权限不足', 403);
        }

        if (empty($data['skill_id'])) {
            return error('技艺ID不能为空');
        }

        $db = Database::getInstance();
        $list = $db->fetchAll("
            SELECT * FROM skill_processes WHERE skill_id = ? ORDER BY step_number ASC
        ", [$data['skill_id']]);

        return success($list);
    }

    public static function delete(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'skill:delete')) {
            return error('权限不足', 403);
        }

        if (empty($data['id'])) {
            return error('技艺ID不能为空');
        }

        $db = Database::getInstance();
        $skill = $db->fetchOne("SELECT id FROM heritage_skills WHERE id = ?", [$data['id']]);
        if (!$skill) {
            return error('技艺信息不存在');
        }

        try {
            $db->beginTransaction();
            $db->delete('skill_processes', 'skill_id = ?', [$data['id']]);
            $db->delete('process_scores', 'skill_id = ?', [$data['id']]);
            $db->delete('heritage_skills', 'id = ?', [$data['id']]);
            $db->commit();

            logWrite('info', '删除技艺信息成功', ['skill_id' => $data['id'], 'user_id' => $user['id']]);
            return success(null, '删除成功');
        } catch (\Exception $e) {
            $db->rollback();
            logWrite('error', '删除技艺信息失败', ['error' => $e->getMessage()]);
            return error('删除失败: ' . $e->getMessage());
        }
    }
}

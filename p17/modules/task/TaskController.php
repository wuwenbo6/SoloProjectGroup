<?php
namespace Modules\task;

use Swoole\Http\Request;
use Core\Database;
use Core\TaskScheduler;
use Middleware\AuthMiddleware;

class TaskController
{
    public static function createTask(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'task:manage')) {
            return error('权限不足', 403);
        }

        if (empty($data['task_name']) || empty($data['task_code']) || empty($data['task_handler'])) {
            return error('任务名称、代码、处理器不能为空');
        }

        $db = Database::getInstance();

        $exists = $db->fetchColumn("SELECT COUNT(*) FROM scheduled_tasks WHERE task_code = ?", [$data['task_code']]);
        if ($exists) {
            return error('任务代码已存在');
        }

        $nextRunTime = null;
        if ($data['task_type'] === 'interval' && !empty($data['interval_seconds'])) {
            $nextRunTime = date('Y-m-d H:i:s', time() + $data['interval_seconds']);
        } elseif ($data['task_type'] === 'cron' && !empty($data['cron_expression'])) {
            $nextRunTime = date('Y-m-d H:i:s', time() + 60);
        }

        $id = $db->insert('scheduled_tasks', [
            'task_name' => $data['task_name'],
            'task_code' => $data['task_code'],
            'task_type' => $data['task_type'] ?? 'interval',
            'cron_expression' => $data['cron_expression'] ?? null,
            'interval_seconds' => $data['interval_seconds'] ?? 3600,
            'task_handler' => $data['task_handler'],
            'task_params' => !empty($data['task_params']) ? json_encode($data['task_params']) : null,
            'status' => $data['status'] ?? 1,
            'next_run_time' => $nextRunTime,
            'timeout_seconds' => $data['timeout_seconds'] ?? 300,
            'max_retry' => $data['max_retry'] ?? 3,
            'created_by' => $user['real_name'] ?? $user['username'],
        ]);

        return success(['id' => $id, 'task_code' => $data['task_code']], '任务创建成功');
    }

    public static function updateTask(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'task:manage')) {
            return error('权限不足', 403);
        }

        if (empty($data['id'])) {
            return error('任务ID不能为空');
        }

        $db = Database::getInstance();
        $task = $db->fetchOne("SELECT * FROM scheduled_tasks WHERE id = ?", [$data['id']]);
        if (!$task) {
            return error('任务不存在');
        }

        $updateFields = [];
        $updateParams = [];

        $fieldMap = [
            'task_name' => 'task_name',
            'task_type' => 'task_type',
            'cron_expression' => 'cron_expression',
            'interval_seconds' => 'interval_seconds',
            'task_handler' => 'task_handler',
            'task_params' => function ($v) { return json_encode($v); },
            'status' => 'status',
            'timeout_seconds' => 'timeout_seconds',
            'max_retry' => 'max_retry',
        ];

        foreach ($fieldMap as $inputKey => $dbField) {
            if (isset($data[$inputKey])) {
                if (is_callable($dbField)) {
                    $updateFields[] = "{$inputKey} = ?";
                    $updateParams[] = $dbField($data[$inputKey]);
                } else {
                    $updateFields[] = "{$dbField} = ?";
                    $updateParams[] = $data[$inputKey];
                }
            }
        }

        if (!empty($updateFields)) {
            $updateParams[] = $data['id'];
            $db->query("UPDATE scheduled_tasks SET " . implode(', ', $updateFields) . " WHERE id = ?", $updateParams);
        }

        return success(['id' => $data['id']], '任务更新成功');
    }

    public static function getTaskList(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'task:view')) {
            return error('权限不足', 403);
        }

        $db = Database::getInstance();
        $page = max(1, intval($data['page'] ?? 1));
        $pageSize = min(100, max(10, intval($data['page_size'] ?? 20)));
        $offset = ($page - 1) * $pageSize;

        $where = ['1=1'];
        $params = [];

        if (!empty($data['task_code'])) {
            $where[] = 'task_code = ?';
            $params[] = $data['task_code'];
        }
        if (!empty($data['task_type'])) {
            $where[] = 'task_type = ?';
            $params[] = $data['task_type'];
        }
        if (isset($data['status']) && $data['status'] !== '') {
            $where[] = 'status = ?';
            $params[] = $data['status'];
        }

        $whereClause = implode(' AND ', $where);

        $total = $db->fetchColumn("SELECT COUNT(*) FROM scheduled_tasks WHERE {$whereClause}", $params);

        $list = $db->fetchAll("
            SELECT * FROM scheduled_tasks 
            WHERE {$whereClause}
            ORDER BY id DESC
            LIMIT {$offset}, {$pageSize}
        ", $params);

        $scheduler = TaskScheduler::getInstance();
        foreach ($list as &$item) {
            $item['is_running'] = $scheduler->isTaskRunning($item['id']);
            if (!empty($item['last_run_result'])) {
                $item['last_run_result'] = json_decode($item['last_run_result'], true);
            }
            if (!empty($item['task_params'])) {
                $item['task_params'] = json_decode($item['task_params'], true);
            }
        }

        return success(paginate($page, $pageSize, $total, $list));
    }

    public static function getTaskDetail(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'task:view')) {
            return error('权限不足', 403);
        }

        if (empty($data['id']) && empty($data['task_code'])) {
            return error('任务ID或代码不能为空');
        }

        $db = Database::getInstance();
        if (!empty($data['id'])) {
            $task = $db->fetchOne("SELECT * FROM scheduled_tasks WHERE id = ?", [$data['id']]);
        } else {
            $task = $db->fetchOne("SELECT * FROM scheduled_tasks WHERE task_code = ?", [$data['task_code']]);
        }

        if (!$task) {
            return error('任务不存在');
        }

        if (!empty($task['last_run_result'])) {
            $task['last_run_result'] = json_decode($task['last_run_result'], true);
        }
        if (!empty($task['task_params'])) {
            $task['task_params'] = json_decode($task['task_params'], true);
        }

        $scheduler = TaskScheduler::getInstance();
        $task['is_running'] = $scheduler->isTaskRunning($task['id']);

        return success($task);
    }

    public static function runTask(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'task:execute')) {
            return error('权限不足', 403);
        }

        if (empty($data['task_code'])) {
            return error('任务代码不能为空');
        }

        $scheduler = TaskScheduler::getInstance();
        $result = $scheduler->runTaskImmediately($data['task_code']);

        return success($result, $result['message']);
    }

    public static function deleteTask(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'task:manage')) {
            return error('权限不足', 403);
        }

        if (empty($data['ids']) || !is_array($data['ids'])) {
            return error('请选择要删除的任务');
        }

        $db = Database::getInstance();
        $deletedCount = 0;

        foreach ($data['ids'] as $id) {
            $db->query("DELETE FROM scheduled_tasks WHERE id = ?", [$id]);
            $deletedCount++;
        }

        return success(['deleted_count' => $deletedCount], '删除成功');
    }

    public static function toggleTaskStatus(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'task:manage')) {
            return error('权限不足', 403);
        }

        if (empty($data['id'])) {
            return error('任务ID不能为空');
        }

        $db = Database::getInstance();
        $task = $db->fetchOne("SELECT * FROM scheduled_tasks WHERE id = ?", [$data['id']]);
        if (!$task) {
            return error('任务不存在');
        }

        $newStatus = $task['status'] == 1 ? 0 : 1;
        $db->query("UPDATE scheduled_tasks SET status = ? WHERE id = ?", [$newStatus, $data['id']]);

        return success(['id' => $data['id'], 'status' => $newStatus], '状态更新成功');
    }

    public static function getRunningTasks(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'task:view')) {
            return error('权限不足', 403);
        }

        $scheduler = TaskScheduler::getInstance();
        $runningTaskIds = $scheduler->getRunningTasks();

        return success([
            'running_count' => count($runningTaskIds),
            'running_task_ids' => $runningTaskIds,
        ]);
    }
}
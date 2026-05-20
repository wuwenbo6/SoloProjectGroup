<?php
namespace Modules\audit;

use Swoole\Http\Request;
use Core\Database;
use Middleware\AuthMiddleware;

class AuditController
{
    public static function getLogList(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'audit:view')) {
            return error('权限不足', 403);
        }

        $db = Database::getInstance();
        $page = max(1, intval($data['page'] ?? 1));
        $pageSize = min(500, max(10, intval($data['page_size'] ?? 50)));
        $offset = ($page - 1) * $pageSize;

        $where = ['1=1'];
        $params = [];

        if (!empty($data['trace_id'])) {
            $where[] = 'trace_id = ?';
            $params[] = $data['trace_id'];
        }
        if (!empty($data['user_id'])) {
            $where[] = 'user_id = ?';
            $params[] = $data['user_id'];
        }
        if (!empty($data['module'])) {
            $where[] = 'module = ?';
            $params[] = $data['module'];
        }
        if (!empty($data['operation'])) {
            $where[] = 'operation = ?';
            $params[] = $data['operation'];
        }
        if (!empty($data['platform_code'])) {
            $where[] = 'platform_code = ?';
            $params[] = $data['platform_code'];
        }
        if (isset($data['status']) && $data['status'] !== '') {
            $where[] = 'status = ?';
            $params[] = $data['status'];
        }
        if (!empty($data['start_date'])) {
            $where[] = 'DATE(created_at) >= ?';
            $params[] = $data['start_date'];
        }
        if (!empty($data['end_date'])) {
            $where[] = 'DATE(created_at) <= ?';
            $params[] = $data['end_date'];
        }
        if (!empty($data['keyword'])) {
            $where[] = '(user_name LIKE ? OR operation_desc LIKE ? OR request_path LIKE ?)';
            $keyword = '%' . $data['keyword'] . '%';
            $params[] = $keyword;
            $params[] = $keyword;
            $params[] = $keyword;
        }

        $whereClause = implode(' AND ', $where);

        $total = $db->fetchColumn("SELECT COUNT(*) FROM audit_logs WHERE {$whereClause}", $params);

        $list = $db->fetchAll("
            SELECT id, trace_id, span_id, user_id, user_name, user_ip,
                   request_method, request_path, module, operation, operation_desc,
                   resource_type, resource_id, platform_code, sync_direction,
                   response_status, response_time, status, created_at
            FROM audit_logs 
            WHERE {$whereClause}
            ORDER BY id DESC
            LIMIT {$offset}, {$pageSize}
        ", $params);

        return success(paginate($page, $pageSize, $total, $list));
    }

    public static function getLogDetail(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'audit:view')) {
            return error('权限不足', 403);
        }

        if (empty($data['id'])) {
            return error('日志ID不能为空');
        }

        $db = Database::getInstance();
        $log = $db->fetchOne("SELECT * FROM audit_logs WHERE id = ?", [$data['id']]);

        if (!$log) {
            return error('日志不存在');
        }

        if (!empty($log['request_headers'])) {
            $log['request_headers'] = json_decode($log['request_headers'], true);
        }
        if (!empty($log['request_params'])) {
            $log['request_params'] = json_decode($log['request_params'], true);
        }

        return success($log);
    }

    public static function getTraceDetail(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'audit:view')) {
            return error('权限不足', 403);
        }

        if (empty($data['trace_id'])) {
            return error('链路追踪ID不能为空');
        }

        $db = Database::getInstance();
        $logs = $db->fetchAll("
            SELECT id, trace_id, span_id, parent_span_id, user_id, user_name,
                   request_method, request_path, module, operation, operation_desc,
                   response_time, status, created_at
            FROM audit_logs 
            WHERE trace_id = ?
            ORDER BY id ASC
        ", [$data['trace_id']]);

        $tree = self::buildSpanTree($logs);

        return success([
            'trace_id' => $data['trace_id'],
            'total_spans' => count($logs),
            'span_tree' => $tree,
            'raw_list' => $logs,
        ]);
    }

    private static function buildSpanTree(array $spans): array
    {
        $map = [];
        $tree = [];

        foreach ($spans as $span) {
            $span['children'] = [];
            $map[$span['span_id']] = $span;
        }

        foreach ($spans as $span) {
            if (!empty($span['parent_span_id']) && isset($map[$span['parent_span_id']])) {
                $map[$span['parent_span_id']]['children'][] = &$map[$span['span_id']];
            } else {
                $tree[] = &$map[$span['span_id']];
            }
        }

        return $tree;
    }

    public static function getStats(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'audit:view')) {
            return error('权限不足', 403);
        }

        $db = Database::getInstance();

        $startDate = $data['start_date'] ?? date('Y-m-d', strtotime('-7 days'));
        $endDate = $data['end_date'] ?? date('Y-m-d');

        $totalCount = $db->fetchColumn("
            SELECT COUNT(*) 
            FROM audit_logs 
            WHERE DATE(created_at) BETWEEN ? AND ?
        ", [$startDate, $endDate]);

        $successCount = $db->fetchColumn("
            SELECT COUNT(*) 
            FROM audit_logs 
            WHERE status = 1 AND DATE(created_at) BETWEEN ? AND ?
        ", [$startDate, $endDate]);

        $failCount = $totalCount - $successCount;

        $avgResponseTime = $db->fetchColumn("
            SELECT AVG(response_time) 
            FROM audit_logs 
            WHERE response_time IS NOT NULL 
            AND DATE(created_at) BETWEEN ? AND ?
        ", [$startDate, $endDate]);

        $moduleStats = $db->fetchAll("
            SELECT module, COUNT(*) as count,
                   SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as success_count,
                   SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) as fail_count,
                   AVG(response_time) as avg_response_time
            FROM audit_logs 
            WHERE DATE(created_at) BETWEEN ? AND ?
            GROUP BY module
            ORDER BY count DESC
        ", [$startDate, $endDate]);

        $userStats = $db->fetchAll("
            SELECT user_id, user_name, COUNT(*) as operation_count
            FROM audit_logs 
            WHERE DATE(created_at) BETWEEN ? AND ?
            AND user_id IS NOT NULL
            GROUP BY user_id, user_name
            ORDER BY operation_count DESC
            LIMIT 10
        ", [$startDate, $endDate]);

        $dailyStats = $db->fetchAll("
            SELECT DATE(created_at) as date,
                   COUNT(*) as total_count,
                   SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as success_count,
                   SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) as fail_count
            FROM audit_logs 
            WHERE DATE(created_at) BETWEEN ? AND ?
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        ", [$startDate, $endDate]);

        return success([
            'period' => ['start' => $startDate, 'end' => $endDate],
            'total_count' => $totalCount,
            'success_count' => $successCount,
            'fail_count' => $failCount,
            'success_rate' => $totalCount > 0 ? round($successCount / $totalCount * 100, 2) : 100,
            'avg_response_time_ms' => round($avgResponseTime, 2),
            'module_stats' => $moduleStats,
            'user_stats' => $userStats,
            'daily_stats' => $dailyStats,
        ]);
    }

    public static function getModuleList(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }

        $db = Database::getInstance();
        $modules = $db->fetchAll("
            SELECT DISTINCT module as name, COUNT(*) as count
            FROM audit_logs 
            WHERE module IS NOT NULL AND module != ''
            GROUP BY module
            ORDER BY count DESC
        ");

        return success($modules);
    }

    public static function getOperationList(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }

        $db = Database::getInstance();
        $module = $data['module'] ?? null;

        $where = $module ? "WHERE module = ?" : "WHERE module IS NOT NULL";
        $params = $module ? [$module] : [];

        $operations = $db->fetchAll("
            SELECT DISTINCT operation as name, COUNT(*) as count
            FROM audit_logs 
            {$where}
            AND operation IS NOT NULL AND operation != ''
            GROUP BY operation
            ORDER BY count DESC
        ", $params);

        return success($operations);
    }

    public static function exportLogs(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'audit:export')) {
            return error('权限不足', 403);
        }

        $db = Database::getInstance();

        $where = ['1=1'];
        $params = [];

        if (!empty($data['start_date'])) {
            $where[] = 'DATE(created_at) >= ?';
            $params[] = $data['start_date'];
        }
        if (!empty($data['end_date'])) {
            $where[] = 'DATE(created_at) <= ?';
            $params[] = $data['end_date'];
        }
        if (!empty($data['module'])) {
            $where[] = 'module = ?';
            $params[] = $data['module'];
        }

        $whereClause = implode(' AND ', $where);

        $logs = $db->fetchAll("
            SELECT id, trace_id, user_id, user_name, user_ip,
                   request_method, request_url, module, operation, operation_desc,
                   resource_type, resource_id, response_status, response_time,
                   status, error_message, created_at
            FROM audit_logs 
            WHERE {$whereClause}
            ORDER BY id DESC
            LIMIT 10000
        ", $params);

        $csvContent = "ID,追踪ID,用户ID,用户名,IP地址,请求方法,请求URL,模块,操作,操作描述,资源类型,资源ID,响应状态,响应时间(ms),状态,错误信息,创建时间\n";

        foreach ($logs as $log) {
            $row = [
                $log['id'],
                $log['trace_id'],
                $log['user_id'],
                '"' . str_replace('"', '""', $log['user_name'] ?? '') . '"',
                $log['user_ip'],
                $log['request_method'],
                '"' . str_replace('"', '""', $log['request_url'] ?? '') . '"',
                $log['module'],
                $log['operation'],
                '"' . str_replace('"', '""', $log['operation_desc'] ?? '') . '"',
                $log['resource_type'],
                $log['resource_id'],
                $log['response_status'],
                $log['response_time'],
                $log['status'] ? '成功' : '失败',
                '"' . str_replace('"', '""', $log['error_message'] ?? '') . '"',
                $log['created_at'],
            ];
            $csvContent .= implode(',', $row) . "\n";
        }

        $filename = 'audit_logs_' . date('YmdHis') . '.csv';

        return success([
            'filename' => $filename,
            'total_rows' => count($logs),
            'content_base64' => base64_encode($csvContent),
        ], '导出成功');
    }
}
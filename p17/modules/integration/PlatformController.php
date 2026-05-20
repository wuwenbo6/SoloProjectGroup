<?php
namespace Modules\integration;

use Swoole\Http\Request;
use Core\Database;
use Middleware\AuthMiddleware;

class PlatformController
{
    public static function createPlatform(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'platform:manage')) {
            return error('权限不足', 403);
        }

        $requiredFields = ['platform_code', 'platform_name', 'api_endpoint'];
        foreach ($requiredFields as $field) {
            if (empty($data[$field])) {
                return error("{$field}不能为空");
            }
        }

        $db = Database::getInstance();

        $exists = $db->fetchColumn("SELECT COUNT(*) FROM remote_platforms WHERE platform_code = ?", [$data['platform_code']]);
        if ($exists) {
            return error('平台代码已存在');
        }

        $id = $db->insert('remote_platforms', [
            'platform_code' => $data['platform_code'],
            'platform_name' => $data['platform_name'],
            'region_code' => $data['region_code'] ?? null,
            'region_name' => $data['region_name'] ?? null,
            'api_endpoint' => $data['api_endpoint'],
            'auth_type' => $data['auth_type'] ?? 'token',
            'app_key' => $data['app_key'] ?? null,
            'app_secret' => $data['app_secret'] ?? null,
            'sync_direction' => $data['sync_direction'] ?? 'both',
            'sync_skills' => $data['sync_skills'] ?? 1,
            'sync_heritors' => $data['sync_heritors'] ?? 1,
            'sync_standards' => $data['sync_standards'] ?? 0,
            'sync_interval_minutes' => $data['sync_interval_minutes'] ?? 60,
            'status' => $data['status'] ?? 1,
            'remark' => $data['remark'] ?? null,
        ]);

        return success(['id' => $id, 'platform_code' => $data['platform_code']], '平台配置创建成功');
    }

    public static function updatePlatform(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'platform:manage')) {
            return error('权限不足', 403);
        }

        if (empty($data['id']) && empty($data['platform_code'])) {
            return error('平台ID或代码不能为空');
        }

        $db = Database::getInstance();

        $updateFields = [
            'platform_name', 'region_code', 'region_name', 'api_endpoint',
            'auth_type', 'app_key', 'app_secret', 'sync_direction',
            'sync_skills', 'sync_heritors', 'sync_standards',
            'sync_interval_minutes', 'status', 'remark',
        ];

        $updates = [];
        $params = [];

        foreach ($updateFields as $field) {
            if (isset($data[$field])) {
                $updates[] = "{$field} = ?";
                $params[] = $data[$field];
            }
        }

        if (empty($updates)) {
            return error('没有需要更新的字段');
        }

        if (!empty($data['id'])) {
            $params[] = $data['id'];
            $db->query("UPDATE remote_platforms SET " . implode(', ', $updates) . " WHERE id = ?", $params);
        } else {
            $params[] = $data['platform_code'];
            $db->query("UPDATE remote_platforms SET " . implode(', ', $updates) . " WHERE platform_code = ?", $params);
        }

        return success(['updated' => true], '平台配置更新成功');
    }

    public static function getPlatformList(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'platform:view')) {
            return error('权限不足', 403);
        }

        $db = Database::getInstance();
        $page = max(1, intval($data['page'] ?? 1));
        $pageSize = min(100, max(10, intval($data['page_size'] ?? 20)));
        $offset = ($page - 1) * $pageSize;

        $where = ['1=1'];
        $params = [];

        if (!empty($data['platform_code'])) {
            $where[] = 'platform_code = ?';
            $params[] = $data['platform_code'];
        }
        if (!empty($data['region_code'])) {
            $where[] = 'region_code = ?';
            $params[] = $data['region_code'];
        }
        if (isset($data['status']) && $data['status'] !== '') {
            $where[] = 'status = ?';
            $params[] = $data['status'];
        }

        $whereClause = implode(' AND ', $where);

        $total = $db->fetchColumn("SELECT COUNT(*) FROM remote_platforms WHERE {$whereClause}", $params);

        $list = $db->fetchAll("
            SELECT * FROM remote_platforms 
            WHERE {$whereClause}
            ORDER BY id DESC
            LIMIT {$offset}, {$pageSize}
        ", $params);

        foreach ($list as &$item) {
            unset($item['app_secret']);
            unset($item['access_token']);
        }

        return success(paginate($page, $pageSize, $total, $list));
    }

    public static function getPlatformDetail(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'platform:view')) {
            return error('权限不足', 403);
        }

        if (empty($data['id']) && empty($data['platform_code'])) {
            return error('平台ID或代码不能为空');
        }

        $db = Database::getInstance();
        if (!empty($data['id'])) {
            $platform = $db->fetchOne("SELECT * FROM remote_platforms WHERE id = ?", [$data['id']]);
        } else {
            $platform = $db->fetchOne("SELECT * FROM remote_platforms WHERE platform_code = ?", [$data['platform_code']]);
        }

        if (!$platform) {
            return error('平台配置不存在');
        }

        $platform['token_expired'] = empty($platform['access_token']) ||
            (strtotime($platform['token_expires_at']) - time() < 300);

        return success($platform);
    }

    public static function testConnection(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'platform:manage')) {
            return error('权限不足', 403);
        }

        if (empty($data['platform_code'])) {
            return error('平台代码不能为空');
        }

        try {
            $adapter = new RemotePlatformAdapter($data['platform_code']);
            $result = $adapter->testConnection();
            return success($result, $result['message']);
        } catch (\Exception $e) {
            return error('连接测试失败: ' . $e->getMessage());
        }
    }

    public static function refreshToken(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'platform:manage')) {
            return error('权限不足', 403);
        }

        if (empty($data['platform_code'])) {
            return error('平台代码不能为空');
        }

        try {
            $adapter = new RemotePlatformAdapter($data['platform_code']);
            $result = $adapter->refreshAccessToken();
            return success($result, $result['success'] ? '令牌刷新成功' : '令牌刷新失败');
        } catch (\Exception $e) {
            return error('令牌刷新失败: ' . $e->getMessage());
        }
    }

    public static function pullData(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'platform:sync')) {
            return error('权限不足', 403);
        }

        if (empty($data['platform_code'])) {
            return error('平台代码不能为空');
        }

        $dataType = $data['data_type'] ?? 'skills';

        try {
            $adapter = new RemotePlatformAdapter($data['platform_code']);

            if ($dataType === 'skills') {
                $result = $adapter->pullSkills($data['params'] ?? []);
            } elseif ($dataType === 'heritors') {
                $result = $adapter->pullHeritors($data['params'] ?? []);
            } else {
                return error('不支持的数据类型');
            }

            return success($result, $result['success'] ? '数据拉取成功' : '数据拉取失败');
        } catch (\Exception $e) {
            return error('数据拉取失败: ' . $e->getMessage());
        }
    }

    public static function pushData(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'platform:sync')) {
            return error('权限不足', 403);
        }

        if (empty($data['platform_code'])) {
            return error('平台代码不能为空');
        }

        $dataType = $data['data_type'] ?? 'skills';

        try {
            $adapter = new RemotePlatformAdapter($data['platform_code']);

            if ($dataType === 'skill') {
                if (empty($data['skill_data'])) {
                    return error('技艺数据不能为空');
                }
                $result = $adapter->pushSkill($data['skill_data']);
            } elseif ($dataType === 'heritor') {
                if (empty($data['heritor_data'])) {
                    return error('传承人数据不能为空');
                }
                $result = $adapter->pushHeritor($data['heritor_data']);
            } else {
                return error('不支持的数据类型');
            }

            return success($result, $result['success'] ? '数据推送成功' : '数据推送失败');
        } catch (\Exception $e) {
            return error('数据推送失败: ' . $e->getMessage());
        }
    }

    public static function deletePlatform(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'platform:manage')) {
            return error('权限不足', 403);
        }

        if (empty($data['ids']) || !is_array($data['ids'])) {
            return error('请选择要删除的平台');
        }

        $db = Database::getInstance();
        $deletedCount = 0;

        foreach ($data['ids'] as $id) {
            $db->query("DELETE FROM remote_platforms WHERE id = ?", [$id]);
            $deletedCount++;
        }

        return success(['deleted_count' => $deletedCount], '删除成功');
    }

    public static function getSyncStats(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'platform:view')) {
            return error('权限不足', 403);
        }

        $db = Database::getInstance();

        $stats = $db->fetchAll("
            SELECT platform_code, platform_name,
                   sync_skills, sync_heritors, sync_standards,
                   last_sync_time, sync_interval_minutes,
                   status
            FROM remote_platforms
            ORDER BY id
        ");

        return success($stats);
    }
}
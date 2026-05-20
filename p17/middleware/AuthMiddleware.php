<?php
namespace Middleware;

use Swoole\Http\Request;
use Utils\Jwt;
use Core\Database;

class AuthMiddleware
{
    const ROLE_SUPER_ADMIN = 1;
    const ROLE_AUDITOR = 2;
    const ROLE_ENTRY = 3;
    const ROLE_QUERY = 4;

    private static $rolePermissions = [
        self::ROLE_SUPER_ADMIN => ['*'],
        self::ROLE_AUDITOR => ['skill:*', 'process:*', 'archive:*', 'auth:view', 'integration:*', 'video:*', 'pdf:*', 'review:*', 'task:*', 'platform:*', 'audit:*'],
        self::ROLE_ENTRY => ['skill:create', 'skill:update', 'process:create', 'process:score', 'video:upload', 'review:create'],
        self::ROLE_QUERY => ['skill:view', 'process:view', 'archive:view', 'video:view', 'pdf:view', 'audit:view', 'review:view', 'task:view', 'platform:view'],
    ];

    private static $authenticatedUsers = [];

    public static function authenticate(Request $request)
    {
        $requestId = spl_object_hash($request);
        if (isset(self::$authenticatedUsers[$requestId])) {
            return self::$authenticatedUsers[$requestId];
        }

        $authHeader = $request->header['authorization'] ?? '';
        
        if (empty($authHeader)) {
            $result = error('请先登录', 401);
            self::$authenticatedUsers[$requestId] = $result;
            return $result;
        }

        if (strpos($authHeader, 'Bearer ') !== 0) {
            $result = error('认证格式错误', 401);
            self::$authenticatedUsers[$requestId] = $result;
            return $result;
        }

        $token = substr($authHeader, 7);
        $payload = Jwt::decode($token);

        if (!$payload) {
            $result = error('Token无效或已过期', 401);
            self::$authenticatedUsers[$requestId] = $result;
            return $result;
        }

        $db = Database::getInstance();
        $user = $db->fetchOne("SELECT * FROM system_users WHERE id = ? AND status = 1", [$payload['user_id'] ?? 0]);

        if (!$user) {
            $result = error('用户不存在或已被禁用', 401);
            self::$authenticatedUsers[$requestId] = $result;
            return $result;
        }

        self::$authenticatedUsers[$requestId] = $user;
        return $user;
    }

    public static function checkPermission(Request $request, string $permission): bool
    {
        $user = self::authenticate($request);
        
        if (!is_array($user) || !isset($user['id'])) {
            return false;
        }

        $roleId = $user['role_id'] ?? 0;
        
        if (!isset(self::$rolePermissions[$roleId])) {
            return false;
        }

        $permissions = self::$rolePermissions[$roleId];
        
        if (in_array('*', $permissions)) {
            return true;
        }

        foreach ($permissions as $perm) {
            if (str_ends_with($perm, ':*')) {
                $prefix = substr($perm, 0, -2);
                if (str_starts_with($permission, $prefix)) {
                    return true;
                }
            }
            if ($perm === $permission) {
                return true;
            }
        }

        return false;
    }

    public static function getRoleName(int $roleId): string
    {
        $roles = [
            self::ROLE_SUPER_ADMIN => '超级管理员',
            self::ROLE_AUDITOR => '审核人员',
            self::ROLE_ENTRY => '录入人员',
            self::ROLE_QUERY => '查询人员',
        ];
        return $roles[$roleId] ?? '未知角色';
    }

    public static function clearCache(Request $request): void
    {
        $requestId = spl_object_hash($request);
        unset(self::$authenticatedUsers[$requestId]);
    }
}

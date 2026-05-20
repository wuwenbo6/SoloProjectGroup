<?php
namespace Middleware;

use Swoole\Http\Request;
use Core\Database;

class AuditLogger
{
    private static $traceId = null;
    private static $spanStack = [];

    public static function generateTraceId(): string
    {
        if (self::$traceId === null) {
            self::$traceId = sprintf(
                '%04x%04x%04x%04x%04x%04x%04x%04x',
                mt_rand(0, 0xffff),
                mt_rand(0, 0xffff),
                mt_rand(0, 0xffff),
                mt_rand(0, 0x0fff) | 0x4000,
                mt_rand(0, 0x3fff) | 0x8000,
                mt_rand(0, 0xffff),
                mt_rand(0, 0xffff),
                mt_rand(0, 0xffff)
            );
        }
        return self::$traceId;
    }

    public static function generateSpanId(): string
    {
        return sprintf('%016x', mt_rand(0, PHP_INT_MAX));
    }

    public static function startSpan(string $name, string $parentSpanId = null): string
    {
        $spanId = self::generateSpanId();
        self::$spanStack[] = [
            'span_id' => $spanId,
            'parent_span_id' => $parentSpanId,
            'name' => $name,
            'start_time' => microtime(true),
        ];
        return $spanId;
    }

    public static function endSpan(): ?array
    {
        if (empty(self::$spanStack)) {
            return null;
        }
        $span = array_pop(self::$spanStack);
        $span['end_time'] = microtime(true);
        $span['duration_ms'] = round(($span['end_time'] - $span['start_time']) * 1000, 2);
        return $span;
    }

    public static function getCurrentSpanId(): ?string
    {
        if (!empty(self::$spanStack)) {
            return end(self::$spanStack)['span_id'];
        }
        return null;
    }

    public static function getParentSpanId(): ?string
    {
        if (count(self::$spanStack) > 1) {
            return self::$spanStack[count(self::$spanStack) - 2]['span_id'];
        }
        return null;
    }

    public static function logRequest(Request $request, array $context = []): string
    {
        $traceId = $request->header['x-trace-id'] ?? self::generateTraceId();
        self::$traceId = $traceId;

        $db = Database::getInstance();

        $userId = $context['user_id'] ?? null;
        $userName = $context['user_name'] ?? null;

        $requestBody = $request->rawContent();
        if (strlen($requestBody) > 10000) {
            $requestBody = substr($requestBody, 0, 10000) . '...[TRUNCATED]';
        }

        $params = $request->get ?? [];
        if ($request->post ?? []) {
            $params = array_merge($params, $request->post);
        }

        $headers = [];
        foreach ($request->header as $key => $value) {
            if (!in_array(strtolower($key), ['authorization', 'cookie', 'token'])) {
                $headers[$key] = $value;
            }
        }

        $logId = $db->insert('audit_logs', [
            'trace_id' => $traceId,
            'span_id' => self::getCurrentSpanId(),
            'parent_span_id' => self::getParentSpanId(),
            'user_id' => $userId,
            'user_name' => $userName,
            'user_ip' => self::getClientIp($request),
            'user_agent' => $request->header['user-agent'] ?? null,
            'request_method' => $request->server['request_method'],
            'request_url' => $request->server['request_uri'],
            'request_path' => $request->server['request_uri'],
            'request_params' => !empty($params) ? json_encode($params, JSON_UNESCAPED_UNICODE) : null,
            'request_headers' => json_encode($headers, JSON_UNESCAPED_UNICODE),
            'request_body' => $requestBody,
            'module' => $context['module'] ?? self::detectModule($request->server['request_uri']),
            'operation' => $context['operation'] ?? self::detectOperation($request->server['request_uri']),
            'operation_desc' => $context['operation_desc'] ?? null,
            'resource_type' => $context['resource_type'] ?? null,
            'resource_id' => $context['resource_id'] ?? null,
            'platform_code' => $context['platform_code'] ?? null,
            'sync_direction' => $context['sync_direction'] ?? null,
            'status' => 1,
            'created_at' => date('Y-m-d H:i:s'),
        ]);

        return $traceId;
    }

    public static function logResponse(string $traceId, int $httpStatus, $responseData, int $responseTimeMs, ?string $errorMessage = null): void
    {
        $db = Database::getInstance();

        $responseStr = is_array($responseData) ? json_encode($responseData, JSON_UNESCAPED_UNICODE) : (string)$responseData;
        if (strlen($responseStr) > 10000) {
            $responseStr = substr($responseStr, 0, 10000) . '...[TRUNCATED]';
        }

        $db->query("
            UPDATE audit_logs 
            SET response_status = ?,
                response_data = ?,
                response_time = ?,
                error_message = ?,
                status = ?
            WHERE trace_id = ?
            ORDER BY id DESC
            LIMIT 1
        ", [
            $httpStatus,
            $responseStr,
            $responseTimeMs,
            $errorMessage,
            $errorMessage ? 0 : 1,
            $traceId,
        ]);
    }

    public static function logOperation(string $module, string $operation, string $description, array $context = []): void
    {
        $db = Database::getInstance();

        $db->insert('audit_logs', [
            'trace_id' => self::generateTraceId(),
            'span_id' => self::getCurrentSpanId(),
            'parent_span_id' => self::getParentSpanId(),
            'user_id' => $context['user_id'] ?? null,
            'user_name' => $context['user_name'] ?? null,
            'user_ip' => $context['user_ip'] ?? null,
            'user_agent' => $context['user_agent'] ?? null,
            'request_method' => 'SYSTEM',
            'request_url' => 'system://' . $module . '/' . $operation,
            'request_path' => $module . '/' . $operation,
            'request_params' => !empty($context['params']) ? json_encode($context['params'], JSON_UNESCAPED_UNICODE) : null,
            'module' => $module,
            'operation' => $operation,
            'operation_desc' => $description,
            'resource_type' => $context['resource_type'] ?? null,
            'resource_id' => $context['resource_id'] ?? null,
            'platform_code' => $context['platform_code'] ?? null,
            'sync_direction' => $context['sync_direction'] ?? null,
            'status' => 1,
            'created_at' => date('Y-m-d H:i:s'),
        ]);
    }

    public static function logError(string $module, string $operation, string $errorMessage, array $context = []): void
    {
        $db = Database::getInstance();

        $db->insert('audit_logs', [
            'trace_id' => self::generateTraceId(),
            'span_id' => self::getCurrentSpanId(),
            'parent_span_id' => self::getParentSpanId(),
            'user_id' => $context['user_id'] ?? null,
            'user_name' => $context['user_name'] ?? null,
            'user_ip' => $context['user_ip'] ?? null,
            'error_message' => $errorMessage,
            'module' => $module,
            'operation' => $operation,
            'status' => 0,
            'created_at' => date('Y-m-d H:i:s'),
        ]);
    }

    public static function logSyncOperation(string $platformCode, string $direction, string $dataType, int $count, array $context = []): void
    {
        self::logOperation(
            'integration',
            'sync_' . $direction,
            sprintf('与%s平台%s同步%s数据 %d 条', $platformCode, $direction, $dataType, $count),
            array_merge($context, [
                'platform_code' => $platformCode,
                'sync_direction' => $direction,
                'resource_type' => $dataType,
                'resource_id' => (string)$count,
            ])
        );
    }

    public static function logLogin(int $userId, string $userName, string $ip, bool $success, ?string $failReason = null): void
    {
        $db = Database::getInstance();

        $db->insert('audit_logs', [
            'trace_id' => self::generateTraceId(),
            'user_id' => $userId,
            'user_name' => $userName,
            'user_ip' => $ip,
            'request_method' => 'POST',
            'request_url' => '/api/auth/login',
            'request_path' => '/api/auth/login',
            'module' => 'auth',
            'operation' => 'login',
            'operation_desc' => $success ? '用户登录成功' : '用户登录失败: ' . $failReason,
            'error_message' => $success ? null : $failReason,
            'status' => $success ? 1 : 0,
            'created_at' => date('Y-m-d H:i:s'),
        ]);
    }

    public static function logLogout(int $userId, string $userName, string $ip): void
    {
        $db = Database::getInstance();

        $db->insert('audit_logs', [
            'trace_id' => self::generateTraceId(),
            'user_id' => $userId,
            'user_name' => $userName,
            'user_ip' => $ip,
            'request_method' => 'POST',
            'request_url' => '/api/auth/logout',
            'request_path' => '/api/auth/logout',
            'module' => 'auth',
            'operation' => 'logout',
            'operation_desc' => '用户登出',
            'status' => 1,
            'created_at' => date('Y-m-d H:i:s'),
        ]);
    }

    public static function logDataChange(string $resourceType, string $operation, $resourceId, string $description, array $context = []): void
    {
        self::logOperation(
            'data',
            $operation . '_' . $resourceType,
            $description,
            array_merge($context, [
                'resource_type' => $resourceType,
                'resource_id' => is_array($resourceId) ? json_encode($resourceId) : (string)$resourceId,
            ])
        );
    }

    private static function getClientIp(Request $request): string
    {
        return $request->header['x-forwarded-for'] ??
               $request->header['x-real-ip'] ??
               $request->server['remote_addr'] ??
               'unknown';
    }

    private static function detectModule(string $path): string
    {
        $patterns = [
            '/api/skill' => 'skill',
            '/api/heritor' => 'heritor',
            '/api/process' => 'process',
            '/api/archive' => 'archive',
            '/api/integration' => 'integration',
            '/api/platform' => 'integration',
            '/api/auth' => 'auth',
            '/api/user' => 'user',
            '/api/video' => 'video',
            '/api/pdf' => 'pdf',
            '/api/task' => 'task',
            '/api/review' => 'review',
        ];

        foreach ($patterns as $pattern => $module) {
            if (strpos($path, $pattern) === 0) {
                return $module;
            }
        }

        return 'other';
    }

    private static function detectOperation(string $path): string
    {
        if (strpos($path, '/list') !== false) {
            return 'list';
        }
        if (strpos($path, '/detail') !== false) {
            return 'view';
        }
        if (strpos($path, '/create') !== false) {
            return 'create';
        }
        if (strpos($path, '/update') !== false) {
            return 'update';
        }
        if (strpos($path, '/delete') !== false) {
            return 'delete';
        }
        if (strpos($path, '/upload') !== false) {
            return 'upload';
        }
        if (strpos($path, '/download') !== false) {
            return 'download';
        }
        if (strpos($path, '/sync') !== false) {
            return 'sync';
        }
        if (strpos($path, '/audit') !== false) {
            return 'audit';
        }

        return 'other';
    }

    public static function clear(): void
    {
        self::$traceId = null;
        self::$spanStack = [];
    }
}
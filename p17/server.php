<?php
/**
 * 非遗政务系统 - Swoole 高并发HTTP服务
 * 分布式多模块架构
 */

define('APP_PATH', __DIR__);
define('CONFIG_PATH', APP_PATH . '/config');
define('CORE_PATH', APP_PATH . '/core');
define('MODULE_PATH', APP_PATH . '/modules');
define('MIDDLEWARE_PATH', APP_PATH . '/middleware');
define('UTILS_PATH', APP_PATH . '/utils');
define('DATABASE_PATH', APP_PATH . '/database');
define('LOG_PATH', APP_PATH . '/logs');

require_once CORE_PATH . '/Loader.php';
require_once UTILS_PATH . '/helpers.php';

use Swoole\Http\Server;
use Swoole\Http\Request;
use Swoole\Http\Response;

Core\Loader::register();

$config = require CONFIG_PATH . '/app.php';
$serverConfig = $config['server'];

$server = new Server($serverConfig['host'], $serverConfig['port']);

$server->set([
    'worker_num' => $serverConfig['worker_num'],
    'task_worker_num' => $serverConfig['task_worker_num'],
    'max_request' => $serverConfig['max_request'],
    'daemonize' => $serverConfig['daemonize'],
    'log_file' => LOG_PATH . '/swoole.log',
    'log_level' => $serverConfig['log_level'],
    'upload_tmp_dir' => '/tmp',
    'enable_coroutine' => true,
]);

$server->on('start', function (Server $server) use ($serverConfig) {
    echo "【非遗政务系统】服务启动成功" . PHP_EOL;
    echo "服务地址: http://{$serverConfig['host']}:{$serverConfig['port']}" . PHP_EOL;
    echo "启动时间: " . date('Y-m-d H:i:s') . PHP_EOL;
    echo "========================================" . PHP_EOL;
});

$server->on('workerStart', function (Server $server, int $workerId) {
    Core\Database::getInstance();
    if ($workerId === 0) {
        Core\TaskScheduler::getInstance()->start();
        logWrite('info', '定时任务调度器已启动');
    }
});

$server->on('request', function (Request $request, Response $response) use ($config) {
    $startTime = microtime(true);
    $traceId = null;

    try {
        $path = $request->server['request_uri'] ?? '/';
        $method = $request->server['request_method'] ?? 'GET';

        handleCors($request, $response);

        if ($method === 'OPTIONS') {
            $response->status(204);
            $response->end();
            return;
        }

        $decoded = \Middleware\Compression::decodeRequest($request);

        $rateLimitResult = \Middleware\RateLimiter::checkRequest($request, [
            'max_requests' => 100,
            'window_seconds' => 60,
            'by_user' => true,
        ]);

        $response->header('X-RateLimit-Limit', $rateLimitResult['limit']);
        $response->header('X-RateLimit-Remaining', $rateLimitResult['remaining']);
        $response->header('X-RateLimit-Reset', $rateLimitResult['reset']);

        if (!$rateLimitResult['allowed']) {
            $response->status(429);
            $response->header('Content-Type', 'application/json; charset=utf-8');
            $errorResult = [
                'code' => 429,
                'message' => '请求过于频繁，请稍后再试',
                'data' => [
                    'limit' => $rateLimitResult['limit'],
                    'remaining' => $rateLimitResult['remaining'],
                    'reset_in' => $rateLimitResult['reset'] - time(),
                ],
                'timestamp' => time()
            ];
            $response->end(json_encode($errorResult, JSON_UNESCAPED_UNICODE));
            return;
        }

        $traceId = \Middleware\AuditLogger::logRequest($request);
        $response->header('X-Trace-ID', $traceId);

        $router = new Core\Router();
        $result = $router->dispatch($method, $path, $request);

        if (is_array($result) && isset($result['type']) && $result['type'] === 'file') {
            $response->header('Content-Type', 'application/octet-stream');
            $response->header('Content-Disposition', 'attachment; filename="' . ($result['filename'] ?? 'download') . '"');
            $response->sendfile($result['filepath']);
            if (!empty($result['delete_after'])) {
                @unlink($result['filepath']);
            }
            $responseTime = round((microtime(true) - $startTime) * 1000, 2);
            \Middleware\AuditLogger::logResponse($traceId, 200, 'file_download', $responseTime);
            return;
        }

        if (is_array($result) && isset($result['type']) && $result['type'] === 'stream') {
            $response->header('Content-Type', 'video/mp4');
            if (is_callable($result['stream_fn'])) {
                while ($chunk = ($result['stream_fn'])()) {
                    $response->write($chunk);
                }
            }
            $response->end();
            $responseTime = round((microtime(true) - $startTime) * 1000, 2);
            \Middleware\AuditLogger::logResponse($traceId, 200, 'streaming', $responseTime);
            return;
        }

        $response->header('Content-Type', 'application/json; charset=utf-8');
        
        if (is_array($result) || is_object($result)) {
            $json = json_encode($result, JSON_UNESCAPED_UNICODE);
        } else {
            $json = (string)$result;
        }

        $compressionResult = \Middleware\Compression::encodeResponse($json, $request);

        if ($compressionResult['encoding']) {
            $response->header('Content-Encoding', $compressionResult['encoding']);
            $response->header('X-Compression-Ratio', $compressionResult['ratio'] . '%');
            $json = $compressionResult['content'];
        }

        $response->end($json);

        $httpStatus = is_array($result) && isset($result['code']) ? $result['code'] : 200;
        $errorMsg = is_array($result) && isset($result['code']) && $result['code'] != 200 ? ($result['message'] ?? null) : null;
        
        $responseTime = round((microtime(true) - $startTime) * 1000, 2);
        \Middleware\AuditLogger::logResponse($traceId, $httpStatus, $result, $responseTime, $errorMsg);

    } catch (\Exception $e) {
        $response->status(500);
        $response->header('Content-Type', 'application/json; charset=utf-8');
        $errorResult = [
            'code' => 500,
            'message' => '系统错误: ' . $e->getMessage(),
            'data' => null,
            'timestamp' => time()
        ];
        $response->end(json_encode($errorResult, JSON_UNESCAPED_UNICODE));

        if ($traceId) {
            $responseTime = round((microtime(true) - $startTime) * 1000, 2);
            \Middleware\AuditLogger::logResponse($traceId, 500, $errorResult, $responseTime, $e->getMessage());
        }
    } finally {
        \Middleware\AuditLogger::clear();
    }
});

$server->on('task', function (Server $server, int $taskId, int $fromId, $data) {
    try {
        $result = Core\Task::handle($data);
        return $result;
    } catch (\Exception $e) {
        return ['error' => $e->getMessage()];
    }
});

$server->on('finish', function (Server $server, int $taskId, $data) {
});

$server->start();

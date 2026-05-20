<?php

use Swoole\Http\Request;
use Swoole\Http\Response;

function success($data = null, string $msg = '操作成功', int $code = 200): array
{
    return [
        'code' => $code,
        'msg' => $msg,
        'data' => $data,
        'timestamp' => time(),
    ];
}

function error(string $msg = '操作失败', int $code = 400, $data = null): array
{
    return [
        'code' => $code,
        'msg' => $msg,
        'data' => $data,
        'timestamp' => time(),
    ];
}

function paginate(int $page, int $pageSize, int $total, array $list): array
{
    return [
        'list' => $list,
        'pagination' => [
            'page' => $page,
            'page_size' => $pageSize,
            'total' => $total,
            'total_pages' => (int)ceil($total / $pageSize),
        ],
    ];
}

function handleCors(Request $request, Response $response): void
{
    $config = require CONFIG_PATH . '/app.php';
    $corsConfig = $config['cors'];

    $origin = $request->header['origin'] ?? '';
    if (in_array('*', $corsConfig['allow_origin']) || in_array($origin, $corsConfig['allow_origin'])) {
        $response->header('Access-Control-Allow-Origin', $origin ?: '*');
    }

    $response->header('Access-Control-Allow-Methods', implode(', ', $corsConfig['allow_methods']));
    $response->header('Access-Control-Allow-Headers', implode(', ', $corsConfig['allow_headers']));
    $response->header('Access-Control-Allow-Credentials', 'true');
}

function getRequestIp(Request $request): string
{
    if (isset($request->header['x-forwarded-for'])) {
        $ip = explode(',', $request->header['x-forwarded-for'])[0];
    } elseif (isset($request->header['x-real-ip'])) {
        $ip = $request->header['x-real-ip'];
    } else {
        $ip = $request->server['remote_addr'] ?? '';
    }
    return trim($ip);
}

function generateOrderNo(string $prefix = 'HRT'): string
{
    return $prefix . date('YmdHis') . rand(1000, 9999);
}

function maskString(string $str, int $start = 3, int $end = 4): string
{
    $len = strlen($str);
    if ($len <= $start + $end) {
        return $str;
    }
    return substr($str, 0, $start) . str_repeat('*', $len - $start - $end) . substr($str, -$end);
}

function array_filter_recursive(array $array): array
{
    foreach ($array as &$value) {
        if (is_array($value)) {
            $value = array_filter_recursive($value);
        }
    }
    return array_filter($array, fn($item) => $item !== null && $item !== '');
}

function validateRequired(array $data, array $fields): ?string
{
    foreach ($fields as $field) {
        if (!isset($data[$field]) || $data[$field] === '' || $data[$field] === null) {
            return "参数 {$field} 不能为空";
        }
    }
    return null;
}

function logWrite(string $level, string $message, array $context = []): void
{
    $logFile = LOG_PATH . '/' . date('Y-m-d') . '.log';
    $logDir = dirname($logFile);
    if (!is_dir($logDir)) {
        mkdir($logDir, 0755, true);
    }

    $timestamp = date('Y-m-d H:i:s');
    $contextStr = empty($context) ? '' : ' ' . json_encode($context, JSON_UNESCAPED_UNICODE);
    $logLine = "[{$timestamp}] [{$level}] {$message}{$contextStr}" . PHP_EOL;
    
    file_put_contents($logFile, $logLine, FILE_APPEND | LOCK_EX);
}

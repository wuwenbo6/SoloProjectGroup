<?php
namespace Middleware;

class Compression
{
    private static $config;
    
    private static function getConfig(): array
    {
        if (self::$config === null) {
            self::$config = require CONFIG_PATH . '/app.php';
        }
        return self::$config['compression'] ?? [
            'enabled' => true,
            'min_length' => 1024,
            'level' => 6,
            'methods' => ['gzip', 'deflate'],
        ];
    }
    
    public static function decodeRequest(\Swoole\Http\Request $request): ?string
    {
        $config = self::getConfig();
        if (!$config['enabled']) {
            return null;
        }
        
        $contentEncoding = $request->header['content-encoding'] ?? '';
        
        if (empty($contentEncoding)) {
            return null;
        }
        
        $rawData = $request->rawContent();
        if (empty($rawData)) {
            return null;
        }
        
        $encoding = strtolower($contentEncoding);
        
        try {
            $decoded = null;
            
            if ($encoding === 'gzip') {
                $decoded = gzdecode($rawData);
            } elseif ($encoding === 'deflate') {
                $decoded = gzinflate($rawData);
                if ($decoded === false) {
                    $decoded = gzuncompress($rawData);
                }
            }
            
            if ($decoded !== false) {
                $request->compressed_data = $decoded;
                return $decoded;
            }
        } catch (\Exception $e) {
            logWrite('warning', '请求解压失败', ['encoding' => $encoding, 'error' => $e->getMessage()]);
        }
        
        return null;
    }
    
    public static function encodeResponse(string $content, \Swoole\Http\Request $request): array
    {
        $config = self::getConfig();
        if (!$config['enabled']) {
            return ['content' => $content, 'encoding' => null];
        }
        
        if (strlen($content) < $config['min_length']) {
            return ['content' => $content, 'encoding' => null];
        }
        
        $acceptEncoding = $request->header['accept-encoding'] ?? '';
        $supportedMethods = $config['methods'];
        $level = $config['level'];
        
        $selectedEncoding = null;
        $compressed = null;
        
        foreach ($supportedMethods as $method) {
            if (stripos($acceptEncoding, $method) !== false) {
                try {
                    if ($method === 'gzip') {
                        $compressed = gzencode($content, $level);
                    } elseif ($method === 'deflate') {
                        $compressed = gzcompress($content, $level);
                    }
                    
                    if ($compressed !== false) {
                        $selectedEncoding = $method;
                        break;
                    }
                } catch (\Exception $e) {
                    logWrite('warning', '响应压缩失败', ['method' => $method, 'error' => $e->getMessage()]);
                }
            }
        }
        
        if ($selectedEncoding && $compressed) {
            return [
                'content' => $compressed,
                'encoding' => $selectedEncoding,
                'original_size' => strlen($content),
                'compressed_size' => strlen($compressed),
                'ratio' => round((strlen($content) - strlen($compressed)) / strlen($content) * 100, 2),
            ];
        }
        
        return ['content' => $content, 'encoding' => null];
    }
    
    public static function shouldCompress(string $contentType, int $contentLength): bool
    {
        $config = self::getConfig();
        if (!$config['enabled']) {
            return false;
        }
        
        if ($contentLength < $config['min_length']) {
            return false;
        }
        
        $compressibleTypes = [
            'application/json',
            'application/xml',
            'text/html',
            'text/plain',
            'text/css',
            'text/javascript',
            'application/javascript',
        ];
        
        foreach ($compressibleTypes as $type) {
            if (stripos($contentType, $type) !== false) {
                return true;
            }
        }
        
        return false;
    }
    
    public static function getCompressionInfo(): array
    {
        $config = self::getConfig();
        return [
            'enabled' => $config['enabled'],
            'min_length' => $config['min_length'],
            'level' => $config['level'],
            'supported_methods' => $config['methods'],
        ];
    }
}
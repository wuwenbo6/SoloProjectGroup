<?php
namespace Middleware;

use Swoole\Http\Request;
use Core\Database;

class RateLimiter
{
    private static $limiters = [];
    private static $config;
    
    private $maxRequests;
    private $windowSeconds;
    private $keyPrefix;
    
    public function __construct(string $keyPrefix = 'api', int $maxRequests = null, int $windowSeconds = null)
    {
        $this->keyPrefix = $keyPrefix;
        $this->maxRequests = $maxRequests ?? self::getDefaultMaxRequests();
        $this->windowSeconds = $windowSeconds ?? self::getDefaultWindowSeconds();
    }
    
    private static function getConfig(): array
    {
        if (self::$config === null) {
            self::$config = require CONFIG_PATH . '/app.php';
        }
        return self::$config['rate_limit'] ?? [];
    }
    
    private static function getDefaultMaxRequests(): int
    {
        $config = self::getConfig();
        return $config['max_requests'] ?? 100;
    }
    
    private static function getDefaultWindowSeconds(): int
    {
        $config = self::getConfig();
        return $config['window_seconds'] ?? 60;
    }
    
    public static function getInstance(string $keyPrefix = 'api', int $maxRequests = null, int $windowSeconds = null): self
    {
        $maxRequests = $maxRequests ?? self::getDefaultMaxRequests();
        $windowSeconds = $windowSeconds ?? self::getDefaultWindowSeconds();
        $key = $keyPrefix . '_' . $maxRequests . '_' . $windowSeconds;
        if (!isset(self::$limiters[$key])) {
            self::$limiters[$key] = new self($keyPrefix, $maxRequests, $windowSeconds);
        }
        return self::$limiters[$key];
    }
    
    public function isAllowed(string $identifier): bool
    {
        $now = time();
        $windowStart = $now - ($now % $this->windowSeconds);
        $key = $this->keyPrefix . ':' . $identifier . ':' . $windowStart;
        
        $db = Database::getInstance();
        
        try {
            $db->beginTransaction();
            
            $current = $db->fetchOne(
                "SELECT request_count FROM rate_limits WHERE cache_key = ? FOR UPDATE",
                [$key]
            );
            
            if (!$current) {
                $db->insert('rate_limits', [
                    'cache_key' => $key,
                    'request_count' => 1,
                    'window_start' => $windowStart,
                    'expire_at' => $windowStart + $this->windowSeconds,
                    'created_at' => date('Y-m-d H:i:s'),
                ]);
                $isAllowed = true;
            } else {
                $count = intval($current['request_count']);
                if ($count >= $this->maxRequests) {
                    $isAllowed = false;
                } else {
                    $db->query(
                        "UPDATE rate_limits SET request_count = request_count + 1 WHERE cache_key = ?",
                        [$key]
                    );
                    $isAllowed = true;
                }
            }
            
            $db->commit();
            
            $this->cleanupExpired();
            
            return $isAllowed;
        } catch (\Exception $e) {
            $db->rollback();
            logWrite('warning', '限流检查异常', ['error' => $e->getMessage()]);
            return true;
        }
    }
    
    private function cleanupExpired(): void
    {
        $now = time();
        if (mt_rand(1, 100) === 1) {
            $db = Database::getInstance();
            $db->query("DELETE FROM rate_limits WHERE expire_at < ?", [$now]);
        }
    }
    
    public function getRemainingRequests(string $identifier): int
    {
        $now = time();
        $windowStart = $now - ($now % $this->windowSeconds);
        $key = $this->keyPrefix . ':' . $identifier . ':' . $windowStart;
        
        $db = Database::getInstance();
        $current = $db->fetchOne(
            "SELECT request_count FROM rate_limits WHERE cache_key = ?",
            [$key]
        );
        
        $count = $current ? intval($current['request_count']) : 0;
        return max(0, $this->maxRequests - $count);
    }
    
    public function getResetTime(string $identifier): int
    {
        $now = time();
        $windowStart = $now - ($now % $this->windowSeconds);
        return $windowStart + $this->windowSeconds;
    }
    
    public static function getClientIp(Request $request): string
    {
        $ip = $request->header['x-forwarded-for'] ?? '';
        if (!empty($ip)) {
            $ips = explode(',', $ip);
            $ip = trim($ips[0]);
        }
        if (empty($ip)) {
            $ip = $request->header['x-real-ip'] ?? '';
        }
        if (empty($ip)) {
            $ip = $request->server['remote_addr'] ?? '127.0.0.1';
        }
        return $ip;
    }
    
    public static function checkRequest(Request $request, array $options = []): array
    {
        $maxRequests = $options['max_requests'] ?? 100;
        $windowSeconds = $options['window_seconds'] ?? 60;
        $byUser = $options['by_user'] ?? true;
        
        $identifier = self::getClientIp($request);
        
        if ($byUser && isset($request->user['id'])) {
            $identifier = 'user_' . $request->user['id'];
        }
        
        $limiter = self::getInstance('api', $maxRequests, $windowSeconds);
        $isAllowed = $limiter->isAllowed($identifier);
        $remaining = $limiter->getRemainingRequests($identifier);
        $resetTime = $limiter->getResetTime($identifier);
        
        return [
            'allowed' => $isAllowed,
            'limit' => $maxRequests,
            'remaining' => $remaining,
            'reset' => $resetTime,
            'identifier' => $identifier,
        ];
    }
}
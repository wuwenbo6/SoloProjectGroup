<?php
/**
 * 修复验证测试脚本
 * php test_fix.php
 */

define('APP_PATH', __DIR__);
define('CONFIG_PATH', APP_PATH . '/config');
define('CORE_PATH', APP_PATH . '/core');
define('MODULE_PATH', APP_PATH . '/modules');
define('MIDDLEWARE_PATH', APP_PATH . '/middleware');
define('UTILS_PATH', APP_PATH . '/utils');
define('DATABASE_PATH', APP_PATH . '/database');
define('LOG_PATH', APP_PATH . '/logs');

echo "=== 非遗政务系统修复验证脚本 ===\n\n";

$tests = [
    '1. JWT Token 校验' => function() {
        require_once UTILS_PATH . '/Jwt.php';
        
        $token = \Utils\Jwt::encode(['user_id' => 1, 'username' => 'admin']);
        echo "   生成Token: " . substr($token, 0, 50) . "...\n";
        
        $payload = \Utils\Jwt::decode($token);
        if ($payload && $payload['user_id'] == 1) {
            echo "   ✓ Token 解码验证通过\n";
            return true;
        }
        echo "   ✗ Token 解码失败\n";
        return false;
    },
    
    '2. BCMath 浮点运算精度' => function() {
        require_once UTILS_PATH . '/BcMath.php';
        
        $actual = '95.5';
        $standard = '100';
        $rate = \Utils\BcMath::percentRate($actual, $standard, 2);
        
        echo "   计算: {$actual}/{$standard} * 100 = {$rate}\n";
        
        if ($rate == 95.5) {
            echo "   ✓ 浮点运算精度正确\n";
            return true;
        }
        echo "   ✗ 浮点运算精度错误，期望值: 95.5, 实际: {$rate}\n";
        return false;
    },
    
    '3. 字段映射配置' => function() {
        require_once MODULE_PATH . '/integration/FieldMapping.php';
        
        $mapped = \Modules\integration\FieldMapping::mapFields(
            ['skill_no' => 'SK001', 'name' => '测试'],
            'Skill',
            'local_to_remote'
        );
        
        echo "   字段映射结果: " . json_encode($mapped, JSON_UNESCAPED_UNICODE) . "\n";
        
        if (isset($mapped['heritage_id']) && $mapped['heritage_id'] == 'SK001') {
            echo "   ✓ 字段映射正确\n";
            return true;
        }
        echo "   ✗ 字段映射错误\n";
        return false;
    },
    
    '4. 权限校验缓存' => function() {
        require_once MIDDLEWARE_PATH . '/AuthMiddleware.php';
        
        $reflection = new \ReflectionClass(\Middleware\AuthMiddleware::class);
        $hasCache = $reflection->hasProperty('authenticatedUsers');
        
        if ($hasCache) {
            echo "   ✓ 身份验证缓存已实现\n";
            return true;
        }
        echo "   ✗ 身份验证缓存未实现\n";
        return false;
    },
    
    '5. 限流中间件' => function() {
        require_once MIDDLEWARE_PATH . '/RateLimiter.php';
        
        $reflection = new \ReflectionClass(\Middleware\RateLimiter::class);
        $hasLimiters = $reflection->hasProperty('limiters');
        $hasConfig = $reflection->hasProperty('config');
        
        if ($hasLimiters && $hasConfig) {
            echo "   ✓ 限流中间件配置正确\n";
            return true;
        }
        echo "   ✗ 限流中间件配置错误\n";
        return false;
    },
];

$passed = 0;
$total = count($tests);

foreach ($tests as $name => $test) {
    echo "测试: {$name}\n";
    try {
        if ($test()) {
            $passed++;
        }
    } catch (\Exception $e) {
        echo "   ✗ 异常: " . $e->getMessage() . "\n";
    }
    echo "\n";
}

echo "=== 测试结果 ===\n";
echo "通过: {$passed}/{$total}\n";
echo "成功率: " . ($total > 0 ? round($passed / $total * 100, 2) : 0) . "%\n\n";

if ($passed == $total) {
    echo "✓ 所有修复验证通过！\n";
    exit(0);
} else {
    echo "✗ 部分修复未通过，请检查。\n";
    exit(1);
}
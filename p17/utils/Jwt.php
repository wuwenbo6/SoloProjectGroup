<?php
namespace Utils;

class Jwt
{
    private static $config;

    private static function getConfig(): array
    {
        if (self::$config === null) {
            self::$config = require CONFIG_PATH . '/app.php';
        }
        return self::$config['jwt'] ?? [
            'secret' => 'heritage_system_jwt_secret_2024',
            'expire' => 7200,
            'issuer' => 'heritage_system',
        ];
    }

    public static function encode(array $payload): string
    {
        $config = self::getConfig();
        $header = base64_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
        
        $payload['iss'] = $config['issuer'];
        $payload['iat'] = time();
        $payload['exp'] = time() + $config['expire'];
        
        $payloadStr = base64_encode(json_encode($payload));
        $signature = hash_hmac('sha256', "{$header}.{$payloadStr}", $config['secret'], true);
        $signature = base64_encode($signature);
        
        return "{$header}.{$payloadStr}.{$signature}";
    }

    public static function decode(string $token): ?array
    {
        if (empty($token)) {
            return null;
        }

        $config = self::getConfig();
        $parts = explode('.', $token);
        
        if (count($parts) !== 3) {
            return null;
        }

        [$header, $payload, $signature] = $parts;
        
        $expectedSignature = hash_hmac('sha256', "{$header}.{$payload}", $config['secret'], true);
        $expectedSignature = base64_encode($expectedSignature);
        
        if (!hash_equals($expectedSignature, $signature)) {
            return null;
        }

        $payloadData = json_decode(base64_decode($payload), true);
        
        if (!is_array($payloadData)) {
            return null;
        }

        if (isset($payloadData['exp']) && $payloadData['exp'] < time()) {
            return null;
        }

        if (!isset($payloadData['user_id']) || !is_numeric($payloadData['user_id'])) {
            return null;
        }

        return $payloadData;
    }

    public static function refresh(string $token): ?string
    {
        $payload = self::decode($token);
        if (!$payload) {
            return null;
        }
        unset($payload['iat'], $payload['exp']);
        return self::encode($payload);
    }

    public static function getTokenExpire(): int
    {
        $config = self::getConfig();
        return $config['expire'];
    }
}

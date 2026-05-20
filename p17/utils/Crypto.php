<?php
namespace Utils;

class Crypto
{
    private static $config;

    private static function getConfig(): array
    {
        if (self::$config === null) {
            self::$config = require CONFIG_PATH . '/app.php';
        }
        return self::$config['archive'];
    }

    public static function encrypt(string $data, ?string $key = null): string
    {
        $config = self::getConfig();
        $key = $key ?? $config['encrypt_key'];
        
        $key = hash('sha256', $key, true);
        $iv = openssl_random_pseudo_bytes(openssl_cipher_iv_length('aes-256-cbc'));
        $encrypted = openssl_encrypt($data, 'aes-256-cbc', $key, OPENSSL_RAW_DATA, $iv);
        
        return base64_encode($iv . $encrypted);
    }

    public static function decrypt(string $encrypted, ?string $key = null): ?string
    {
        $config = self::getConfig();
        $key = $key ?? $config['encrypt_key'];
        
        $key = hash('sha256', $key, true);
        $data = base64_decode($encrypted);
        $ivLength = openssl_cipher_iv_length('aes-256-cbc');
        
        if (strlen($data) < $ivLength) {
            return null;
        }
        
        $iv = substr($data, 0, $ivLength);
        $encrypted = substr($data, $ivLength);
        
        $decrypted = openssl_decrypt($encrypted, 'aes-256-cbc', $key, OPENSSL_RAW_DATA, $iv);
        return $decrypted ?: null;
    }

    public static function sign(string $data, ?string $key = null): string
    {
        $config = self::getConfig();
        $key = $key ?? $config['verify_key'];
        return hash_hmac('sha256', $data, $key);
    }

    public static function verify(string $data, string $signature, ?string $key = null): bool
    {
        $config = self::getConfig();
        $key = $key ?? $config['verify_key'];
        $expected = hash_hmac('sha256', $data, $key);
        return hash_equals($expected, $signature);
    }

    public static function generateArchiveHash(array $data): string
    {
        ksort($data);
        $dataStr = json_encode($data, JSON_UNESCAPED_UNICODE);
        return hash('sha256', $dataStr . uniqid('', true));
    }

    public static function generateChainHash(string $previousHash, array $currentData): string
    {
        ksort($currentData);
        $dataStr = json_encode($currentData, JSON_UNESCAPED_UNICODE);
        return hash('sha256', $previousHash . $dataStr . time());
    }
}

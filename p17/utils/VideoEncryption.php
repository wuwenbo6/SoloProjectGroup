<?php
namespace Utils;

class VideoEncryption
{
    private static $config;
    
    private static function getConfig(): array
    {
        if (self::$config === null) {
            self::$config = require CONFIG_PATH . '/app.php';
        }
        return self::$config['video'] ?? [
            'encryption_key' => 'heritage_video_encrypt_2024_secret_key',
            'storage_path' => APP_PATH . '/storage/videos/',
            'thumbnail_path' => APP_PATH . '/storage/thumbnails/',
            'max_size' => 524288000,
            'allowed_formats' => ['mp4', 'avi', 'mov', 'mkv', 'flv', 'wmv'],
        ];
    }
    
    public static function generateEncryptionKey(): string
    {
        return bin2hex(random_bytes(32));
    }
    
    public static function encryptFile(string $sourcePath, string $destPath, string $key): bool
    {
        if (!file_exists($sourcePath)) {
            return false;
        }
        
        $config = self::getConfig();
        $masterKey = hash('sha256', $config['encryption_key'] . $key, true);
        
        $fpSource = fopen($sourcePath, 'rb');
        $fpDest = fopen($destPath, 'wb');
        
        if (!$fpSource || !$fpDest) {
            return false;
        }
        
        $iv = openssl_random_pseudo_bytes(16);
        fwrite($fpDest, $iv);
        
        $chunkSize = 8192;
        $keyIndex = 0;
        
        while (!feof($fpSource)) {
            $chunk = fread($fpSource, $chunkSize);
            $encrypted = openssl_encrypt(
                $chunk,
                'AES-256-CBC',
                $masterKey,
                OPENSSL_RAW_DATA,
                $iv
            );
            
            $iv = substr(hash('sha256', $iv . $key . $keyIndex++, true), 0, 16);
            fwrite($fpDest, $encrypted);
        }
        
        fclose($fpSource);
        fclose($fpDest);
        
        return true;
    }
    
    public static function decryptFile(string $sourcePath, string $destPath, string $key): bool
    {
        if (!file_exists($sourcePath)) {
            return false;
        }
        
        $config = self::getConfig();
        $masterKey = hash('sha256', $config['encryption_key'] . $key, true);
        
        $fpSource = fopen($sourcePath, 'rb');
        $fpDest = fopen($destPath, 'wb');
        
        if (!$fpSource || !$fpDest) {
            return false;
        }
        
        $iv = fread($fpSource, 16);
        $chunkSize = 8192;
        $keyIndex = 0;
        
        while (!feof($fpSource)) {
            $chunk = fread($fpSource, $chunkSize + 16);
            $decrypted = openssl_decrypt(
                $chunk,
                'AES-256-CBC',
                $masterKey,
                OPENSSL_RAW_DATA,
                $iv
            );
            
            $nextIv = substr(hash('sha256', $iv . $key . $keyIndex++, true), 0, 16);
            fwrite($fpDest, $decrypted);
            $iv = $nextIv;
        }
        
        fclose($fpSource);
        fclose($fpDest);
        
        return true;
    }
    
    public static function getStreamDecryptor(string $sourcePath, string $key)
    {
        if (!file_exists($sourcePath)) {
            return null;
        }
        
        $config = self::getConfig();
        $masterKey = hash('sha256', $config['encryption_key'] . $key, true);
        
        $fp = fopen($sourcePath, 'rb');
        if (!$fp) {
            return null;
        }
        
        $iv = fread($fp, 16);
        $keyIndex = 0;
        
        return function() use ($fp, $masterKey, &$iv, &$keyIndex, $key) {
            if (feof($fp)) {
                fclose($fp);
                return false;
            }
            
            $chunk = fread($fp, 8192 + 16);
            $decrypted = openssl_decrypt(
                $chunk,
                'AES-256-CBC',
                $masterKey,
                OPENSSL_RAW_DATA,
                $iv
            );
            
            $iv = substr(hash('sha256', $iv . $key . $keyIndex++, true), 0, 16);
            return $decrypted;
        };
    }
    
    public static function calculateFileHash(string $filePath): ?string
    {
        if (!file_exists($filePath)) {
            return null;
        }
        return hash_file('sha256', $filePath);
    }
    
    public static function getStoragePath(): string
    {
        $config = self::getConfig();
        $path = $config['storage_path'];
        if (!is_dir($path)) {
            mkdir($path, 0755, true);
        }
        return $path;
    }
    
    public static function getThumbnailPath(): string
    {
        $config = self::getConfig();
        $path = $config['thumbnail_path'];
        if (!is_dir($path)) {
            mkdir($path, 0755, true);
        }
        return $path;
    }
    
    public static function generateVideoNo(): string
    {
        return 'VID' . date('YmdHis') . str_pad(rand(0, 9999), 4, '0', STR_PAD_LEFT);
    }
    
    public static function isAllowedFormat(string $extension): bool
    {
        $config = self::getConfig();
        return in_array(strtolower($extension), $config['allowed_formats'] ?? []);
    }
    
    public static function getMaxSize(): int
    {
        $config = self::getConfig();
        return $config['max_size'] ?? 524288000;
    }
}
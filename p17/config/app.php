<?php
return [
    'jwt' => [
        'secret' => 'heritage_system_jwt_secret_2024',
        'expire' => 7200,
        'issuer' => 'heritage_system',
    ],
    'aes' => [
        'key' => 'heritage_system_aes_256_key_2024',
    ],
    'server' => [
        'host' => '0.0.0.0',
        'port' => 9501,
        'worker_num' => 8,
        'task_worker_num' => 4,
        'max_request' => 10000,
        'daemonize' => false,
        'log_file' => LOG_PATH . '/swoole.log',
        'log_level' => 0,
    ],
    'database' => [
        'host' => '127.0.0.1',
        'port' => 3306,
        'database' => 'heritage_system',
        'username' => 'root',
        'password' => '',
        'charset' => 'utf8mb4',
        'collation' => 'utf8mb4_unicode_ci',
    ],
    'rate_limit' => [
        'max_requests' => 100,
        'window_seconds' => 60,
    ],
    'compression' => [
        'enabled' => true,
        'min_length' => 1024,
        'level' => 6,
        'methods' => ['gzip', 'deflate'],
    ],
    'video' => [
        'encryption_key' => 'heritage_video_encrypt_2024_secret_key',
        'storage_path' => APP_PATH . '/storage/videos/',
        'thumbnail_path' => APP_PATH . '/storage/thumbnails/',
        'max_size' => 524288000,
        'allowed_formats' => ['mp4', 'avi', 'mov', 'mkv', 'flv', 'wmv'],
    ],
    'pdf' => [
        'storage_path' => APP_PATH . '/storage/pdf/',
        'font_path' => APP_PATH . '/assets/fonts/',
    ],
];

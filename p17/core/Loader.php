<?php
namespace Core;

class Loader
{
    private static $namespaces = [
        'Core' => CORE_PATH,
        'Middleware' => MIDDLEWARE_PATH,
        'Utils' => UTILS_PATH,
        'Modules' => MODULE_PATH,
    ];

    public static function register(): void
    {
        spl_autoload_register([__CLASS__, 'autoload']);
    }

    public static function autoload(string $class): void
    {
        foreach (self::$namespaces as $namespace => $path) {
            if (strpos($class, $namespace) === 0) {
                $file = str_replace('\\', '/', substr($class, strlen($namespace) + 1));
                $filePath = $path . '/' . $file . '.php';
                if (file_exists($filePath)) {
                    require_once $filePath;
                    return;
                }
            }
        }
    }
}

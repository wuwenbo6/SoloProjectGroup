<?php
namespace Core;

use Swoole\Http\Request;

class Router
{
    private $routes = [];

    public function __construct()
    {
        $this->registerRoutes();
    }

    private function registerRoutes(): void
    {
        $this->routes = [
            'GET' => [
                '/' => fn() => success('非遗政务系统API服务 - 运行正常'),
                '/health' => fn() => success('ok'),
            ],
            'POST' => []
        ];

        $modules = ['skill', 'process', 'auth', 'archive', 'tourism', 'video', 'pdf', 'review', 'task', 'audit', 'integration'];
        foreach ($modules as $module) {
            $moduleClass = "Modules\\$module\\Route";
            if (class_exists($moduleClass)) {
                $moduleRoutes = $moduleClass::getRoutes();
                foreach ($moduleRoutes as $method => $routes) {
                    foreach ($routes as $path => $handler) {
                        $this->routes[$method][$path] = $handler;
                    }
                }
            }
        }
    }

    public function dispatch(string $method, string $path, Request $request)
    {
        if (!isset($this->routes[$method])) {
            return error('请求方法不支持', 405);
        }

        if (isset($this->routes[$method][$path])) {
            $handler = $this->routes[$method][$path];
            return $this->handleRoute($handler, $request);
        }

        foreach ($this->routes[$method] as $routePath => $handler) {
            $pattern = preg_replace('#\{[a-zA-Z0-9_]+}#', '([a-zA-Z0-9_]+)', $routePath);
            if (preg_match("#^{$pattern}$#", $path, $matches)) {
                array_shift($matches);
                return $this->handleRoute($handler, $request, $matches);
            }
        }

        return error('接口不存在', 404);
    }

    private function handleRoute(callable $handler, Request $request, array $params = [])
    {
        $data = $this->getRequestData($request);
        return call_user_func_array($handler, array_merge([$data, $request], $params));
    }

    private function getRequestData(Request $request): array
    {
        $data = [];
        
        if (!empty($request->get)) {
            $data = array_merge($data, $request->get);
        }
        
        if (!empty($request->post)) {
            $data = array_merge($data, $request->post);
        }
        
        $contentType = $request->header['content-type'] ?? '';
        if (strpos($contentType, 'application/json') !== false) {
            if (isset($request->compressed_data)) {
                $rawContent = $request->compressed_data;
            } else {
                $rawContent = $request->rawContent();
            }
            if ($rawContent) {
                $jsonData = json_decode($rawContent, true);
                if (json_last_error() === JSON_ERROR_NONE) {
                    $data = array_merge($data, $jsonData);
                }
            }
        }
        
        return $data;
    }
}

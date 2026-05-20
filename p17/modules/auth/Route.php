<?php
namespace Modules\auth;

class Route
{
    public static function getRoutes(): array
    {
        return [
            'POST' => [
                '/api/auth/login' => fn($data, $request) => AuthController::login($data, $request),
                '/api/auth/logout' => fn($data, $request) => AuthController::logout($data, $request),
                '/api/auth/refresh' => fn($data, $request) => AuthController::refresh($data, $request),
                '/api/heritor/create' => fn($data, $request) => AuthController::createHeritor($data, $request),
                '/api/heritor/audit' => fn($data, $request) => AuthController::auditHeritor($data, $request),
                '/api/heritor/qualification/renew' => fn($data, $request) => AuthController::renewQualification($data, $request),
            ],
            'GET' => [
                '/api/auth/info' => fn($data, $request) => AuthController::getUserInfo($data, $request),
                '/api/heritor/list' => fn($data, $request) => AuthController::getHeritorList($data, $request),
                '/api/heritor/detail' => fn($data, $request) => AuthController::getHeritorDetail($data, $request),
                '/api/user/list' => fn($data, $request) => AuthController::getUserList($data, $request),
            ],
        ];
    }
}

<?php
namespace Modules\task;

class Route
{
    public static function getRoutes(): array
    {
        return [
            'POST' => [
                '/api/task/create' => fn($data, $request) => TaskController::createTask($data, $request),
                '/api/task/update' => fn($data, $request) => TaskController::updateTask($data, $request),
                '/api/task/run' => fn($data, $request) => TaskController::runTask($data, $request),
                '/api/task/delete' => fn($data, $request) => TaskController::deleteTask($data, $request),
                '/api/task/toggle' => fn($data, $request) => TaskController::toggleTaskStatus($data, $request),
            ],
            'GET' => [
                '/api/task/list' => fn($data, $request) => TaskController::getTaskList($data, $request),
                '/api/task/detail' => fn($data, $request) => TaskController::getTaskDetail($data, $request),
                '/api/task/running' => fn($data, $request) => TaskController::getRunningTasks($data, $request),
            ],
        ];
    }
}
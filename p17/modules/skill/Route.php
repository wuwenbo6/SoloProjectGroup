<?php
namespace Modules\skill;

use Swoole\Http\Request;

class Route
{
    public static function getRoutes(): array
    {
        return [
            'GET' => [
                '/api/skill/list' => fn($data, $request) => SkillController::getList($data, $request),
                '/api/skill/detail' => fn($data, $request) => SkillController::getDetail($data, $request),
                '/api/skill/process/list' => fn($data, $request) => SkillController::getProcessList($data, $request),
                '/api/skill/category/tree' => fn($data, $request) => CategoryController::getCategoryTree($data, $request),
                '/api/skill/category/list' => fn($data, $request) => CategoryController::getCategoryList($data, $request),
                '/api/skill/filter' => fn($data, $request) => CategoryController::intelligentFilter($data, $request),
                '/api/skill/filter/options' => fn($data, $request) => CategoryController::getFilterOptions($data, $request),
                '/api/skill/statistics' => fn($data, $request) => CategoryController::getStatistics($data, $request),
            ],
            'POST' => [
                '/api/skill/create' => fn($data, $request) => SkillController::create($data, $request),
                '/api/skill/update' => fn($data, $request) => SkillController::update($data, $request),
                '/api/skill/audit' => fn($data, $request) => SkillController::audit($data, $request),
                '/api/skill/process/create' => fn($data, $request) => SkillController::createProcess($data, $request),
                '/api/skill/process/update' => fn($data, $request) => SkillController::updateProcess($data, $request),
                '/api/skill/delete' => fn($data, $request) => SkillController::delete($data, $request),
            ],
        ];
    }
}

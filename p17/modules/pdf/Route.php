<?php
namespace Modules\pdf;

class Route
{
    public static function getRoutes(): array
    {
        return [
            'POST' => [
                '/api/pdf/skill-archive' => fn($data, $request) => PdfController::generateSkillArchive($data, $request),
                '/api/pdf/grade-archive' => fn($data, $request) => PdfController::generateGradeArchive($data, $request),
                '/api/pdf/heritor-archive' => fn($data, $request) => PdfController::generateHeritorArchive($data, $request),
                '/api/pdf/delete' => fn($data, $request) => PdfController::delete($data, $request),
            ],
            'GET' => [
                '/api/pdf/list' => fn($data, $request) => PdfController::getList($data, $request),
                '/api/pdf/download' => fn($data, $request) => PdfController::download($data, $request),
                '/api/pdf/batch-download' => fn($data, $request) => PdfController::batchDownload($data, $request),
            ],
        ];
    }
}
<?php
namespace Modules\pdf;

use Swoole\Http\Request;
use Core\Database;
use Middleware\AuthMiddleware;
use Utils\PdfGenerator;

class PdfController
{
    public static function generateSkillArchive(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'pdf:generate')) {
            return error('权限不足', 403);
        }

        if (empty($data['skill_ids']) || !is_array($data['skill_ids'])) {
            return error('请选择要归档的技艺');
        }

        $db = Database::getInstance();
        $placeholders = str_repeat('?,', count($data['skill_ids']) - 1) . '?';
        
        $skills = $db->fetchAll("
            SELECT s.*, h.name as heritor_name, c.name as category_name
            FROM heritage_skills s
            LEFT JOIN heritors h ON s.heritor_id = h.id
            LEFT JOIN skill_categories c ON s.category_id = c.id
            WHERE s.id IN ({$placeholders})
        ", $data['skill_ids']);

        if (empty($skills)) {
            return error('未找到符合条件的技艺数据');
        }

        $title = $data['title'] ?? '非遗技艺定级结果归档_' . date('Ymd');
        $options = [
            'include_scores' => $data['include_scores'] ?? true,
            'include_process' => $data['include_process'] ?? false,
        ];

        $archiveInfo = PdfGenerator::generateSkillArchive($skills, $title, $options);

        $archiveId = $db->insert('pdf_archives', [
            'archive_no' => $archiveInfo['archive_no'],
            'archive_type' => 'skill',
            'title' => $title,
            'file_path' => $archiveInfo['file_path'],
            'file_size' => $archiveInfo['file_size'],
            'file_hash' => $archiveInfo['file_hash'],
            'item_ids' => json_encode($data['skill_ids']),
            'item_count' => $archiveInfo['item_count'],
            'generate_user_id' => $user['id'],
            'status' => 1,
            'generated_at' => date('Y-m-d H:i:s'),
        ]);

        logWrite('info', '生成技艺PDF归档', [
            'archive_id' => $archiveId,
            'archive_no' => $archiveInfo['archive_no'],
            'skill_count' => count($skills),
            'user_id' => $user['id'],
        ]);

        return success([
            'id' => $archiveId,
            'archive_no' => $archiveInfo['archive_no'],
            'title' => $title,
            'item_count' => count($skills),
            'file_size' => $archiveInfo['file_size'],
        ], 'PDF归档生成成功');
    }

    public static function generateGradeArchive(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'pdf:generate')) {
            return error('权限不足', 403);
        }

        if (empty($data['grade_ids']) && empty($data['skill_ids'])) {
            return error('请选择要归档的定级结果');
        }

        $db = Database::getInstance();
        
        if (!empty($data['grade_ids'])) {
            $placeholders = str_repeat('?,', count($data['grade_ids']) - 1) . '?';
            $grades = $db->fetchAll("
                SELECT g.*, s.name as skill_name, h.name as heritor_name
                FROM skill_grades g
                LEFT JOIN heritage_skills s ON g.skill_id = s.id
                LEFT JOIN heritors h ON s.heritor_id = h.id
                WHERE g.id IN ({$placeholders})
            ", $data['grade_ids']);
        } else {
            $placeholders = str_repeat('?,', count($data['skill_ids']) - 1) . '?';
            $grades = $db->fetchAll("
                SELECT g.*, s.name as skill_name, h.name as heritor_name
                FROM skill_grades g
                LEFT JOIN heritage_skills s ON g.skill_id = s.id
                LEFT JOIN heritors h ON s.heritor_id = h.id
                WHERE g.skill_id IN ({$placeholders})
            ", $data['skill_ids']);
        }

        if (empty($grades)) {
            return error('未找到符合条件的定级数据');
        }

        $title = $data['title'] ?? '技艺定级结果汇总归档_' . date('Ymd');
        $archiveInfo = PdfGenerator::generateGradeArchive($grades, $title);

        $archiveId = $db->insert('pdf_archives', [
            'archive_no' => $archiveInfo['archive_no'],
            'archive_type' => 'grade',
            'title' => $title,
            'file_path' => $archiveInfo['file_path'],
            'file_size' => $archiveInfo['file_size'],
            'file_hash' => $archiveInfo['file_hash'],
            'item_ids' => json_encode(array_column($grades, 'id')),
            'item_count' => $archiveInfo['item_count'],
            'generate_user_id' => $user['id'],
            'status' => 1,
            'generated_at' => date('Y-m-d H:i:s'),
        ]);

        return success([
            'id' => $archiveId,
            'archive_no' => $archiveInfo['archive_no'],
            'title' => $title,
            'item_count' => count($grades),
        ], 'PDF归档生成成功');
    }

    public static function generateHeritorArchive(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'pdf:generate')) {
            return error('权限不足', 403);
        }

        if (empty($data['heritor_ids']) || !is_array($data['heritor_ids'])) {
            return error('请选择要归档的传承人');
        }

        $db = Database::getInstance();
        $placeholders = str_repeat('?,', count($data['heritor_ids']) - 1) . '?';
        
        $heritors = $db->fetchAll("
            SELECT h.*, s.name as skill_name
            FROM heritors h
            LEFT JOIN heritage_skills s ON h.skill_id = s.id
            WHERE h.id IN ({$placeholders})
        ", $data['heritor_ids']);

        if (empty($heritors)) {
            return error('未找到符合条件的传承人数据');
        }

        $title = $data['title'] ?? '传承人资质归档_' . date('Ymd');
        $archiveInfo = PdfGenerator::generateHeritorArchive($heritors, $title);

        $archiveId = $db->insert('pdf_archives', [
            'archive_no' => $archiveInfo['archive_no'],
            'archive_type' => 'heritor',
            'title' => $title,
            'file_path' => $archiveInfo['file_path'],
            'file_size' => $archiveInfo['file_size'],
            'file_hash' => $archiveInfo['file_hash'],
            'item_ids' => json_encode($data['heritor_ids']),
            'item_count' => $archiveInfo['item_count'],
            'generate_user_id' => $user['id'],
            'status' => 1,
            'generated_at' => date('Y-m-d H:i:s'),
        ]);

        return success([
            'id' => $archiveId,
            'archive_no' => $archiveInfo['archive_no'],
            'title' => $title,
            'item_count' => count($heritors),
        ], 'PDF归档生成成功');
    }

    public static function getList(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'pdf:view')) {
            return error('权限不足', 403);
        }

        $db = Database::getInstance();
        $page = max(1, intval($data['page'] ?? 1));
        $pageSize = min(100, max(10, intval($data['page_size'] ?? 20)));
        $offset = ($page - 1) * $pageSize;

        $where = ['p.status = 1'];
        $params = [];

        if (!empty($data['archive_type'])) {
            $where[] = 'p.archive_type = ?';
            $params[] = $data['archive_type'];
        }
        if (!empty($data['keyword'])) {
            $where[] = 'p.title LIKE ?';
            $params[] = '%' . $data['keyword'] . '%';
        }
        if (!empty($data['start_date'])) {
            $where[] = 'DATE(p.created_at) >= ?';
            $params[] = $data['start_date'];
        }
        if (!empty($data['end_date'])) {
            $where[] = 'DATE(p.created_at) <= ?';
            $params[] = $data['end_date'];
        }

        $whereClause = implode(' AND ', $where);

        $total = $db->fetchColumn("
            SELECT COUNT(*) FROM pdf_archives p WHERE {$whereClause}
        ", $params);

        $list = $db->fetchAll("
            SELECT p.*, u.real_name as generate_user_name
            FROM pdf_archives p
            LEFT JOIN system_users u ON p.generate_user_id = u.id
            WHERE {$whereClause}
            ORDER BY p.id DESC
            LIMIT {$offset}, {$pageSize}
        ", $params);

        foreach ($list as &$item) {
            $item['file_size_formatted'] = self::formatFileSize($item['file_size']);
        }

        return success(paginate($page, $pageSize, $total, $list));
    }

    public static function download(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'pdf:download')) {
            return error('权限不足', 403);
        }

        if (empty($data['id']) && empty($data['archive_no'])) {
            return error('归档ID或编号不能为空');
        }

        $db = Database::getInstance();
        if (!empty($data['id'])) {
            $archive = $db->fetchOne("SELECT * FROM pdf_archives WHERE id = ? AND status = 1", [$data['id']]);
        } else {
            $archive = $db->fetchOne("SELECT * FROM pdf_archives WHERE archive_no = ? AND status = 1", [$data['archive_no']]);
        }

        if (!$archive) {
            return error('归档文件不存在或已失效');
        }

        $storagePath = PdfGenerator::getStoragePath();
        $fullPath = $storagePath . $archive['file_path'];

        if (!file_exists($fullPath)) {
            return error('PDF文件不存在');
        }

        $db->query("UPDATE pdf_archives SET download_count = download_count + 1 WHERE id = ?", [$archive['id']]);

        return [
            'type' => 'file',
            'filepath' => $fullPath,
            'filename' => $archive['title'] . '.pdf',
            'delete_after' => false,
        ];
    }

    public static function batchDownload(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'pdf:download')) {
            return error('权限不足', 403);
        }

        if (empty($data['archive_nos']) || !is_array($data['archive_nos'])) {
            return error('请选择要下载的归档');
        }

        try {
            $zipInfo = PdfGenerator::batchZipArchives($data['archive_nos'], $data['zip_name'] ?? '');
            
            return [
                'type' => 'file',
                'filepath' => $zipInfo['zip_path'],
                'filename' => '批量归档_' . date('YmdHis') . '.zip',
                'delete_after' => true,
            ];
        } catch (\Exception $e) {
            return error('批量打包失败: ' . $e->getMessage());
        }
    }

    public static function delete(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'pdf:delete')) {
            return error('权限不足', 403);
        }

        if (empty($data['ids']) || !is_array($data['ids'])) {
            return error('请选择要删除的归档');
        }

        $db = Database::getInstance();
        $storagePath = PdfGenerator::getStoragePath();
        $deleteCount = 0;

        foreach ($data['ids'] as $id) {
            $archive = $db->fetchOne("SELECT * FROM pdf_archives WHERE id = ?", [$id]);
            if ($archive) {
                $fullPath = $storagePath . $archive['file_path'];
                @unlink($fullPath);
                $db->query("UPDATE pdf_archives SET status = 0 WHERE id = ?", [$id]);
                $deleteCount++;
            }
        }

        return success(['deleted_count' => $deleteCount], '删除成功');
    }

    private static function formatFileSize(int $bytes): string
    {
        $units = ['B', 'KB', 'MB', 'GB'];
        $bytes = max($bytes, 0);
        $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
        $pow = min($pow, count($units) - 1);
        $bytes /= pow(1024, $pow);
        return round($bytes, 2) . ' ' . $units[$pow];
    }
}
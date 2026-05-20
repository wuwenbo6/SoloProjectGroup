<?php
namespace Modules\video;

use Swoole\Http\Request;
use Core\Database;
use Middleware\AuthMiddleware;
use Utils\VideoEncryption;
use Utils\Crypto;

class VideoController
{
    public static function upload(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'video:upload')) {
            return error('权限不足', 403);
        }

        if (empty($data['skill_id']) || empty($data['process_id'])) {
            return error('技艺ID和工序ID不能为空');
        }

        $db = Database::getInstance();
        
        $skill = $db->fetchOne("SELECT id, name FROM heritage_skills WHERE id = ?", [$data['skill_id']]);
        if (!$skill) {
            return error('技艺信息不存在');
        }

        $process = $db->fetchOne("SELECT id, name FROM skill_processes WHERE id = ?", [$data['process_id']]);
        if (!$process) {
            return error('工序信息不存在');
        }

        $files = $request->files ?? [];
        if (empty($files['video'])) {
            return error('请选择要上传的视频文件');
        }

        $file = $files['video'];
        if ($file['error'] !== UPLOAD_ERR_OK) {
            return error('文件上传失败，错误码: ' . $file['error']);
        }

        $maxSize = VideoEncryption::getMaxSize();
        if ($file['size'] > $maxSize) {
            return error('文件大小超过限制，最大允许' . round($maxSize / 1024 / 1024, 2) . 'MB');
        }

        $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
        if (!VideoEncryption::isAllowedFormat($extension)) {
            return error('不支持的视频格式');
        }

        $videoNo = VideoEncryption::generateVideoNo();
        $storagePath = VideoEncryption::getStoragePath();
        $relativePath = date('Y/m/d/') . $videoNo . '.dat';
        $destPath = $storagePath . $relativePath;
        
        if (!is_dir(dirname($destPath))) {
            mkdir(dirname($destPath), 0755, true);
        }

        $encryptionKey = VideoEncryption::generateEncryptionKey();
        $encryptSuccess = VideoEncryption::encryptFile($file['tmp_name'], $destPath, $encryptionKey);
        
        if (!$encryptSuccess) {
            @unlink($file['tmp_name']);
            return error('视频加密存储失败');
        }

        $fileHash = VideoEncryption::calculateFileHash($destPath);
        $encryptedKey = Crypto::encrypt($encryptionKey);

        $videoId = $db->insert('process_videos', [
            'video_no' => $videoNo,
            'skill_id' => $data['skill_id'],
            'process_id' => $data['process_id'],
            'original_name' => $file['name'],
            'file_path' => $relativePath,
            'file_size' => $file['size'],
            'file_hash' => $fileHash,
            'encryption_key' => $encryptedKey,
            'video_format' => $extension,
            'video_duration' => $data['duration'] ?? 0,
            'video_resolution' => $data['resolution'] ?? '',
            'thumbnail_path' => $data['thumbnail_path'] ?? '',
            'description' => $data['description'] ?? '',
            'upload_user_id' => $user['id'],
            'status' => 1,
        ]);

        @unlink($file['tmp_name']);

        logWrite('info', '工序视频上传成功', [
            'video_id' => $videoId,
            'video_no' => $videoNo,
            'skill_id' => $data['skill_id'],
            'process_id' => $data['process_id'],
            'user_id' => $user['id'],
        ]);

        return success([
            'id' => $videoId,
            'video_no' => $videoNo,
            'original_name' => $file['name'],
            'file_size' => $file['size'],
            'file_hash' => $fileHash,
        ], '视频上传加密成功');
    }

    public static function getList(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'video:view')) {
            return error('权限不足', 403);
        }

        $db = Database::getInstance();
        $page = max(1, intval($data['page'] ?? 1));
        $pageSize = min(100, max(10, intval($data['page_size'] ?? 20)));
        $offset = ($page - 1) * $pageSize;

        $where = ['v.status = 1'];
        $params = [];

        if (!empty($data['skill_id'])) {
            $where[] = 'v.skill_id = ?';
            $params[] = $data['skill_id'];
        }
        if (!empty($data['process_id'])) {
            $where[] = 'v.process_id = ?';
            $params[] = $data['process_id'];
        }
        if (!empty($data['keyword'])) {
            $where[] = 'v.original_name LIKE ?';
            $params[] = '%' . $data['keyword'] . '%';
        }

        $whereClause = implode(' AND ', $where);

        $total = $db->fetchColumn("
            SELECT COUNT(*) FROM process_videos v WHERE {$whereClause}
        ", $params);

        $list = $db->fetchAll("
            SELECT v.*, s.name as skill_name, p.name as process_name, u.real_name as upload_user_name
            FROM process_videos v
            LEFT JOIN heritage_skills s ON v.skill_id = s.id
            LEFT JOIN skill_processes p ON v.process_id = p.id
            LEFT JOIN system_users u ON v.upload_user_id = u.id
            WHERE {$whereClause}
            ORDER BY v.id DESC
            LIMIT {$offset}, {$pageSize}
        ", $params);

        foreach ($list as &$item) {
            $item['file_size_formatted'] = self::formatFileSize($item['file_size']);
            $item['duration_formatted'] = self::formatDuration($item['video_duration']);
            unset($item['encryption_key']);
        }

        return success(paginate($page, $pageSize, $total, $list));
    }

    public static function getDetail(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'video:view')) {
            return error('权限不足', 403);
        }

        if (empty($data['id']) && empty($data['video_no'])) {
            return error('视频ID或编号不能为空');
        }

        $db = Database::getInstance();
        if (!empty($data['id'])) {
            $video = $db->fetchOne("
                SELECT v.*, s.name as skill_name, p.name as process_name
                FROM process_videos v
                LEFT JOIN heritage_skills s ON v.skill_id = s.id
                LEFT JOIN skill_processes p ON v.process_id = p.id
                WHERE v.id = ?
            ", [$data['id']]);
        } else {
            $video = $db->fetchOne("
                SELECT v.*, s.name as skill_name, p.name as process_name
                FROM process_videos v
                LEFT JOIN heritage_skills s ON v.skill_id = s.id
                LEFT JOIN skill_processes p ON v.process_id = p.id
                WHERE v.video_no = ?
            ", [$data['video_no']]);
        }

        if (!$video) {
            return error('视频不存在');
        }

        $video['file_size_formatted'] = self::formatFileSize($video['file_size']);
        $video['duration_formatted'] = self::formatDuration($video['video_duration']);
        unset($video['encryption_key']);

        $db->query("UPDATE process_videos SET view_count = view_count + 1 WHERE id = ?", [$video['id']]);

        return success($video);
    }

    public static function stream(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'video:view')) {
            return error('权限不足', 403);
        }

        if (empty($data['id'])) {
            return error('视频ID不能为空');
        }

        $db = Database::getInstance();
        $video = $db->fetchOne("SELECT * FROM process_videos WHERE id = ? AND status = 1", [$data['id']]);
        if (!$video) {
            return error('视频不存在或已禁用');
        }

        $storagePath = VideoEncryption::getStoragePath();
        $fullPath = $storagePath . $video['file_path'];

        if (!file_exists($fullPath)) {
            return error('视频文件不存在');
        }

        $decryptionKey = Crypto::decrypt($video['encryption_key']);
        $streamFn = VideoEncryption::getStreamDecryptor($fullPath, $decryptionKey);

        if (!$streamFn) {
            return error('视频解密失败');
        }

        $db->query("UPDATE process_videos SET view_count = view_count + 1 WHERE id = ?", [$video['id']]);

        return [
            'type' => 'stream',
            'stream_fn' => $streamFn,
            'filename' => $video['original_name'],
            'file_size' => $video['file_size'],
        ];
    }

    public static function download(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'video:download')) {
            return error('权限不足', 403);
        }

        if (empty($data['id'])) {
            return error('视频ID不能为空');
        }

        $db = Database::getInstance();
        $video = $db->fetchOne("SELECT * FROM process_videos WHERE id = ? AND status = 1", [$data['id']]);
        if (!$video) {
            return error('视频不存在或已禁用');
        }

        $storagePath = VideoEncryption::getStoragePath();
        $encryptedPath = $storagePath . $video['file_path'];
        $tempPath = sys_get_temp_dir() . '/' . uniqid('video_') . '.' . pathinfo($video['original_name'], PATHINFO_EXTENSION);

        $decryptionKey = Crypto::decrypt($video['encryption_key']);
        if (!VideoEncryption::decryptFile($encryptedPath, $tempPath, $decryptionKey)) {
            @unlink($tempPath);
            return error('视频解密失败');
        }

        $db->query("UPDATE process_videos SET download_count = download_count + 1 WHERE id = ?", [$video['id']]);

        return [
            'type' => 'file',
            'filepath' => $tempPath,
            'filename' => $video['original_name'],
            'delete_after' => true,
        ];
    }

    public static function delete(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'video:delete')) {
            return error('权限不足', 403);
        }

        if (empty($data['ids']) || !is_array($data['ids'])) {
            return error('请选择要删除的视频');
        }

        $db = Database::getInstance();
        $storagePath = VideoEncryption::getStoragePath();
        $deleteCount = 0;

        foreach ($data['ids'] as $id) {
            $video = $db->fetchOne("SELECT * FROM process_videos WHERE id = ?", [$id]);
            if ($video) {
                $fullPath = $storagePath . $video['file_path'];
                @unlink($fullPath);
                $db->query("DELETE FROM process_videos WHERE id = ?", [$id]);
                $deleteCount++;
            }
        }

        logWrite('info', '批量删除视频', [
            'count' => $deleteCount,
            'user_id' => $user['id'],
        ]);

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

    private static function formatDuration(?int $seconds): string
    {
        if (!$seconds) {
            return '00:00';
        }
        $h = floor($seconds / 3600);
        $m = floor(($seconds % 3600) / 60);
        $s = $seconds % 60;
        if ($h > 0) {
            return sprintf('%02d:%02d:%02d', $h, $m, $s);
        }
        return sprintf('%02d:%02d', $m, $s);
    }
}
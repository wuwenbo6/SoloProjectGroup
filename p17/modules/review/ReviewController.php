<?php
namespace Modules\review;

use Swoole\Http\Request;
use Core\Database;
use Core\TaskScheduler;
use Middleware\AuthMiddleware;

class ReviewController
{
    public static function createReview(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'review:create')) {
            return error('权限不足', 403);
        }

        if (empty($data['skill_id'])) {
            return error('技艺ID不能为空');
        }

        $result = AutoReviewHandler::createReviewTask(
            $data['skill_id'],
            $data['review_type'] ?? 'regular',
            $data['review_cycle'] ?? 'annual'
        );

        if ($result['success']) {
            return success($result, '复审任务创建成功');
        }
        return error($result['message']);
    }

    public static function batchCreateReview(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'review:create')) {
            return error('权限不足', 403);
        }

        if (empty($data['skill_ids']) || !is_array($data['skill_ids'])) {
            return error('技艺ID列表不能为空');
        }

        $result = AutoReviewHandler::batchCreateReviewTasks(
            $data['skill_ids'],
            $data['review_type'] ?? 'regular'
        );

        return success($result, '批量创建完成');
    }

    public static function getReviewList(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'review:view')) {
            return error('权限不足', 403);
        }

        $db = Database::getInstance();
        $page = max(1, intval($data['page'] ?? 1));
        $pageSize = min(100, max(10, intval($data['page_size'] ?? 20)));
        $offset = ($page - 1) * $pageSize;

        $where = ['1=1'];
        $params = [];

        if (!empty($data['skill_id'])) {
            $where[] = 'sr.skill_id = ?';
            $params[] = $data['skill_id'];
        }
        if (!empty($data['review_status']) || $data['review_status'] === '0') {
            $where[] = 'sr.review_status = ?';
            $params[] = $data['review_status'];
        }
        if (!empty($data['review_type'])) {
            $where[] = 'sr.review_type = ?';
            $params[] = $data['review_type'];
        }
        if (!empty($data['auto_review']) || $data['auto_review'] === '0') {
            $where[] = 'sr.auto_review = ?';
            $params[] = $data['auto_review'];
        }
        if (!empty($data['start_date'])) {
            $where[] = 'DATE(sr.created_at) >= ?';
            $params[] = $data['start_date'];
        }
        if (!empty($data['end_date'])) {
            $where[] = 'DATE(sr.created_at) <= ?';
            $params[] = $data['end_date'];
        }

        $whereClause = implode(' AND ', $where);

        $total = $db->fetchColumn("
            SELECT COUNT(*) 
            FROM skill_reviews sr 
            WHERE {$whereClause}
        ", $params);

        $list = $db->fetchAll("
            SELECT sr.*, s.skill_no, s.category_id,
                   u.real_name as reviewer_name
            FROM skill_reviews sr
            LEFT JOIN heritage_skills s ON sr.skill_id = s.id
            LEFT JOIN system_users u ON sr.reviewer_id = u.id
            WHERE {$whereClause}
            ORDER BY sr.id DESC
            LIMIT {$offset}, {$pageSize}
        ", $params);

        return success(paginate($page, $pageSize, $total, $list));
    }

    public static function getReviewDetail(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'review:view')) {
            return error('权限不足', 403);
        }

        if (empty($data['id']) && empty($data['review_no'])) {
            return error('复审ID或编号不能为空');
        }

        $db = Database::getInstance();
        if (!empty($data['id'])) {
            $review = $db->fetchOne("
                SELECT sr.*, s.skill_no, s.description as skill_description,
                       s.category_id, s.origin_area, s.origin_city,
                       u.real_name as reviewer_name
                FROM skill_reviews sr
                LEFT JOIN heritage_skills s ON sr.skill_id = s.id
                LEFT JOIN system_users u ON sr.reviewer_id = u.id
                WHERE sr.id = ?
            ", [$data['id']]);
        } else {
            $review = $db->fetchOne("
                SELECT sr.*, s.skill_no, s.description as skill_description,
                       s.category_id, s.origin_area, s.origin_city,
                       u.real_name as reviewer_name
                FROM skill_reviews sr
                LEFT JOIN heritage_skills s ON sr.skill_id = s.id
                LEFT JOIN system_users u ON sr.reviewer_id = u.id
                WHERE sr.review_no = ?
            ", [$data['review_no']]);
        }

        if (!$review) {
            return error('复审记录不存在');
        }

        if (!empty($review['auto_review_result'])) {
            $review['auto_review_result'] = json_decode($review['auto_review_result'], true);
        }

        return success($review);
    }

    public static function manualReview(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'review:audit')) {
            return error('权限不足', 403);
        }

        if (empty($data['id'])) {
            return error('复审ID不能为空');
        }
        if (!isset($data['review_status'])) {
            return error('审核状态不能为空');
        }

        $db = Database::getInstance();
        $review = $db->fetchOne("SELECT * FROM skill_reviews WHERE id = ?", [$data['id']]);
        if (!$review) {
            return error('复审记录不存在');
        }

        $db->query("
            UPDATE skill_reviews 
            SET review_status = ?,
                review_score = ?,
                review_opinion = ?,
                reviewer_id = ?,
                reviewer_name = ?,
                reviewed_at = NOW(),
                next_review_date = ?
            WHERE id = ?
        ", [
            $data['review_status'],
            $data['review_score'] ?? null,
            $data['review_opinion'] ?? '',
            $user['id'],
            $user['real_name'] ?? '',
            $data['next_review_date'] ?? null,
            $data['id'],
        ]);

        return success(['id' => $data['id']], '审核完成');
    }

    public static function triggerAutoReview(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'review:audit')) {
            return error('权限不足', 403);
        }

        $result = AutoReviewHandler::execute();
        return success($result, '自动复审已触发');
    }

    public static function getReviewStats(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'review:view')) {
            return error('权限不足', 403);
        }

        $stats = AutoReviewHandler::getPendingReviewStats();
        return success($stats);
    }
}
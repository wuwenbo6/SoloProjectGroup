<?php
namespace Modules\review;

use Core\Database;

class AutoReviewHandler
{
    const REVIEW_PASS = 2;
    const REVIEW_FAIL = 3;
    const REVIEW_RECTIFY = 4;

    const PASS_SCORE = 80;
    const RECTIFY_SCORE = 60;

    public static function execute(array $params = []): array
    {
        $db = Database::getInstance();
        $today = date('Y-m-d');

        $pendingReviews = $db->fetchAll("
            SELECT sr.*, s.name as skill_name, s.total_score, s.level as skill_level,
                   s.last_review_date, s.review_cycle, s.auto_review_enabled
            FROM skill_reviews sr
            LEFT JOIN heritage_skills s ON sr.skill_id = s.id
            WHERE sr.review_status = 0 
            AND sr.auto_review = 1
            AND sr.next_review_date <= ?
            LIMIT 50
        ", [$today]);

        $results = [
            'total' => count($pendingReviews),
            'passed' => 0,
            'failed' => 0,
            'rectify' => 0,
            'errors' => [],
        ];

        foreach ($pendingReviews as $review) {
            try {
                $reviewResult = self::performAutoReview($review);

                $db->query("
                    UPDATE skill_reviews 
                    SET review_status = ?,
                        review_score = ?,
                        review_opinion = ?,
                        auto_review_result = ?,
                        reviewed_at = NOW(),
                        next_review_date = ?
                    WHERE id = ?
                ", [
                    $reviewResult['status'],
                    $reviewResult['score'],
                    $reviewResult['opinion'],
                    json_encode($reviewResult['details']),
                    $reviewResult['next_review_date'],
                    $review['id'],
                ]);

                if ($reviewResult['status'] === self::REVIEW_PASS) {
                    $results['passed']++;
                } elseif ($reviewResult['status'] === self::REVIEW_FAIL) {
                    $results['failed']++;
                } else {
                    $results['rectify']++;
                }

            } catch (\Exception $e) {
                $results['errors'][] = [
                    'review_id' => $review['id'],
                    'skill_id' => $review['skill_id'],
                    'error' => $e->getMessage(),
                ];
            }
        }

        logWrite('info', '自动复审任务执行完成', $results);

        return $results;
    }

    private static function performAutoReview(array $review): array
    {
        $db = Database::getInstance();
        $skillId = $review['skill_id'];

        $reviewDetails = [
            'basic_info_check' => true,
            'basic_info_score' => 0,
            'process_complete_rate' => 0,
            'process_score' => 0,
            'heritor_active_rate' => 0,
            'heritor_score' => 0,
            'activity_score' => 0,
            'standard_compliance_rate' => 0,
            'standard_score' => 0,
            'video_material_score' => 0,
            'penalty_points' => 0,
        ];

        $basicInfo = $db->fetchOne("
            SELECT name, description, origin_area, level, status
            FROM heritage_skills 
            WHERE id = ?
        ", [$skillId]);

        $basicScore = 0;
        if (!empty($basicInfo['name'])) {
            $basicScore += 5;
        }
        if (!empty($basicInfo['description']) && mb_strlen($basicInfo['description']) > 50) {
            $basicScore += 10;
        }
        if (!empty($basicInfo['origin_area'])) {
            $basicScore += 5;
        }
        $reviewDetails['basic_info_score'] = $basicScore;
        $reviewDetails['basic_info_check'] = $basicScore >= 15;

        $processStats = $db->fetchOne("
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as active,
                   AVG(actual_score) as avg_score
            FROM skill_processes 
            WHERE skill_id = ?
        ", [$skillId]);

        $processTotal = $processStats['total'] ?? 0;
        $processActive = $processStats['active'] ?? 0;
        $processCompleteRate = $processTotal > 0 ? ($processActive / $processTotal) * 100 : 0;

        $reviewDetails['process_complete_rate'] = round($processCompleteRate, 2);
        $reviewDetails['process_score'] = $processTotal >= 5 ? 20 : ($processTotal * 4);

        $heritorStats = $db->fetchOne("
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as active
            FROM heritors 
            WHERE skill_id = ?
        ", [$skillId]);

        $heritorTotal = $heritorStats['total'] ?? 0;
        $heritorActive = $heritorStats['active'] ?? 0;
        $heritorActiveRate = $heritorTotal > 0 ? ($heritorActive / $heritorTotal) * 100 : 0;

        $reviewDetails['heritor_active_rate'] = round($heritorActiveRate, 2);
        $reviewDetails['heritor_score'] = $heritorActiveRate >= 80 ? 15 : ($heritorActiveRate * 0.15);

        $activityStats = $db->fetchOne("
            SELECT COUNT(*) as activity_count
            FROM skill_activities 
            WHERE skill_id = ? 
            AND created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)
        ", [$skillId]);

        $activityCount = $activityStats['activity_count'] ?? 0;
        $reviewDetails['activity_score'] = min(20, $activityCount * 5);

        $standardStats = $db->fetchOne("
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN compliance_status = 1 THEN 1 ELSE 0 END) as compliant
            FROM skill_standard_checks 
            WHERE skill_id = ?
            AND check_date >= DATE_SUB(NOW(), INTERVAL 1 YEAR)
        ", [$skillId]);

        $standardTotal = $standardStats['total'] ?? 0;
        $standardCompliant = $standardStats['compliant'] ?? 0;
        $standardComplianceRate = $standardTotal > 0 ? ($standardCompliant / $standardTotal) * 100 : 100;

        $reviewDetails['standard_compliance_rate'] = round($standardComplianceRate, 2);
        $reviewDetails['standard_score'] = $standardComplianceRate >= 90 ? 15 : ($standardComplianceRate * 0.15);

        $videoStats = $db->fetchOne("
            SELECT COUNT(*) as video_count
            FROM process_videos 
            WHERE skill_id = ? AND status = 1
        ", [$skillId]);

        $videoCount = $videoStats['video_count'] ?? 0;
        $reviewDetails['video_material_score'] = min(15, $videoCount * 5);

        $penaltyPoints = self::checkPenaltyPoints($skillId);
        $reviewDetails['penalty_points'] = $penaltyPoints;

        $totalScore = array_sum([
            $reviewDetails['basic_info_score'],
            $reviewDetails['process_score'],
            $reviewDetails['heritor_score'],
            $reviewDetails['activity_score'],
            $reviewDetails['standard_score'],
            $reviewDetails['video_material_score'],
        ]) - $penaltyPoints;

        $totalScore = max(0, min(100, $totalScore));

        if ($totalScore >= self::PASS_SCORE) {
            $status = self::REVIEW_PASS;
            $opinion = "自动复审通过。综合得分：{$totalScore}分。各项指标符合非遗技艺存续标准。";
        } elseif ($totalScore >= self::RECTIFY_SCORE) {
            $status = self::REVIEW_RECTIFY;
            $opinion = "自动复审需整改。综合得分：{$totalScore}分。请针对低分项目进行整改后重新提交审核。";
        } else {
            $status = self::REVIEW_FAIL;
            $opinion = "自动复审不通过。综合得分：{$totalScore}分。技艺存续状况未达到最低标准要求。";
        }

        $nextReviewDate = self::calculateNextReviewDate($review['review_cycle'] ?? 'annual');

        return [
            'score' => $totalScore,
            'status' => $status,
            'opinion' => $opinion,
            'details' => $reviewDetails,
            'next_review_date' => $nextReviewDate,
        ];
    }

    private static function checkPenaltyPoints(int $skillId): int
    {
        $db = Database::getInstance();
        $penalty = 0;

        $pendingComplaints = $db->fetchColumn("
            SELECT COUNT(*) 
            FROM skill_complaints 
            WHERE skill_id = ? AND status = 0
        ", [$skillId]);

        if ($pendingComplaints > 0) {
            $penalty += 5;
        }

        $heritorIssue = $db->fetchColumn("
            SELECT COUNT(*) 
            FROM heritor_reports 
            WHERE skill_id = ? AND status IN (0, 1)
        ", [$skillId]);

        if ($heritorIssue > 0) {
            $penalty += 10;
        }

        return $penalty;
    }

    private static function calculateNextReviewDate(string $cycle): string
    {
        $intervals = [
            'annual' => '+1 year',
            'biennial' => '+2 years',
            'triennial' => '+3 years',
            'semiannual' => '+6 months',
            'quarterly' => '+3 months',
        ];

        $interval = $intervals[$cycle] ?? '+1 year';
        return date('Y-m-d', strtotime($interval));
    }

    public static function createReviewTask(int $skillId, string $reviewType = 'regular', string $cycle = 'annual'): array
    {
        $db = Database::getInstance();

        $skill = $db->fetchOne("SELECT id, name, level FROM heritage_skills WHERE id = ?", [$skillId]);
        if (!$skill) {
            return ['success' => false, 'message' => '技艺不存在'];
        }

        $reviewNo = 'REV' . date('YmdHis') . str_pad(rand(0, 9999), 4, '0', STR_PAD_LEFT);
        $nextReviewDate = self::calculateNextReviewDate($cycle);

        $id = $db->insert('skill_reviews', [
            'review_no' => $reviewNo,
            'skill_id' => $skillId,
            'skill_name' => $skill['name'],
            'current_level' => $skill['level'],
            'review_type' => $reviewType,
            'review_cycle' => $cycle,
            'review_status' => 0,
            'auto_review' => 1,
            'next_review_date' => $nextReviewDate,
        ]);

        return [
            'success' => true,
            'review_id' => $id,
            'review_no' => $reviewNo,
            'next_review_date' => $nextReviewDate,
        ];
    }

    public static function batchCreateReviewTasks(array $skillIds, string $reviewType = 'regular'): array
    {
        $results = [
            'total' => count($skillIds),
            'success' => 0,
            'failed' => 0,
            'tasks' => [],
        ];

        foreach ($skillIds as $skillId) {
            $result = self::createReviewTask($skillId, $reviewType);
            if ($result['success']) {
                $results['success']++;
                $results['tasks'][] = $result;
            } else {
                $results['failed']++;
            }
        }

        return $results;
    }

    public static function getPendingReviewStats(): array
    {
        $db = Database::getInstance();

        $stats = $db->fetchAll("
            SELECT review_status, COUNT(*) as count,
                   GROUP_CONCAT(DISTINCT review_type) as types
            FROM skill_reviews 
            GROUP BY review_status
        ");

        $todayPending = $db->fetchColumn("
            SELECT COUNT(*) 
            FROM skill_reviews 
            WHERE review_status = 0 
            AND next_review_date <= CURDATE()
        ");

        $autoReviewCount = $db->fetchColumn("
            SELECT COUNT(*) 
            FROM skill_reviews 
            WHERE review_status = 0 AND auto_review = 1
        ");

        return [
            'by_status' => $stats,
            'today_pending' => $todayPending,
            'auto_review_count' => $autoReviewCount,
        ];
    }
}
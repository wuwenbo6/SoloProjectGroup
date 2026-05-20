<?php
namespace Modules\process;

use Swoole\Http\Request;
use Core\Database;
use Middleware\AuthMiddleware;
use Utils\BcMath;

class ProcessController
{
    private static $levelThresholds = [
        1 => ['min' => 90, 'name' => '国家级'],
        2 => ['min' => 80, 'name' => '省级'],
        3 => ['min' => 70, 'name' => '市级'],
        4 => ['min' => 60, 'name' => '县级'],
    ];

    public static function createScore(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'process:score')) {
            return error('权限不足', 403);
        }

        $requiredError = validateRequired($data, ['process_id', 'skill_id', 'item_name', 'standard_score', 'actual_score']);
        if ($requiredError) {
            return error($requiredError);
        }

        $db = Database::getInstance();

        $process = $db->fetchOne("SELECT id FROM skill_processes WHERE id = ?", [$data['process_id']]);
        if (!$process) {
            return error('工序信息不存在');
        }

        $scoreNo = 'SCR' . date('YmdHis') . rand(1000, 9999);

        $scoreId = $db->insert('process_scores', [
            'process_id' => $data['process_id'],
            'skill_id' => $data['skill_id'],
            'score_no' => $scoreNo,
            'item_name' => $data['item_name'],
            'standard_score' => $data['standard_score'],
            'actual_score' => $data['actual_score'],
            'weight' => $data['weight'] ?? 1.00,
            'judge_user_id' => $user['id'],
            'judge_comment' => $data['judge_comment'] ?? '',
            'status' => 1,
            'judged_at' => date('Y-m-d H:i:s'),
        ]);

        logWrite('info', '工序评分成功', [
            'score_id' => $scoreId,
            'process_id' => $data['process_id'],
            'user_id' => $user['id'],
        ]);

        return success([
            'id' => $scoreId,
            'score_no' => $scoreNo,
        ], '评分记录创建成功');
    }

    public static function getScoreList(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'process:view')) {
            return error('权限不足', 403);
        }

        if (empty($data['skill_id']) && empty($data['process_id'])) {
            return error('技艺ID或工序ID不能为空');
        }

        $db = Database::getInstance();
        $where = [];
        $params = [];

        if (!empty($data['skill_id'])) {
            $where[] = 'skill_id = ?';
            $params[] = $data['skill_id'];
        }
        if (!empty($data['process_id'])) {
            $where[] = 'process_id = ?';
            $params[] = $data['process_id'];
        }

        $whereClause = implode(' AND ', $where);
        $list = $db->fetchAll("
            SELECT s.*, p.name as process_name, u.real_name as judge_user_name
            FROM process_scores s
            LEFT JOIN skill_processes p ON s.process_id = p.id
            LEFT JOIN system_users u ON s.judge_user_id = u.id
            WHERE {$whereClause}
            ORDER BY s.id DESC
        ", $params);

        $statusMap = [0 => '未评定', 1 => '已评分', 2 => '已确认'];
        foreach ($list as &$item) {
            $item['status_text'] = $statusMap[$item['status']] ?? '未知';
            $item['score_rate'] = BcMath::percentRate($item['actual_score'], $item['standard_score'], 2);
        }

        return success($list);
    }

    public static function confirmScore(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'process:confirm')) {
            return error('权限不足', 403);
        }

        if (empty($data['ids']) || !is_array($data['ids'])) {
            return error('请选择要确认的评分记录');
        }

        $db = Database::getInstance();

        try {
            $db->beginTransaction();

            foreach ($data['ids'] as $id) {
                $db->update('process_scores', ['status' => 2], 'id = ?', [$id]);
            }

            $db->commit();

            logWrite('info', '批量确认评分成功', [
                'ids' => $data['ids'],
                'user_id' => $user['id'],
            ]);

            return success(null, '批量确认成功');
        } catch (\Exception $e) {
            $db->rollback();
            logWrite('error', '批量确认评分失败', ['error' => $e->getMessage()]);
            return error('确认失败: ' . $e->getMessage());
        }
    }

    public static function calculate(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'process:calculate')) {
            return error('权限不足', 403);
        }

        if (empty($data['skill_id'])) {
            return error('技艺ID不能为空');
        }

        $db = Database::getInstance();
        $skill = $db->fetchOne("SELECT * FROM heritage_skills WHERE id = ?", [$data['skill_id']]);
        if (!$skill) {
            return error('技艺信息不存在');
        }

        $processes = $db->fetchAll("SELECT * FROM skill_processes WHERE skill_id = ? ORDER BY step_number ASC", [$data['skill_id']]);
        if (empty($processes)) {
            return error('该技艺暂无工序信息');
        }

        $scores = $db->fetchAll("SELECT * FROM process_scores WHERE skill_id = ? AND status >= 1", [$data['skill_id']]);

        $processResults = [];
        $totalWeightedScore = 0;
        $totalStandardScore = 0;
        $totalWeight = 0;

        foreach ($processes as $process) {
            $processScores = array_filter($scores, fn($s) => $s['process_id'] == $process['id']);

            $processStandardScore = '0';
            $processActualScore = '0';
            $processWeight = '0';

            foreach ($processScores as $score) {
                $weight = (string)($score['weight'] ?? 1);
                $standardScore = (string)$score['standard_score'];
                $actualScore = (string)$score['actual_score'];
                
                $processStandardScore = BcMath::add($processStandardScore, BcMath::mul($standardScore, $weight));
                $processActualScore = BcMath::add($processActualScore, BcMath::mul($actualScore, $weight));
                $processWeight = BcMath::add($processWeight, $weight);
            }

            if ($process['is_key_process']) {
                $keyMultiplier = '1.5';
                $processStandardScore = BcMath::mul($processStandardScore, $keyMultiplier);
                $processActualScore = BcMath::mul($processActualScore, $keyMultiplier);
                $processWeight = BcMath::mul($processWeight, $keyMultiplier);
            }

            $processRate = BcMath::percentRate($processActualScore, $processStandardScore, 2);

            $processResults[] = [
                'process_id' => $process['id'],
                'process_name' => $process['name'],
                'step_number' => $process['step_number'],
                'is_key_process' => $process['is_key_process'],
                'difficulty_level' => $process['difficulty_level'],
                'standard_score' => BcMath::round($processStandardScore, 2),
                'actual_score' => BcMath::round($processActualScore, 2),
                'score_rate' => $processRate,
                'score_count' => count($processScores),
            ];

            $totalStandardScore = BcMath::add($totalStandardScore, $processStandardScore);
            $totalWeightedScore = BcMath::add($totalWeightedScore, $processActualScore);
            $totalWeight = BcMath::add($totalWeight, $processWeight);
        }

        $overallScoreRate = BcMath::percentRate($totalWeightedScore, $totalStandardScore, 2);

        $calculatedLevel = null;
        $levelName = '';
        foreach (self::$levelThresholds as $level => $threshold) {
            if (BcMath::comp($overallScoreRate, $threshold['min']) >= 0) {
                $calculatedLevel = $level;
                $levelName = $threshold['name'];
                break;
            }
        }

        $result = [
            'skill_id' => $skill['id'],
            'skill_name' => $skill['name'],
            'original_level' => $skill['level'],
            'original_level_name' => self::$levelThresholds[$skill['level']]['name'] ?? '未知',
            'calculated_level' => $calculatedLevel,
            'calculated_level_name' => $levelName,
            'overall_score_rate' => $overallScoreRate,
            'total_standard_score' => BcMath::round($totalStandardScore, 2),
            'total_actual_score' => BcMath::round($totalWeightedScore, 2),
            'process_count' => count($processes),
            'scored_process_count' => count(array_filter($processResults, fn($p) => $p['score_count'] > 0)),
            'process_results' => $processResults,
            'level_upgrade_suggestion' => $calculatedLevel && $calculatedLevel < $skill['level']
                ? '建议进行等级升级评定'
                : '当前等级符合评分结果',
            'calculated_at' => date('Y-m-d H:i:s'),
        ];

        logWrite('info', '工序评分核算完成', [
            'skill_id' => $data['skill_id'],
            'overall_score_rate' => $overallScoreRate,
            'calculated_level' => $calculatedLevel,
        ]);

        return success($result, '核算完成');
    }

    public static function getCalculateResult(array $data, Request $request)
    {
        return self::calculate($data, $request);
    }

    public static function batchScore(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'process:score')) {
            return error('权限不足', 403);
        }

        if (empty($data['scores']) || !is_array($data['scores'])) {
            return error('评分数据不能为空');
        }

        $db = Database::getInstance();

        try {
            $db->beginTransaction();
            $results = [];

            foreach ($data['scores'] as $index => $scoreData) {
                if (empty($scoreData['process_id']) || empty($scoreData['skill_id'])) {
                    continue;
                }

                $scoreNo = 'SCR' . date('YmdHis') . ($index + 1);
                $scoreId = $db->insert('process_scores', [
                    'process_id' => $scoreData['process_id'],
                    'skill_id' => $scoreData['skill_id'],
                    'score_no' => $scoreNo,
                    'item_name' => $scoreData['item_name'] ?? '综合评分',
                    'standard_score' => $scoreData['standard_score'] ?? 100,
                    'actual_score' => $scoreData['actual_score'],
                    'weight' => $scoreData['weight'] ?? 1.00,
                    'judge_user_id' => $user['id'],
                    'judge_comment' => $scoreData['judge_comment'] ?? '',
                    'status' => 1,
                    'judged_at' => date('Y-m-d H:i:s'),
                ]);

                $results[] = [
                    'id' => $scoreId,
                    'score_no' => $scoreNo,
                    'process_id' => $scoreData['process_id'],
                ];
            }

            $db->commit();

            logWrite('info', '批量评分成功', [
                'count' => count($results),
                'user_id' => $user['id'],
            ]);

            return success([
                'count' => count($results),
                'results' => $results,
            ], '批量评分完成');
        } catch (\Exception $e) {
            $db->rollback();
            logWrite('error', '批量评分失败', ['error' => $e->getMessage()]);
            return error('批量评分失败: ' . $e->getMessage());
        }
    }

    public static function getStandardList(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }

        $db = Database::getInstance();
        $where = [];
        $params = [];

        if (!empty($data['standard_type'])) {
            $where[] = 'standard_type = ?';
            $params[] = $data['standard_type'];
        }
        if (!empty($data['category'])) {
            $where[] = 'category = ?';
            $params[] = $data['category'];
        }

        $whereClause = !empty($where) ? implode(' AND ', $where) : '1=1';
        $list = $db->fetchAll("
            SELECT * FROM industry_standards WHERE {$whereClause} AND status = 1 ORDER BY id DESC
        ", $params);

        return success($list);
    }
}

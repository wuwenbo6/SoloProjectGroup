<?php
namespace Modules\skill;

use Swoole\Http\Request;
use Core\Database;
use Middleware\AuthMiddleware;

class CategoryController
{
    public static function getCategoryTree(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }

        $db = Database::getInstance();
        $categories = $db->fetchAll("
            SELECT * FROM skill_categories
            WHERE status = 1
            ORDER BY sort_order ASC, id ASC
        ");

        $tree = self::buildCategoryTree($categories, 0);

        return success([
            'tree' => $tree,
            'total' => count($categories),
        ]);
    }

    public static function getCategoryList(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }

        $db = Database::getInstance();
        $parentId = intval($data['parent_id'] ?? 0);

        $categories = $db->fetchAll("
            SELECT c.*,
                   (SELECT COUNT(*) FROM skill_categories WHERE parent_id = c.id AND status = 1) as child_count,
                   (SELECT COUNT(*) FROM heritage_skills WHERE category_id = c.id AND status = 1) as skill_count
            FROM skill_categories c
            WHERE c.status = 1 AND c.parent_id = ?
            ORDER BY c.sort_order ASC, c.id ASC
        ", [$parentId]);

        return success($categories);
    }

    public static function intelligentFilter(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }

        $db = Database::getInstance();
        $page = max(1, intval($data['page'] ?? 1));
        $pageSize = min(200, max(10, intval($data['page_size'] ?? 20)));
        $offset = ($page - 1) * $pageSize;

        $where = ['s.status = 1'];
        $params = [];

        if (!empty($data['category_id'])) {
            $categoryIds = self::getAllSubCategoryIds($db, $data['category_id']);
            $placeholders = str_repeat('?,', count($categoryIds) - 1) . '?';
            $where[] = "s.category_id IN ({$placeholders})";
            $params = array_merge($params, $categoryIds);
        }

        if (!empty($data['level'])) {
            $levels = is_array($data['level']) ? $data['level'] : [$data['level']];
            $placeholders = str_repeat('?,', count($levels) - 1) . '?';
            $where[] = "s.level IN ({$placeholders})";
            $params = array_merge($params, $levels);
        }

        if (!empty($data['province']) || !empty($data['city']) || !empty($data['area'])) {
            if (!empty($data['province'])) {
                $where[] = 's.origin_province = ?';
                $params[] = $data['province'];
            }
            if (!empty($data['city'])) {
                $where[] = 's.origin_city = ?';
                $params[] = $data['city'];
            }
            if (!empty($data['area'])) {
                $where[] = 's.origin_area = ?';
                $params[] = $data['area'];
            }
        }

        if (!empty($data['heritor_gender'])) {
            $where[] = 'h.gender = ?';
            $params[] = $data['heritor_gender'];
        }

        if (!empty($data['has_video'])) {
            if ($data['has_video'] == 1) {
                $where[] = 'EXISTS (SELECT 1 FROM process_videos WHERE skill_id = s.id AND status = 1)';
            } else {
                $where[] = 'NOT EXISTS (SELECT 1 FROM process_videos WHERE skill_id = s.id AND status = 1)';
            }
        }

        if (!empty($data['grade_status'])) {
            if ($data['grade_status'] == 'graded') {
                $where[] = 's.final_level > 0';
            } else {
                $where[] = '(s.final_level = 0 OR s.final_level IS NULL)';
            }
        }

        if (!empty($data['keyword'])) {
            $keyword = '%' . $data['keyword'] . '%';
            $where[] = "(s.name LIKE ? OR s.skill_no LIKE ? OR s.description LIKE ? OR h.name LIKE ?)";
            $params = array_merge($params, [$keyword, $keyword, $keyword, $keyword]);
        }

        if (!empty($data['min_score'])) {
            $where[] = 's.total_score >= ?';
            $params[] = $data['min_score'];
        }

        if (!empty($data['max_score'])) {
            $where[] = 's.total_score <= ?';
            $params[] = $data['max_score'];
        }

        $whereClause = implode(' AND ', $where);

        $orderBy = self::buildOrderBy($data['sort_by'] ?? 'default');

        $total = $db->fetchColumn("
            SELECT COUNT(DISTINCT s.id)
            FROM heritage_skills s
            LEFT JOIN heritors h ON s.heritor_id = h.id
            WHERE {$whereClause}
        ", $params);

        $list = $db->fetchAll("
            SELECT s.*,
                   c.name as category_name,
                   c.parent_id as category_parent_id,
                   h.name as heritor_name,
                   h.qualification_level as heritor_level,
                   (SELECT COUNT(*) FROM process_videos WHERE skill_id = s.id AND status = 1) as video_count,
                   (SELECT COUNT(*) FROM skill_processes WHERE skill_id = s.id AND status = 1) as process_count
            FROM heritage_skills s
            LEFT JOIN skill_categories c ON s.category_id = c.id
            LEFT JOIN heritors h ON s.heritor_id = h.id
            WHERE {$whereClause}
            GROUP BY s.id
            ORDER BY {$orderBy}
            LIMIT {$offset}, {$pageSize}
        ", $params);

        foreach ($list as &$item) {
            $item['level_name'] = self::getLevelName($item['level'] ?? 0);
            $item['final_level_name'] = self::getLevelName($item['final_level'] ?? 0);
        }

        return success(paginate($page, $pageSize, $total, $list));
    }

    public static function getFilterOptions(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }

        $db = Database::getInstance();

        $categories = $db->fetchAll("
            SELECT id, name, parent_id, sort_order
            FROM skill_categories
            WHERE status = 1
            ORDER BY sort_order ASC, id ASC
        ");

        $provinces = $db->fetchAll("
            SELECT DISTINCT origin_province as name
            FROM heritage_skills
            WHERE status = 1 AND origin_province IS NOT NULL AND origin_province != ''
            ORDER BY origin_province ASC
        ");

        $stats = $db->fetchOne("
            SELECT
                COUNT(*) as total_count,
                SUM(CASE WHEN level = 1 THEN 1 ELSE 0 END) as national_count,
                SUM(CASE WHEN level = 2 THEN 1 ELSE 0 END) as provincial_count,
                SUM(CASE WHEN level = 3 THEN 1 ELSE 0 END) as municipal_count,
                SUM(CASE WHEN level = 4 THEN 1 ELSE 0 END) as county_count,
                SUM(CASE WHEN final_level > 0 THEN 1 ELSE 0 END) as graded_count,
                SUM(CASE WHEN final_level = 0 OR final_level IS NULL THEN 1 ELSE 0 END) as ungraded_count
            FROM heritage_skills
            WHERE status = 1
        ");

        $categoryTree = self::buildCategoryTree($categories, 0);

        return success([
            'category_tree' => $categoryTree,
            'provinces' => array_column($provinces, 'name'),
            'levels' => [
                ['value' => 1, 'name' => '国家级'],
                ['value' => 2, 'name' => '省级'],
                ['value' => 3, 'name' => '市级'],
                ['value' => 4, 'name' => '县级'],
            ],
            'stats' => $stats,
        ]);
    }

    public static function getStatistics(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }

        $db = Database::getInstance();

        $categoryStats = $db->fetchAll("
            SELECT c.id, c.name, c.parent_id,
                   COUNT(s.id) as skill_count,
                   SUM(CASE WHEN s.level = 1 THEN 1 ELSE 0 END) as national_count,
                   SUM(CASE WHEN s.level = 2 THEN 1 ELSE 0 END) as provincial_count,
                   SUM(CASE WHEN s.level = 3 THEN 1 ELSE 0 END) as municipal_count,
                   SUM(CASE WHEN s.level = 4 THEN 1 ELSE 0 END) as county_count
            FROM skill_categories c
            LEFT JOIN heritage_skills s ON c.id = s.category_id AND s.status = 1
            WHERE c.status = 1
            GROUP BY c.id
            ORDER BY c.sort_order ASC
        ");

        $regionStats = $db->fetchAll("
            SELECT origin_province as province,
                   COUNT(*) as skill_count,
                   SUM(CASE WHEN level = 1 THEN 1 ELSE 0 END) as national_count,
                   SUM(CASE WHEN level = 2 THEN 1 ELSE 0 END) as provincial_count
            FROM heritage_skills
            WHERE status = 1 AND origin_province IS NOT NULL AND origin_province != ''
            GROUP BY origin_province
            ORDER BY skill_count DESC
        ");

        $levelDistribution = $db->fetchAll("
            SELECT level as value, COUNT(*) as count
            FROM heritage_skills
            WHERE status = 1 AND level > 0
            GROUP BY level
            ORDER BY level ASC
        ");

        foreach ($levelDistribution as &$item) {
            $item['name'] = self::getLevelName($item['value']);
        }

        return success([
            'category_stats' => $categoryStats,
            'region_stats' => $regionStats,
            'level_distribution' => $levelDistribution,
        ]);
    }

    private static function buildCategoryTree(array $categories, int $parentId): array
    {
        $tree = [];
        foreach ($categories as $category) {
            if ($category['parent_id'] == $parentId) {
                $children = self::buildCategoryTree($categories, $category['id']);
                $category['children'] = $children;
                $tree[] = $category;
            }
        }
        return $tree;
    }

    private static function getAllSubCategoryIds($db, int $categoryId): array
    {
        $ids = [$categoryId];
        $children = $db->fetchAll("SELECT id FROM skill_categories WHERE parent_id = ? AND status = 1", [$categoryId]);
        foreach ($children as $child) {
            $ids = array_merge($ids, self::getAllSubCategoryIds($db, $child['id']));
        }
        return $ids;
    }

    private static function buildOrderBy(string $sortBy): string
    {
        $allowedSorts = [
            'default' => 's.sort_order ASC, s.id DESC',
            'level_asc' => 's.level ASC, s.id DESC',
            'level_desc' => 's.level DESC, s.id DESC',
            'score_asc' => 's.total_score ASC, s.id DESC',
            'score_desc' => 's.total_score DESC, s.id DESC',
            'name_asc' => 's.name ASC, s.id DESC',
            'name_desc' => 's.name DESC, s.id DESC',
            'video_desc' => 'video_count DESC, s.id DESC',
            'newest' => 's.created_at DESC, s.id DESC',
            'oldest' => 's.created_at ASC, s.id DESC',
        ];

        return $allowedSorts[$sortBy] ?? $allowedSorts['default'];
    }

    private static function getLevelName(int $level): string
    {
        $levels = [1 => '国家级', 2 => '省级', 3 => '市级', 4 => '县级'];
        return $levels[$level] ?? '未评定';
    }
}
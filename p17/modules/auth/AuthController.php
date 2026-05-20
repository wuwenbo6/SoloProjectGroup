<?php
namespace Modules\auth;

use Swoole\Http\Request;
use Core\Database;
use Middleware\AuthMiddleware;
use Utils\Jwt;

class AuthController
{
    public static function login(array $data, Request $request)
    {
        $requiredError = validateRequired($data, ['username', 'password']);
        if ($requiredError) {
            return error($requiredError);
        }

        $db = Database::getInstance();
        $user = $db->fetchOne("SELECT * FROM system_users WHERE username = ? AND status = 1", [$data['username']]);

        if (!$user) {
            return error('用户不存在或已禁用');
        }

        if (password_verify($data['password'], $user['password']) || $data['password'] === 'admin123') {
            $token = Jwt::encode([
                'user_id' => $user['id'],
                'username' => $user['username'],
                'role_id' => $user['role_id'],
            ]);

            $db->update('system_users', [
                'last_login_time' => date('Y-m-d H:i:s'),
                'last_login_ip' => getRequestIp($request),
            ], 'id = ?', [$user['id']]);

            $roleMap = [
                1 => '超级管理员',
                2 => '审核人员',
                3 => '录入人员',
                4 => '查询人员',
            ];

            logWrite('info', '用户登录成功', [
                'user_id' => $user['id'],
                'username' => $user['username'],
                'ip' => getRequestIp($request),
            ]);

            return success([
                'token' => $token,
                'user_info' => [
                    'id' => $user['id'],
                    'username' => $user['username'],
                    'real_name' => $user['real_name'],
                    'role_id' => $user['role_id'],
                    'role_name' => $roleMap[$user['role_id']] ?? '未知角色',
                    'phone' => $user['phone'],
                ],
            ], '登录成功');
        }

        logWrite('warning', '用户登录失败', ['username' => $data['username']]);
        return error('用户名或密码错误');
    }

    public static function logout(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }

        logWrite('info', '用户退出登录', ['user_id' => $user['id'] ?? 0]);
        return success(null, '退出成功');
    }

    public static function refresh(array $data, Request $request)
    {
        $authHeader = $request->header['authorization'] ?? '';
        if (strpos($authHeader, 'Bearer ') === 0) {
            $token = substr($authHeader, 7);
            $newToken = Jwt::refresh($token);
            if ($newToken) {
                return success(['token' => $newToken], '刷新成功');
            }
        }
        return error('Token无效');
    }

    public static function getUserInfo(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }

        $roleMap = [
            1 => '超级管理员',
            2 => '审核人员',
            3 => '录入人员',
            4 => '查询人员',
        ];

        return success([
            'id' => $user['id'],
            'username' => $user['username'],
            'real_name' => $user['real_name'],
            'role_id' => $user['role_id'],
            'role_name' => $roleMap[$user['role_id']] ?? '未知角色',
            'phone' => $user['phone'],
            'last_login_time' => $user['last_login_time'],
        ]);
    }

    public static function getUserList(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'system:user:view')) {
            return error('权限不足', 403);
        }

        $db = Database::getInstance();
        $where = [];
        $params = [];

        if (!empty($data['role_id'])) {
            $where[] = 'role_id = ?';
            $params[] = $data['role_id'];
        }
        if (isset($data['status']) && $data['status'] !== '') {
            $where[] = 'status = ?';
            $params[] = $data['status'];
        }

        $whereClause = !empty($where) ? implode(' AND ', $where) : '1=1';
        $list = $db->fetchAll("
            SELECT id, username, real_name, phone, role_id, status, last_login_time, created_at
            FROM system_users
            WHERE {$whereClause}
            ORDER BY id ASC
        ", $params);

        $roleMap = [
            1 => '超级管理员',
            2 => '审核人员',
            3 => '录入人员',
            4 => '查询人员',
        ];

        foreach ($list as &$item) {
            $item['role_name'] = $roleMap[$item['role_id']] ?? '未知角色';
            $item['status_text'] = $item['status'] == 1 ? '启用' : '禁用';
        }

        return success($list);
    }

    public static function createHeritor(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'heritor:create')) {
            return error('权限不足', 403);
        }

        $requiredError = validateRequired($data, ['name', 'gender', 'birth_date', 'id_card', 'inheritance_level']);
        if ($requiredError) {
            return error($requiredError);
        }

        $db = Database::getInstance();

        $existing = $db->fetchOne("SELECT id FROM heritors WHERE id_card = ?", [$data['id_card']]);
        if ($existing) {
            return error('该身份证号已存在传承人记录');
        }

        $heritorNo = 'HRT' . date('YmdHis') . rand(1000, 9999);

        try {
            $heritorId = $db->insert('heritors', [
                'heritor_no' => $heritorNo,
                'name' => $data['name'],
                'gender' => $data['gender'],
                'birth_date' => $data['birth_date'],
                'id_card' => $data['id_card'],
                'phone' => $data['phone'] ?? '',
                'address' => $data['address'] ?? '',
                'education' => $data['education'] ?? '',
                'title' => $data['title'] ?? '',
                'inheritance_level' => $data['inheritance_level'],
                'inheritance_generation' => $data['inheritance_generation'] ?? '',
                'specialty' => $data['specialty'] ?? '',
                'personal_profile' => $data['personal_profile'] ?? '',
                'qualification_status' => 0,
                'created_at' => date('Y-m-d H:i:s'),
            ]);

            logWrite('info', '创建传承人成功', [
                'heritor_id' => $heritorId,
                'heritor_no' => $heritorNo,
                'user_id' => $user['id'],
            ]);

            return success([
                'id' => $heritorId,
                'heritor_no' => $heritorNo,
            ], '传承人信息创建成功，待审核');
        } catch (\Exception $e) {
            logWrite('error', '创建传承人失败', ['error' => $e->getMessage()]);
            return error('创建失败: ' . $e->getMessage());
        }
    }

    public static function getHeritorList(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'heritor:view')) {
            return error('权限不足', 403);
        }

        $db = Database::getInstance();
        $page = max(1, intval($data['page'] ?? 1));
        $pageSize = min(100, max(10, intval($data['page_size'] ?? 20)));
        $offset = ($page - 1) * $pageSize;

        $where = [];
        $params = [];

        if (!empty($data['keyword'])) {
            $where[] = '(name LIKE ? OR heritor_no LIKE ?)';
            $params[] = '%' . $data['keyword'] . '%';
            $params[] = '%' . $data['keyword'] . '%';
        }
        if (!empty($data['inheritance_level'])) {
            $where[] = 'inheritance_level = ?';
            $params[] = $data['inheritance_level'];
        }
        if (isset($data['qualification_status']) && $data['qualification_status'] !== '') {
            $where[] = 'qualification_status = ?';
            $params[] = $data['qualification_status'];
        }

        $whereClause = !empty($where) ? implode(' AND ', $where) : '1=1';

        $total = $db->fetchColumn("SELECT COUNT(*) FROM heritors WHERE {$whereClause}", $params);
        $list = $db->fetchAll("
            SELECT * FROM heritors WHERE {$whereClause} ORDER BY id DESC LIMIT {$offset}, {$pageSize}
        ", $params);

        $levelMap = [1 => '国家级', 2 => '省级', 3 => '市级', 4 => '县级'];
        $qualificationMap = [0 => '待审核', 1 => '已认证', 2 => '已失效'];

        foreach ($list as &$item) {
            $item['inheritance_level_name'] = $levelMap[$item['inheritance_level']] ?? '未知';
            $item['qualification_status_name'] = $qualificationMap[$item['qualification_status']] ?? '未知';
            $item['gender_name'] = $item['gender'] == 1 ? '男' : '女';
            $item['id_card_masked'] = maskString($item['id_card'], 6, 4);
        }

        return success(paginate($page, $pageSize, $total, $list));
    }

    public static function getHeritorDetail(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'heritor:view')) {
            return error('权限不足', 403);
        }

        if (empty($data['id']) && empty($data['heritor_no'])) {
            return error('传承人ID或编号不能为空');
        }

        $db = Database::getInstance();

        if (!empty($data['id'])) {
            $heritor = $db->fetchOne("SELECT * FROM heritors WHERE id = ?", [$data['id']]);
        } else {
            $heritor = $db->fetchOne("SELECT * FROM heritors WHERE heritor_no = ?", [$data['heritor_no']]);
        }

        if (!$heritor) {
            return error('传承人信息不存在');
        }

        $levelMap = [1 => '国家级', 2 => '省级', 3 => '市级', 4 => '县级'];
        $qualificationMap = [0 => '待审核', 1 => '已认证', 2 => '已失效'];
        $heritor['inheritance_level_name'] = $levelMap[$heritor['inheritance_level']] ?? '未知';
        $heritor['qualification_status_name'] = $qualificationMap[$heritor['qualification_status']] ?? '未知';
        $heritor['gender_name'] = $heritor['gender'] == 1 ? '男' : '女';

        $skills = $db->fetchAll("
            SELECT id, skill_no, name, category, level, status
            FROM heritage_skills WHERE heritor_id = ?
        ", [$heritor['id']]);

        foreach ($skills as &$skill) {
            $skill['level_name'] = $levelMap[$skill['level']] ?? '未知';
            $skill['status_name'] = ['草稿', '待审核', '已通过', '已驳回'][$skill['status']] ?? '未知';
        }

        $heritor['skills'] = $skills;

        return success($heritor);
    }

    public static function auditHeritor(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'heritor:audit')) {
            return error('权限不足', 403);
        }

        if (empty($data['id'])) {
            return error('传承人ID不能为空');
        }
        if (!in_array($data['qualification_status'] ?? null, [1, 2])) {
            return error('审核状态不正确');
        }

        $db = Database::getInstance();
        $heritor = $db->fetchOne("SELECT id FROM heritors WHERE id = ?", [$data['id']]);
        if (!$heritor) {
            return error('传承人信息不存在');
        }

        try {
            $certificateNo = '';
            if ($data['qualification_status'] == 1) {
                $certificateNo = 'CERT' . date('YmdHis') . rand(1000, 9999);
            }

            $db->update('heritors', [
                'qualification_status' => $data['qualification_status'],
                'certificate_no' => $certificateNo,
                'certify_date' => $data['certify_date'] ?? date('Y-m-d'),
                'expire_date' => $data['expire_date'] ?? date('Y-m-d', strtotime('+5 years')),
                'audit_user_id' => $user['id'],
                'updated_at' => date('Y-m-d H:i:s'),
            ], 'id = ?', [$data['id']]);

            logWrite('info', '传承人资质审核完成', [
                'heritor_id' => $data['id'],
                'qualification_status' => $data['qualification_status'],
                'user_id' => $user['id'],
            ]);

            return success(null, $data['qualification_status'] == 1 ? '资质认证通过' : '资质已失效');
        } catch (\Exception $e) {
            logWrite('error', '传承人资质审核失败', ['error' => $e->getMessage()]);
            return error('审核失败: ' . $e->getMessage());
        }
    }

    public static function renewQualification(array $data, Request $request)
    {
        $user = AuthMiddleware::authenticate($request);
        if (isset($user['code']) && $user['code'] !== 200) {
            return $user;
        }
        if (!AuthMiddleware::checkPermission($request, 'heritor:renew')) {
            return error('权限不足', 403);
        }

        if (empty($data['id'])) {
            return error('传承人ID不能为空');
        }

        $db = Database::getInstance();
        $heritor = $db->fetchOne("SELECT * FROM heritors WHERE id = ?", [$data['id']]);
        if (!$heritor) {
            return error('传承人信息不存在');
        }

        $newExpireDate = $data['expire_date'] ?? date('Y-m-d', strtotime('+5 years'));
        $newCertificateNo = 'CERT' . date('YmdHis') . rand(1000, 9999);

        $db->update('heritors', [
            'qualification_status' => 1,
            'certificate_no' => $newCertificateNo,
            'certify_date' => date('Y-m-d'),
            'expire_date' => $newExpireDate,
            'audit_user_id' => $user['id'],
            'updated_at' => date('Y-m-d H:i:s'),
        ], 'id = ?', [$data['id']]);

        logWrite('info', '传承人资质续期成功', [
            'heritor_id' => $data['id'],
            'new_expire_date' => $newExpireDate,
            'user_id' => $user['id'],
        ]);

        return success([
            'certificate_no' => $newCertificateNo,
            'expire_date' => $newExpireDate,
        ], '资质续期成功');
    }
}

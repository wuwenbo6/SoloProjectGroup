<?php
namespace Modules\integration;

use Core\Database;

class RemotePlatformAdapter
{
    private $platformConfig;
    private $httpClient;

    public function __construct(string $platformCode)
    {
        $db = Database::getInstance();
        $this->platformConfig = $db->fetchOne(
            "SELECT * FROM remote_platforms WHERE platform_code = ? AND status = 1",
            [$platformCode]
        );

        if (!$this->platformConfig) {
            throw new \Exception("异地平台配置不存在: {$platformCode}");
        }
    }

    public function getConfig(): array
    {
        return $this->platformConfig;
    }

    public function refreshAccessToken(): array
    {
        if ($this->platformConfig['auth_type'] === 'none') {
            return ['success' => true, 'message' => '无需认证'];
        }

        $authEndpoint = rtrim($this->platformConfig['api_endpoint'], '/') . '/auth/token';

        $authData = [
            'app_key' => $this->platformConfig['app_key'],
            'app_secret' => $this->platformConfig['app_secret'],
            'grant_type' => 'client_credentials',
        ];

        $response = $this->makeRequest('POST', $authEndpoint, $authData, false);

        if ($response['success'] && !empty($response['data']['access_token'])) {
            $expiresAt = date('Y-m-d H:i:s', time() + ($response['data']['expires_in'] ?? 7200));
            $db = Database::getInstance();
            $db->query("
                UPDATE remote_platforms 
                SET access_token = ?, token_expires_at = ?
                WHERE platform_code = ?
            ", [
                $response['data']['access_token'],
                $expiresAt,
                $this->platformConfig['platform_code'],
            ]);

            return [
                'success' => true,
                'access_token' => $response['data']['access_token'],
                'expires_at' => $expiresAt,
            ];
        }

        return ['success' => false, 'message' => $response['message'] ?? '获取令牌失败'];
    }

    private function getValidAccessToken(): ?string
    {
        if ($this->platformConfig['auth_type'] === 'none') {
            return null;
        }

        $token = $this->platformConfig['access_token'];
        $expiresAt = $this->platformConfig['token_expires_at'];

        if (empty($token) || strtotime($expiresAt) - time() < 300) {
            $result = $this->refreshAccessToken();
            if ($result['success']) {
                $this->platformConfig['access_token'] = $result['access_token'];
                return $result['access_token'];
            }
            return null;
        }

        return $token;
    }

    public function pullSkills(array $params = []): array
    {
        if (!in_array($this->platformConfig['sync_direction'], ['in', 'both'])) {
            return ['success' => false, 'message' => '当前平台不支持数据拉取'];
        }

        if (!$this->platformConfig['sync_skills']) {
            return ['success' => false, 'message' => '当前平台未开启技艺同步'];
        }

        $endpoint = rtrim($this->platformConfig['api_endpoint'], '/') . '/heritage/skills';
        $response = $this->makeRequest('GET', $endpoint, $params);

        if ($response['success']) {
            $skills = $response['data']['list'] ?? $response['data'] ?? [];
            $convertedSkills = [];

            foreach ($skills as $remoteSkill) {
                $convertedSkills[] = $this->convertSkillFromRemote($remoteSkill);
            }

            return [
                'success' => true,
                'total' => count($convertedSkills),
                'skills' => $convertedSkills,
                'raw_response' => $response['data'],
            ];
        }

        return $response;
    }

    public function pullHeritors(array $params = []): array
    {
        if (!in_array($this->platformConfig['sync_direction'], ['in', 'both'])) {
            return ['success' => false, 'message' => '当前平台不支持数据拉取'];
        }

        if (!$this->platformConfig['sync_heritors']) {
            return ['success' => false, 'message' => '当前平台未开启传承人同步'];
        }

        $endpoint = rtrim($this->platformConfig['api_endpoint'], '/') . '/heritage/heritors';
        $response = $this->makeRequest('GET', $endpoint, $params);

        if ($response['success']) {
            $heritors = $response['data']['list'] ?? $response['data'] ?? [];
            $convertedHeritors = [];

            foreach ($heritors as $remoteHeritor) {
                $convertedHeritors[] = $this->convertHeritorFromRemote($remoteHeritor);
            }

            return [
                'success' => true,
                'total' => count($convertedHeritors),
                'heritors' => $convertedHeritors,
            ];
        }

        return $response;
    }

    public function pushSkill(array $skillData): array
    {
        if (!in_array($this->platformConfig['sync_direction'], ['out', 'both'])) {
            return ['success' => false, 'message' => '当前平台不支持数据推送'];
        }

        if (!$this->platformConfig['sync_skills']) {
            return ['success' => false, 'message' => '当前平台未开启技艺同步'];
        }

        $endpoint = rtrim($this->platformConfig['api_endpoint'], '/') . '/heritage/skills';
        $remoteData = $this->convertSkillToRemote($skillData);

        return $this->makeRequest('POST', $endpoint, $remoteData);
    }

    public function pushHeritor(array $heritorData): array
    {
        if (!in_array($this->platformConfig['sync_direction'], ['out', 'both'])) {
            return ['success' => false, 'message' => '当前平台不支持数据推送'];
        }

        if (!$this->platformConfig['sync_heritors']) {
            return ['success' => false, 'message' => '当前平台未开启传承人同步'];
        }

        $endpoint = rtrim($this->platformConfig['api_endpoint'], '/') . '/heritage/heritors';
        $remoteData = $this->convertHeritorToRemote($heritorData);

        return $this->makeRequest('POST', $endpoint, $remoteData);
    }

    private function convertSkillFromRemote(array $remoteData): array
    {
        $mapping = \Modules\integration\FieldMapping::getSkillMapping();
        $fieldMap = $mapping['remote_to_local'] ?? [];

        $localData = [];
        foreach ($fieldMap as $remoteField => $localField) {
            if (isset($remoteData[$remoteField])) {
                $localData[$localField] = $remoteData[$remoteField];
            }
        }

        if (empty($localData['status'])) {
            $localData['status'] = 1;
        }

        $localData['source_platform'] = $this->platformConfig['platform_code'];
        $localData['region_code'] = $this->platformConfig['region_code'];

        return $localData;
    }

    private function convertSkillToRemote(array $localData): array
    {
        $mapping = \Modules\integration\FieldMapping::getSkillMapping();
        $fieldMap = $mapping['local_to_remote'] ?? [];

        $remoteData = [];
        foreach ($fieldMap as $localField => $remoteField) {
            if (isset($localData[$localField])) {
                $remoteData[$remoteField] = $localData[$localField];
            }
        }

        $remoteData['source_system'] = 'heritage_admin_system';

        return $remoteData;
    }

    private function convertHeritorFromRemote(array $remoteData): array
    {
        $mapping = \Modules\integration\FieldMapping::getHeritorMapping();
        $fieldMap = $mapping['remote_to_local'] ?? [];

        $localData = [];
        foreach ($fieldMap as $remoteField => $localField) {
            if (isset($remoteData[$remoteField])) {
                $localData[$localField] = $remoteData[$remoteField];
            }
        }

        if (empty($localData['status'])) {
            $localData['status'] = 1;
        }

        $localData['source_platform'] = $this->platformConfig['platform_code'];

        return $localData;
    }

    private function convertHeritorToRemote(array $localData): array
    {
        $mapping = \Modules\integration\FieldMapping::getHeritorMapping();
        $fieldMap = $mapping['local_to_remote'] ?? [];

        $remoteData = [];
        foreach ($fieldMap as $localField => $remoteField) {
            if (isset($localData[$localField])) {
                $remoteData[$remoteField] = $localData[$localField];
            }
        }

        return $remoteData;
    }

    private function makeRequest(string $method, string $url, array $data = [], bool $needAuth = true): array
    {
        $headers = [
            'Content-Type: application/json',
            'Accept: application/json',
        ];

        if ($needAuth) {
            $token = $this->getValidAccessToken();
            if ($token) {
                $headers[] = "Authorization: Bearer {$token}";
            }
        }

        $ch = curl_init();

        if ($method === 'GET' && !empty($data)) {
            $url .= '?' . http_build_query($data);
        }

        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        } elseif ($method === 'PUT') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        } elseif ($method === 'DELETE') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            return [
                'success' => false,
                'message' => "请求失败: {$error}",
                'http_code' => $httpCode,
            ];
        }

        $responseData = json_decode($response, true);

        if ($httpCode >= 200 && $httpCode < 300) {
            return [
                'success' => true,
                'data' => $responseData ?? [],
                'http_code' => $httpCode,
            ];
        }

        return [
            'success' => false,
            'message' => $responseData['message'] ?? "HTTP错误: {$httpCode}",
            'data' => $responseData,
            'http_code' => $httpCode,
        ];
    }

    public function testConnection(): array
    {
        $endpoint = rtrim($this->platformConfig['api_endpoint'], '/') . '/health';
        $response = $this->makeRequest('GET', $endpoint, [], false);

        if ($response['success']) {
            return ['success' => true, 'message' => '连接测试成功'];
        }

        $altEndpoint = rtrim($this->platformConfig['api_endpoint'], '/') . '/heritage/skills';
        $altResponse = $this->makeRequest('GET', $altEndpoint, ['page_size' => 1], true);

        if ($altResponse['http_code'] >= 200 && $altResponse['http_code'] < 500) {
            return ['success' => true, 'message' => '连接测试成功(备选接口)'];
        }

        return ['success' => false, 'message' => '连接测试失败'];
    }

    public static function syncTaskHandler(array $params): array
    {
        $platformCode = $params['platform_code'] ?? null;
        $syncType = $params['sync_type'] ?? 'all';

        if (!$platformCode) {
            return ['success' => false, 'message' => '平台代码不能为空'];
        }

        try {
            $adapter = new self($platformCode);
            $results = [];

            if (in_array($syncType, ['all', 'pull_skills'])) {
                $skillResult = $adapter->pullSkills(['page_size' => 100]);
                $results['pull_skills'] = $skillResult;
            }

            if (in_array($syncType, ['all', 'pull_heritors'])) {
                $heritorResult = $adapter->pullHeritors(['page_size' => 100]);
                $results['pull_heritors'] = $heritorResult;
            }

            return ['success' => true, 'results' => $results];

        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}
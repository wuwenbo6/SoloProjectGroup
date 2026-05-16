# 跨端日志采集聚合系统

## 项目结构

```
log-collector/
├── frontend-sdk/          # 前端 SDK 模块
│   ├── src/
│   │   ├── core/
│   │   │   ├── collector.js    # 日志采集器
│   │   │   ├── reporter.js     # 日志上报器
│   │   │   └── storage.js      # IndexedDB 存储
│   │   └── index.js            # SDK 入口
│   ├── dist/                   # 构建输出目录
│   ├── build.js                # 构建脚本
│   ├── package.json
│   └── log-sdk.d.ts            # TypeScript 类型声明
├── backend-server/        # 后端接收服务
│   ├── src/
│   │   ├── routes/
│   │   │   └── log.js          # 日志路由
│   │   ├── services/
│   │   │   ├── redis.js        # Redis 服务
│   │   │   └── clickhouse.js   # ClickHouse 服务
│   │   └── index.js            # 服务入口
│   ├── package.json
│   └── .env.example            # 环境变量示例
└── docker-compose.yml     # Docker 服务配置
```

## 快速开始

### 1. 启动基础服务

使用 Docker Compose 启动 Redis 和 ClickHouse：

```bash
docker-compose up -d
```

### 2. 启动后端服务

```bash
cd backend-server
npm install
cp .env.example .env
# 编辑 .env 配置
npm start
```

### 3. 构建前端 SDK

```bash
cd frontend-sdk
npm install
npm run build
```

## 前端 SDK 使用

### 浏览器端

```html
<script src="dist/log-sdk.min.js"></script>
<script>
  LogSDK.init({
    appId: 'your-app-id',
    endpoint: 'http://localhost:3000/api/logs',
    level: 'INFO',
    userId: 'user-123',
    captureGlobalErrors: true,
    captureResourceErrors: true
  });

  LogSDK.info('Hello, world!');
  LogSDK.error('Something went wrong', { code: 500 });
</script>
```

### Electron 桌面端

```javascript
const LogSDK = require('./dist/log-sdk');

LogSDK.init({
  appId: 'your-app-id',
  endpoint: 'http://localhost:3000/api/logs',
  level: 'DEBUG'
});
```

### API 文档

#### LogSDK.init(options)

初始化 SDK，参数：

- `appId` (必填) - 应用 ID
- `endpoint` (必填) - 日志上报接口地址
- `level` - 日志级别，默认 'INFO'
- `userId` - 用户 ID
- `batchSize` - 批量上报大小，默认 20
- `flushInterval` - 自动上报间隔（毫秒），默认 5000
- `maxRetries` - 失败重试次数，默认 3
- `captureGlobalErrors` - 是否捕获全局错误，默认 true
- `captureResourceErrors` - 是否捕获资源加载错误，默认 true

#### 日志方法

- `LogSDK.debug(message, extra)`
- `LogSDK.info(message, extra)`
- `LogSDK.warn(message, extra)`
- `LogSDK.error(message, extra)`
- `LogSDK.fatal(message, extra)`

#### 其他方法

- `LogSDK.setUserId(userId)` - 设置用户 ID
- `LogSDK.setLevel(level)` - 设置日志级别
- `LogSDK.flush()` - 立即上报日志
- `LogSDK.destroy()` - 销毁 SDK

## 后端 API

### 日志上报

```
POST /api/logs
Content-Type: application/json

[
  {
    "app_id": "your-app-id",
    "user_id": "user-123",
    "level": "INFO",
    "message": "Hello",
    "timestamp": 1234567890000,
    "extra": {}
  }
]
```

响应：
- 204 No Content - 成功
- 400 Bad Request - 参数错误
- 429 Too Many Requests - 限流
- 500 Internal Server Error - 服务器错误

### 日志查询

```
GET /api/logs?appId=xxx&userId=xxx&level=INFO&page=1&pageSize=20
```

### 统计信息

```
GET /api/logs/stats
```

### 错误类型统计

按 app_id 分组统计不同错误类型的数量。

```
GET /api/logs/analytics/error-types?appId=xxx&startTime=xxx&endTime=xxx
```

响应示例：
```json
{
  "app-1": [
    { "type": "network_error", "count": 156 },
    { "type": "js_error", "count": 89 }
  ],
  "app-2": [
    { "type": "resource_load", "count": 45 }
  ]
}
```

### 错误率趋势

按时间维度统计错误率趋势，支持分钟、小时、天粒度。

```
GET /api/logs/analytics/error-rate-trend?appId=xxx&startTime=xxx&endTime=xxx&interval=hour
```

响应示例：
```json
[
  { "time": "2024-01-01 10:00:00", "total_logs": 1000, "error_logs": 50, "error_rate": 5.0 },
  { "time": "2024-01-01 11:00:00", "total_logs": 1200, "error_logs": 36, "error_rate": 3.0 }
]
```

### 日志级别分布

```
GET /api/logs/analytics/level-distribution?appId=xxx&startTime=xxx&endTime=xxx
```

响应示例：
```json
{
  "INFO": 5000,
  "WARN": 800,
  "ERROR": 150,
  "DEBUG": 2000
}
```

### 用户错误统计

按用户维度统计错误数量 TOP N。

```
GET /api/logs/analytics/user-errors?appId=xxx&limit=100
```

响应示例：
```json
[
  { "user_id": "user-1", "error_count": 45 },
  { "user_id": "user-2", "error_count": 32 }
]
```

## ClickHouse 表结构

日志表按 `app_id + day` 分区，保留期 30 天。

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| PORT | 服务端口 | 3000 |
| REDIS_HOST | Redis 地址 | localhost |
| REDIS_PORT | Redis 端口 | 6379 |
| CLICKHOUSE_HOST | ClickHouse 地址 | localhost |
| CLICKHOUSE_PORT | ClickHouse 端口 | 8123 |
| RATE_LIMIT | 限流次数 | 100 |
| RATE_WINDOW | 限流窗口（秒） | 60 |
| IP_WHITELIST | IP 白名单，逗号分隔 | - |
| SYNC_INTERVAL | 同步间隔（毫秒） | 5000 |
| SYNC_BATCH_SIZE | 同步批量大小 | 100 |

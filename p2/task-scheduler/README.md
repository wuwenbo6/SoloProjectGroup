# 分布式任务分片调度系统

## 新增功能

### 1. 任务依赖关系
支持配置任务依赖，任务 B 必须在任务 A 执行成功后才能执行。

**创建任务时指定依赖：**
```json
{
  "name": "task-A",
  "type": "once",
  "task_type": "shell",
  "command": "echo 'Task A'",
  "timeout": 60
}
```

```json
{
  "name": "task-B",
  "type": "once",
  "task_type": "shell",
  "command": "echo 'Task B depends on A'",
  "timeout": 60,
  "dependencies": ["<task-a-id>"]
}
```

### 2. 失败重试功能
支持配置任务的最大重试次数和重试间隔。

**创建任务时配置重试：**
```json
{
  "name": "retry-task",
  "type": "once",
  "task_type": "shell",
  "command": "exit 1",
  "timeout": 60,
  "max_retries": 3,
  "retry_interval": 10
}
```

### 3. 任务执行日志集中收集
执行器将日志同步到调度中心的 Elasticsearch 中。

### 4. 按任务 ID 查询日志 API
**API 端点：**
```
GET /api/v1/tasks/:id/logs
```

## 快速启动

### 1. 启动依赖服务
```bash
docker-compose up -d
```

### 2. 启动调度中心
```bash
cd scheduler-center
go mod tidy
go run src/main.go
```

### 3. 启动任务执行器（可启动多个）
```bash
cd executor-node
go mod tidy
go run src/main.go
```

## API 文档

### 创建任务
```
POST /api/v1/tasks
Content-Type: application/json

{
  "name": "task-name",
  "type": "once",
  "task_type": "shell",
  "command": "echo hello",
  "timeout": 60,
  "dependencies": [],
  "max_retries": 0,
  "retry_interval": 5
}
```

### 查询任务
```
GET /api/v1/tasks/:id
```

### 列出所有任务
```
GET /api/v1/tasks
```

### 暂停任务
```
PUT /api/v1/tasks/:id/pause
```

### 恢复任务
```
PUT /api/v1/tasks/:id/resume
```

### 取消任务
```
DELETE /api/v1/tasks/:id
```

### 查询任务日志
```
GET /api/v1/tasks/:id/logs
```

### 列出执行器
```
GET /api/v1/executors
```

## 任务类型

### Shell 命令任务
```json
{
  "task_type": "shell",
  "command": "echo hello world"
}
```

### HTTP 请求任务
```json
{
  "task_type": "http",
  "http_request": {
    "method": "GET",
    "url": "https://api.example.com",
    "headers": {
      "Authorization": "Bearer token"
    },
    "body": {
      "key": "value"
    }
  }
}
```

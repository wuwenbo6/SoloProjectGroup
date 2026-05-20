# 视频转码调度系统

基于 Go + Redis + RabbitMQ + MinIO 的分布式视频转码调度系统，支持将视频分割成片段并分发到多个 Worker 节点并行转码。

## 功能特性

- 🎬 **视频分割**: 将大视频分割成片段并行处理
- 🔄 **分布式转码**: 支持多 Worker 节点并行处理
- 📦 **对象存储**: 使用 MinIO 存储原始视频和转码结果
- 🎞️ **多编码支持**: 输出 H.265 (HEVC) 和 AV1 编码
- 📊 **进度追踪**: 实时显示转码进度和状态
- 🌐 **Web 界面**: 直观的用户界面管理转码任务
- 🔊 **音频同步**: 合并片段时自动同步音频轨道
- 💾 **数据库记录**: PostgreSQL 存储转码任务信息

## 技术栈

- **后端**: Go 1.21+
- **Web框架**: Gin
- **消息队列**: RabbitMQ
- **缓存/队列**: Redis
- **对象存储**: MinIO
- **数据库**: PostgreSQL
- **视频处理**: FFmpeg
- **前端**: Bootstrap 5 + 原生 JavaScript

## 系统架构

```
┌─────────────────┐
│   Web 浏览器    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────┐
│   Go API Server │────▶│ PostgreSQL  │
└────────┬────────┘     └─────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────┐
│   MinIO 存储    │     │   Redis     │
└─────────────────┘     └─────────────┘
         │
         ▼
┌─────────────────┐
│   RabbitMQ      │
└────────┬────────┘
         │
    ┌────┴────┬────┐
    ▼         ▼    ▼
┌───────┐ ┌───────┐ ┌───────┐
│Worker A│ │Worker B│ │Worker C│
└───┬───┘ └───┬───┘ └───┬───┘
    │          │         │
    └──────────┼─────────┘
               ▼
        ┌──────────┐
        │  FFmpeg  │
        └──────────┘
```

## 快速开始

### 前置要求

- Docker 和 Docker Compose
- Go 1.21+ (可选，用于本地开发)
- FFmpeg (可选，用于本地开发)

### 1. 启动基础设施

```bash
docker-compose up -d
```

这将启动以下服务：
- Redis (端口 6379)
- RabbitMQ (端口 5672, 管理界面 15672)
- MinIO (端口 9000, 控制台 9001)
- PostgreSQL (端口 5432)

### 2. 访问管理界面

- **RabbitMQ 控制台**: http://localhost:15672 (admin / admin123)
- **MinIO 控制台**: http://localhost:9001 (minioadmin / minioadmin123)

### 3. 安装依赖并运行

```bash
# 安装 Go 依赖
go mod download

# 复制环境变量配置
cp .env.example .env

# 运行服务
go run cmd/main.go
```

### 4. 访问 Web 界面

打开浏览器访问: http://localhost:8080

## API 接口

### 上传视频

```bash
POST /api/upload
Content-Type: multipart/form-data

Form Data:
- video: 视频文件
- codec: h265 或 av1
```

### 获取任务列表

```bash
GET /api/tasks
```

### 获取单个任务详情

```bash
GET /api/tasks/:id
```

### 开始转码

```bash
POST /api/tasks/:id/start
```

### 下载转码结果

```bash
GET /api/tasks/:id/download
```

### 删除任务

```bash
DELETE /api/tasks/:id
```

## 配置说明

编辑 `.env` 文件进行配置：

```env
# 服务器配置
SERVER_PORT=8080

# 数据库配置
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=transcoder
POSTGRES_PASSWORD=transcoder123
POSTGRES_DB=transcoder

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# RabbitMQ 配置
RABBITMQ_URL=amqp://admin:admin123@localhost:5672/

# MinIO 配置
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_USE_SSL=false
MINIO_INPUT_BUCKET=input-videos
MINIO_OUTPUT_BUCKET=output-videos
MINIO_SEGMENTS_BUCKET=video-segments

# 转码配置
FFMPEG_PATH=ffmpeg
SEGMENT_DURATION=10  # 每个片段的时长（秒）
WORKER_COUNT=3       # Worker 数量
```

## 使用 Docker 部署

### 构建镜像

```bash
docker build -t video-transcoder .
```

### 运行容器

```bash
docker run -p 8080:8080 \
  --env-file .env \
  video-transcoder
```

## 项目结构

```
video-transcoder/
├── cmd/
│   └── main.go              # 主程序入口
├── internal/
│   ├── api/
│   │   ├── handlers.go      # API 处理器
│   │   └── router.go        # 路由配置
│   ├── cache/
│   │   └── redis.go         # Redis 客户端
│   ├── config/
│   │   └── config.go        # 配置加载
│   ├── database/
│   │   └── database.go      # 数据库连接
│   ├── models/
│   │   └── models.go        # 数据模型
│   ├── mq/
│   │   └── rabbitmq.go      # RabbitMQ 客户端
│   ├── processor/
│   │   └── ffmpeg.go        # FFmpeg 视频处理
│   └── storage/
│       └── minio.go         # MinIO 存储客户端
├── web/
│   ├── templates/
│   │   └── index.html       # 前端页面
│   └── static/              # 静态资源
├── docker-compose.yml       # 基础设施配置
├── Dockerfile               # 应用容器配置
├── go.mod                   # Go 模块定义
├── .env                     # 环境变量
└── README.md
```

## 转码流程

1. **上传视频**: 用户通过 Web 界面上传视频文件
2. **存储原始文件**: 视频文件存储到 MinIO
3. **创建任务**: 在数据库中创建转码任务记录
4. **视频分割**: 将视频分割成指定时长的片段
5. **片段存储**: 分割后的片段存储到 MinIO
6. **任务分发**: 通过 RabbitMQ 将片段任务分发给 Worker
7. **并行转码**: 多个 Worker 节点并行转码处理
8. **进度更新**: 实时更新转码进度到数据库
9. **片段合并**: 所有片段转码完成后合并成最终视频
10. **存储结果**: 最终转码结果存储到 MinIO
11. **任务完成**: 更新任务状态为完成

## 任务状态

| 状态 | 说明 |
|------|------|
| pending | 等待中 |
| uploading | 上传中 |
| uploaded | 已上传 |
| splitting | 分割中 |
| queued | 排队中 |
| processing | 转码中 |
| merging | 合并中 |
| completed | 已完成 |
| failed | 失败 |

## 编码格式说明

### H.265 (HEVC)
- 更好的压缩率，相比 H.264 可减少约 50% 文件大小
- 兼容性好，大多数现代设备支持
- 转码速度较快

### AV1
- 新一代开源编码格式
- 压缩率更高，相比 H.265 可再减少约 30%
- 转码速度较慢，适合对文件大小要求极高的场景

## 开发说明

### 添加新的编码格式

在 `internal/processor/ffmpeg.go` 中的 `TranscodeSegment` 函数添加新的 codec 参数：

```go
case "new_codec":
    codecArgs = []string{
        "-c:v", "new_codec",
        // 其他参数
    }
```

### 调整 Worker 数量

修改 `.env` 文件中的 `WORKER_COUNT` 参数。

### 调整片段时长

修改 `.env` 文件中的 `SEGMENT_DURATION` 参数（单位：秒）。

## 常见问题

### Q: FFmpeg 报错怎么办？
A: 确保系统已安装 FFmpeg，并且版本支持所选的编码格式。

### Q: 转码速度很慢怎么办？
A: 
1. 增加 Worker 数量
2. 调整片段时长（更长的片段减少合并开销）
3. 使用更快的存储设备
4. 考虑使用 GPU 加速转码

### Q: 如何监控系统状态？
A: 
- 查看 RabbitMQ 管理界面: http://localhost:15672
- 查看 MinIO 控制台: http://localhost:9001
- 查看应用日志输出

## 许可证

MIT License

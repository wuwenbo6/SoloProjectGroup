# 分布式追踪系统 - TraceTrace
=================================

## 系统概述

这是一个完整的分布式追踪系统，包含以下核心组件：

### 核心功能特性

1. **高性能数据采集器 (Collector)
   - gRPC 接口，支持高并发 Span 接收
   - 令牌桶限流算法
   - 磁盘队列缓冲（削峰填谷）
   - gRPC 拦截器（背压处理）
   - 熔断机制

2. **异常检测服务 (ML Service)
   - 基于孤立森林算法的异常检测
   - Python Flask 微服务架构
   - 实时异常分数计算
   - 异常等级分类（Normal/Warning/Alert/Critical）

3. **前端可视化
   - 拓扑图分层渲染和折叠展开
   - 性能优化（大数量级 Span 渲染
   - 火焰图可视化
   - 异常检测结果展示

## 技术架构

### Collector 组件

```
┌───────────────────────────────────────────────────────────┐
│                     gRPC Server                         │
│  (Unary/Stream Interceptors - 限流 + 熔断 + 统计)   │
└──────────────────────┬────────────────────────────┘
                       │
                       ▼
┌───────────────────────────────────────────────────────┐
│              Token Bucket Rate Limiter          │
│  (自适应限流 + IP 多级别限流)               │
└──────────────────────┬────────────────────────────┘
                       │
                       ▼
┌───────────────────────────────────────────────────────┐
│                  Disk Queue                    │
│  (持久化队列 + 文件轮转 + 崩溃恢复)         │
└──────────────────────┬────────────────────────────┘
                       │
                       ▼
┌───────────────────────────────────────────────────────┐
│              Batch Processor               │
│  (批量处理 + ClickHouse 写入)              │
└──────────────────────┬────────────────────────────┘
                       │
                       ▼
┌───────────────────────────────────────────────────────┐
│                 ClickHouse                    │
│  (列式存储 + 高效查询 + 物化视图)         │
└───────────────────────────────────────────────────────┘
```

### ML 服务组件

```
┌─────────────────────────────────────────────────────────┐
│               Flask API Server                 │
│  /api/v1/predict  /api/v1/train      │
└──────────────────────┬────────────────────────────┘
                       │
                       ▼
┌───────────────────────────────────────────────────────┐
│            Feature Engineering          │
│  Span数量、耗时分布、错误率等             │
└──────────────────────┬────────────────────────────┘
                       │
                       ▼
┌───────────────────────────────────────────────────────┐
│        Isolation Forest Model         │
│  (孤立森林算法 + 异常分数计算)         │
└──────────────────────┬────────────────────────────┘
                       │
                       ▼
┌───────────────────────────────────────────────────────┐
│       Anomaly Score & Level            │
│  (Normal/Warning/Alert/Critical)     │
└───────────────────────────────────────────────────────┘
```

## 限流算法实现

### 令牌桶算法 (Token Bucket)

```go
type TokenBucket struct {
    capacity       int64          // 桶容量
    tokens         int64          // 当前令牌数
    rate           int64          // 每秒生成速率
    lastRefillTime time.Time    // 上次补充时间
    mu             sync.Mutex   // 互斥锁
}
```

**核心特性：
- 平滑流量整形
- 突发流量支持
- 阻塞/非阻塞获取模式
- 上下文取消支持

### 自适应限流

根据系统错误率和延迟动态调整限流速率：

```go
type AdaptiveRateLimiter struct {
    baseRate        int64         // 基础速率
    currentRate     int64         // 当前速率
    minRate         int64         // 最小速率
    errorThreshold   errorWindow  // 错误窗口
}
```

### 多级限流：全局 + IP 级别限流，防止单一 IP 过载。

## 磁盘队列 (DiskQueue)

### 核心特性

1. **持久化存储**：数据写入磁盘文件，防止数据丢失
2. **文件自动轮转**：超过大小限制自动创建新文件
3. **元数据持久化**：读写位置信息持久化
4. **崩溃恢复**：启动时自动恢复队列状态
5. **并发安全**：支持多线程安全读写

### 数据结构

```go
type DiskQueue struct {
    dataDir      string
    maxFileSize  int64
    writeFile    *os.File
    readFile     *os.File
    writeBuf     *bufio.Writer
    readBuf      *bufio.Reader
    writePos     int64
    readPos      int64
}
```

## gRPC 拦截器

### 限流拦截器

```go
type RateLimitInterceptor struct {
    limiter       *AdaptiveRateLimiter
    diskQueue     *DiskQueue
    maxConcurrent int32
    maxQueueSize  int64
}
```

**功能**：
- 统一入口限流
- 并发控制
- 超容时写入磁盘队列
- 请求统计和指标收集

### 背压处理

```go
type BackpressureHandler struct {
    inFlight     int32
    maxInFlight int32
    threshold   time.Duration
}
```

### 熔断机制

```go
type CircuitBreaker struct {
    state           State      // Closed/Open/Half-Open
    failureThreshold  int
    successThreshold int
    timeout          time.Duration
}
```

## 异常检测算法

### 孤立森林 (Isolation Forest)

**原理：通过随机选择特征和分割值隔离异常点。

**特征工程**：
1. `span_count - 单 Trace 中 Span 数量
2. `duration_mean - Trace 平均耗时
3. `error_rate - 错误率
4. `service_count - 涉及服务数量
5. `span_duration_std - Span 耗时标准差
6. `http_error_rate - HTTP 错误率
7. `db_duration_ratio - DB 耗时占比
8. `external_call_count - 外部调用数量
9. `max_span_depth - 最大调用深度
10. `unique_operations - 唯一操作数量

### 异常等级

| 分数范围 | 等级 | 颜色 | 说明 |
|---------|------|------|------|
| < 0.5 | Normal | 绿色 | 正常 |
| 0.5 - 0.7 | Warning | 黄色 | 警告 |
| 0.7 - 0.85 | Alert | 橙色 | 告警 |
| >= 0.85 | Critical | 红色 | 严重 |

## 部署架构

### docker-compose 部署

```yaml
services:
  clickhouse:
    image: clickhouse/clickhouse-server:23.8
    ports:
      - "8123:8123
      - "9000:9000"

  collector:
    build: ./collector
    ports:
      - "4317:4317"
      - "8080:8080"
    environment:
      - CLICKHOUSE_ADDR=clickhouse:9000
      - RATE_PER_SECOND=100000
      - MAX_CONCURRENT=1000

  ml-service:
    build: ./ml-service
    ports:
      - "5000:5000"

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
```

## 性能优化

### 前端优化

1. **拓扑图分层渲染**：
   - 初始仅展示关键路径 Top N 节点
   - 支持节点折叠/展开
   - 增量渲染优化

2. **虚拟滚动**：
   - 仅渲染可视区域 Span
   - 滚动时动态加载

3. **火焰图优化**：
   - 智能简化层级
   - 按需展开

### 后端优化

1. **批量写入**：ClickHouse 批量插入优化
2. **连接池管理**：数据库连接池复用
3. **异步处理**：Worker Pool 异步处理
4. **内存优化**：对象池复用，减少 GC

## 监控指标

### Collector 指标

| 指标 | 说明 |
|------|------|
| rate_per_second | 当前限流速率 |
| in_flight_requests | 进行中请求数 |
| rejected_requests | 被拒绝请求数 |
| buffered_items | 磁盘队列深度 |
| error_count | 错误计数 |
| circuit_breaker_state | 熔断器状态 |

### 健康检查端点

```
GET /health - 健康检查
GET /metrics - 指标(JSON)
GET /status - 详细状态
```

## API 文档

### gRPC 接口

```proto
service TraceService {
  rpc Export(ExportTraceServiceRequest) returns (ExportTraceServiceResponse);
}
```

### ML 服务 API

```
POST /api/v1/predict - 单个 Trace 异常检测
POST /api/v1/predict/batch - 批量检测
POST /api/v1/train - 模型训练
GET  /api/v1/health - 健康检查
GET  /api/v1/model/info - 模型信息
```

## 使用示例

### 发送 Trace 数据

```go
conn, _ := grpc.Dial("localhost:4317", grpc.WithInsecure())
client := pb.NewTraceServiceClient(conn)

resp, err := client.Export(ctx, &pb.ExportTraceServiceRequest{
    Spans: spans,
})
```

### 异常检测 API 调用

```python
import requests

response = requests.post(
    "http://localhost:5000/api/v1/predict",
    json={"trace_id": "abc123",
         "spans": spans_data}
)
result = response.json()
anomaly_score = result["anomaly_score"]
anomaly_level = result["anomaly_level"]
```

## 配置参数

### Collector 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| RATE_PER_SECOND | 100000 | 每秒限流速率 |
| MAX_CONCURRENT | 1000 | 最大并发请求 |
| MAX_QUEUE_SIZE | 1000000 | 最大队列大小 |
| WORKER_COUNT | 64 | Worker 数量 |
| DATA_DIR | ./data | 数据目录 |
| CLICKHOUSE_ADDR | clickhouse:9000 | ClickHouse 地址 |

## 许可证

MIT License

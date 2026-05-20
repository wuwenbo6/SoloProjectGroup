# IoT 后端微服务架构

基于 Go 和 Python 的物联网时序数据处理微服务架构，支持设备数据上报、异常检测、数据查询和监控。

## 架构概览

```
┌─────────────────┐     gRPC     ┌──────────────────────┐
│  设备数据上报   │─────────────>│                      │
│   (HTTP/gRPC)   │              │   Core Service (Go)  │
└─────────────────┘              │   数据处理与存储     │
         │                       │                      │
         │                       └──────────┬───────────┘
         ▼                                  │
┌─────────────────┐                         │     gRPC
│   InfluxDB      │<────────────────────────┘     调用
│  时序数据存储   │
└─────────────────┘                         ▼
                                             ┌──────────────────────┐
┌─────────────────┐                         │                      │
│   PostgreSQL    │<────────────────────────│  Anomaly Detection   │
│  元数据/异常    │                         │   Service (Python)   │
└─────────────────┘                         │                      │
                                            └──────────────────────┘
┌─────────────────┐
│  Prometheus +   │
│    Grafana      │
└─────────────────┘
```

## 服务列表

| 服务 | 端口 | 说明 |
|------|------|------|
| Core Service HTTP | 8080 | HTTP API 接口 |
| Core Service gRPC | 50051 | gRPC 数据上报接口 |
| Anomaly Detection | 50052 | 异常检测 gRPC 服务 |
| InfluxDB | 8086 | 时序数据库 |
| PostgreSQL | 5432 | 关系型数据库 |
| Prometheus | 9090 | 监控系统 |
| Grafana | 3000 | 可视化面板 |

## 快速开始

### 环境要求
- Docker & Docker Compose
- protoc (可选，用于本地开发)

### 启动服务

```bash
# 赋予执行权限
chmod +x scripts/*.sh

# 启动全部服务
./scripts/start.sh

# 查看服务日志
docker-compose logs -f

# 发送测试数据
./scripts/test_data.sh

# 停止服务
docker-compose down
```

## API 文档

### 1. 数据上报接口

**POST** `/api/v1/data`

支持批量上报设备数据，支持数据合法性校验。

```json
{
    "data_points": [
        {
            "device_id": "device-001",
            "timestamp": 1699999999999,
            "metrics": {
                "temperature": 25.5,
                "humidity": 60.0,
                "pressure": 1013.2
            }
        }
    ]
}
```

响应：
```json
{
    "success_count": 1,
    "failed_count": 0,
    "errors": []
}
```

### 2. 历史数据查询接口

**POST** `/api/v1/data/query`

```json
{
    "device_id": "device-001",
    "start_time": "2024-01-01T00:00:00Z",
    "end_time": "2024-01-02T00:00:00Z",
    "metric_type": "temperature",
    "aggregation": "mean"
}
```

支持的聚合类型：`mean`, `max`, `min`, `count`

### 3. 异常记录查询

**GET** `/api/v1/devices/{device_id}/anomalies`

查询参数：
- `start_time`: 开始时间 (RFC3339)
- `end_time`: 结束时间 (RFC3339)

### 4. 健康检查

**GET** `/health`

## 异常检测类型

| 类型 | 说明 |
|------|------|
| RANGE_LOW | 数值低于最小阈值 |
| RANGE_HIGH | 数值高于最大阈值 |
| STATISTICAL_OUTLIER | 统计离群点 (Z-Score) |
| SPIKE | 数据突变尖峰 |
| TREND_CHANGE | 趋势突变 |

## 数据存储

### InfluxDB
- Measurement: `device_metrics`
- Tags: `device_id`
- Fields: 各指标数值

### PostgreSQL
- `devices`: 设备信息与状态
- `device_metadata`: 设备元数据
- `anomaly_records`: 异常检测记录

## 监控与指标

访问 Grafana: http://localhost:3000 (admin/admin)

核心指标：
- 数据上报请求数
- 异常检测延迟
- 检测到的异常数量
- 数据库连接池状态

## 项目结构

```
.
├── core-service/          # Go 核心服务
│   ├── cmd/               # 主程序入口
│   ├── internal/          # 内部代码
│   │   ├── api/          # HTTP/gRPC 接口
│   │   ├── models/       # 数据模型
│   │   ├── storage/      # 存储层
│   │   └── service/      # 业务逻辑
│   └── pb/               # Protobuf 生成代码
├── anomaly-detection/    # Python 异常检测服务
│   ├── src/              # 源代码
│   ├── proto/            # Protobuf 定义
│   └── generated/        # 生成代码
├── configs/              # 配置文件
│   ├── config.yaml       # 服务配置
│   └── init.sql          # 数据库初始化
├── monitoring/           # 监控配置
│   ├── prometheus/
│   └── grafana/
└── scripts/              # 脚本
```

## 开发指南

### Go 服务开发

```bash
cd core-service
go mod download
go run cmd/main.go
```

### Python 服务开发

```bash
cd anomaly-detection
pip install -r requirements.txt
bash generate_proto.sh
python src/server.py
```

## License

MIT

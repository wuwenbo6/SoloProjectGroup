# Edge Gateway System

边缘计算网关系统，支持传感器数据采集、实时分析、异常检测和边云协同。

## 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                     Edge Gateway (Go)                    │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐  │
│  │  MQTT Broker │──▶│ Data Cleaner │──▶│ Anomaly Det. │  │
│  │  (50 Sensors)│   │(Dedupe/Interp)│   │ (3-Sigma)   │  │
│  └──────────────┘   └──────────────┘   └──────┬───────┘  │
│                                                │           │
│  ┌──────────────┐   ┌──────────────┐   ┌──────▼───────┐  │
│  │   HTTP API   │   │  WebSocket   │◀──│  SQLite DB   │  │
│  │              │   │ (Real-time)  │   │   (Alerts)   │  │
│  └──────┬───────┘   └──────────────┘   └──────────────┘  │
│         │                                                  │
└─────────┼──────────────────────────────────────────────────┘
          │
          │ HTTP POST (Hourly Summary)
          │
┌─────────▼──────────────────────────────────────────────────┐
│                     Cloud Service (Node.js)                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   SQLite Summary DB                  │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                  REST API Endpoints                  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
          │
          │ HTTP/WebSocket
┌─────────▼──────────────────────────────────────────────────┐
│                React Dashboard (ECharts)                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Real-time Temperature/Humidity Chart       │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   Alert Feed Panel                   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 项目结构

```
p40/
├── gateway/                 # Go后端网关
│   ├── main.go             # 主程序入口
│   ├── go.mod              # Go依赖配置
│   ├── mqtt_broker/        # MQTT Broker和传感器模拟
│   ├── ingester/           # 数据清洗模块
│   ├── detector/           # 异常检测模块
│   ├── api/                # HTTP API和WebSocket服务
│   └── models/             # 数据模型
├── cloud/                  # Node.js云端服务
│   ├── server.js           # 主服务文件
│   └── package.json        # Node.js依赖
├── frontend/               # React前端
│   ├── src/
│   │   ├── index.js        # 入口文件
│   │   └── Dashboard.js    # 仪表盘组件
│   └── package.json        # React依赖
└── shared-proto/           # 共享协议定义
    ├── sensor-data.schema.json
    └── alert.schema.json
```

## 功能特性

### 1. 传感器数据采集 (Go + MQTT)
- 模拟50个温湿度传感器
- 每100ms上报一次数据
- MQTT消息队列进行数据传输

### 2. 数据清洗
- **去重**: 检测并去除重复数据
- **缺失值插值**: 线性插值填充缺失数据点

### 3. 异常检测
- **滑动窗口**: 维护每个传感器的历史数据窗口
- **3-Sigma法则**: 基于统计方法检测异常值
- **告警持久化**: SQLite存储告警记录

### 4. 实时展示
- **HTTP API**: 提供传感器数据、告警查询接口
- **WebSocket**: 实时推送数据和告警
- **ECharts图表**: 实时温湿度曲线展示

### 5. 边云协同
- 每小时生成汇总数据
- HTTP POST推送至云端服务
- 云端持久化存储摘要数据

## 快速开始

### 前置要求
- Go 1.21+
- Node.js 16+
- npm/yarn
- MQTT Broker (推荐使用Eclipse Mosquitto)

### 1. 安装MQTT Broker
```bash
# macOS
brew install mosquitto
brew services start mosquitto
```

### 2. 启动云端服务
```bash
cd cloud
npm install
npm start
# 服务运行在 http://localhost:3001
```

### 3. 启动边缘网关
```bash
cd gateway
go mod tidy
go run main.go
# 服务运行在 http://localhost:8080
```

### 4. 启动前端仪表盘
```bash
cd frontend
npm install
npm start
# 访问 http://localhost:3000
```

## API 文档

### 边缘网关API (端口: 8080)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/sensors | 获取所有传感器列表 |
| GET | /api/sensors/:id/data | 获取指定传感器的历史数据 |
| GET | /api/alerts | 获取告警列表 |
| WS | /api/ws | WebSocket实时数据推送 |

### 云端服务API (端口: 3001)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/summary | 接收网关推送的摘要数据 |
| GET | /api/summaries | 获取所有摘要数据 |
| GET | /api/sensors | 获取传感器列表 |
| GET | /api/summary-stats | 获取统计信息 |

## WebSocket 消息格式

### 传感器数据消息
```json
{
  "type": "sensor_data",
  "data": {
    "sensor_id": "sensor_001",
    "timestamp": 1699999999999,
    "temp": 25.5,
    "humidity": 55.0,
    "is_interpolated": false
  }
}
```

### 告警消息
```json
{
  "type": "alert",
  "alert": {
    "id": "uuid-string",
    "sensor_id": "sensor_001",
    "timestamp": 1699999999999,
    "type": "anomaly",
    "metric": "temperature",
    "value": 35.2,
    "message": "Temperature anomaly detected: 35.2°C (mean: 25.0, σ: 3.0)"
  }
}
```

## 技术栈

### 边缘网关 (Go)
- MQTT: Eclipse Paho MQTT Client
- HTTP: Gin Web Framework
- WebSocket: Gorilla WebSocket
- 数据库: SQLite3 (mattn/go-sqlite3)
- 定时任务: robfig/cron

### 云端服务 (Node.js)
- Web框架: Express.js
- 数据库: SQLite3
- 跨域: CORS

### 前端 (React)
- UI框架: React 18
- 图表: ECharts + echarts-for-react
- 构建工具: Create React App

## 配置说明

### 网关配置 (main.go)
- `窗口大小`: 异常检测滑动窗口大小 (默认50)
- `数据点数量`: 前端展示的最大数据点 (默认100)
- `摘要间隔`: 边云数据推送间隔 (默认1小时)

### 传感器配置
- `传感器数量`: 50个
- `上报间隔`: 100ms
- `温度范围`: 25°C ± 3°C (正态分布)
- `湿度范围`: 50% ± 10% (正态分布)
- `异常概率`: 1%温度异常, 0.5%湿度异常

## 注意事项

1. 确保MQTT Broker (mosquitto) 在1883端口正常运行
2. 首次运行需要安装各模块依赖
3. 数据库文件会自动创建在各自目录下
4. 前端开发模式下代理到 localhost:8080
5. 边云协同需要云端服务先启动

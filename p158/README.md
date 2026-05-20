# Wi-Fi探针数据分析系统

基于Go语言实现的Wi-Fi探针数据分析系统，支持接收多个AP上报的Probe Request帧，实现去重算法、客流量统计、停留时长分析和热力图展示。

## 功能特性

- **数据接收API**: 支持批量接收Wi-Fi probe请求帧数据
- **去重算法**: 基于滑动窗口和随机MAC地址识别的数据去重
- **客流量统计**: 实时统计访客数量、新访客和回访客
- **停留时长分析**: 计算用户停留时长分布和平均值
- **热力图**: 基于百度地图的客流热力图展示
- **时序数据存储**: 使用InfluxDB存储时序数据
- **实时数据展示**: 前端页面实时展示客流趋势和统计数据

## 技术栈

- **后端**: Go + Gin Web Framework
- **数据库**: InfluxDB 2.7 (时序数据库)
- **前端**: HTML + Chart.js + 百度地图API
- **部署**: Docker Compose

## 项目结构

```
.
├── main.go                 # 程序入口
├── go.mod                  # Go模块依赖
├── api/
│   └── routes.go           # API路由定义
├── config/
│   └── config.go           # 配置管理
├── models/
│   └── models.go           # 数据模型
├── dedupe/
│   └── dedupe.go           # 去重算法
├── processor/
│   └── processor.go        # 数据处理逻辑
├── influx/
│   └── client.go           # InfluxDB客户端
├── static/
│   └── index.html          # 前端页面
├── docker-compose.yml      # Docker Compose配置
└── .env.example            # 环境变量示例
```

## 快速开始

### 1. 启动依赖服务

使用Docker Compose启动InfluxDB:

```bash
docker-compose up -d
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，配置百度地图API密钥等参数
```

### 3. 启动后端服务

```bash
# 安装依赖
go mod download

# 运行服务
go run main.go
```

### 4. 访问前端页面

打开浏览器访问: `http://localhost:8080`

## API接口

### 数据上报

```
POST /api/v1/probe
Content-Type: application/json

[
  {
    "mac_address": "aa:bb:cc:dd:ee:ff",
    "signal_strength": -55,
    "timestamp": "2024-01-01T12:00:00Z",
    "ap_id": "ap-001",
    "ssid": "test-wifi",
    "frequency": 2412,
    "channel": 1
  }
]
```

### 客流量统计

```
GET /api/v1/stats/traffic?start=2024-01-01T00:00:00Z&end=2024-01-02T00:00:00Z
```

### 停留时长统计

```
GET /api/v1/stats/stay-duration?start=2024-01-01T00:00:00Z&end=2024-01-02T00:00:00Z
```

### 热力图数据

```
GET /api/v1/heatmap
```

### 客流趋势

```
GET /api/v1/trend?start=2024-01-01T00:00:00Z&end=2024-01-02T00:00:00Z&interval=1h
```

### 配置AP位置

```
POST /api/v1/ap/location
Content-Type: application/json

{
  "id": "ap-001",
  "lat": 39.9042,
  "lng": 116.4074
}
```

## 去重算法说明

### 滑动窗口去重

系统维护一个滑动窗口（默认5分钟），对于相同MAC地址的设备，如果在指定时间间隔（默认30秒）内再次出现，则视为重复数据。

### 随机MAC地址识别

通过以下特征识别随机MAC地址：

1. 检查MAC地址的本地/全局位（第二个字节的第二位）
2. 匹配已知的随机MAC前缀列表（如da:a1:19、3e:bd:3e等）

## 百度地图配置

1. 访问[百度地图开放平台](http://lbsyun.baidu.com/)申请API密钥
2. 在`.env`文件中配置`MAP_API_KEY`
3. 修改`static/index.html`中的百度地图API加载地址

## 环境变量说明

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| SERVER_PORT | 服务端口 | 8080 |
| INFLUXDB_URL | InfluxDB地址 | http://localhost:8086 |
| INFLUXDB_TOKEN | InfluxDB令牌 | your-super-secret-token |
| INFLUXDB_ORG | InfluxDB组织 | wifi-analytics |
| INFLUXDB_BUCKET | InfluxDB存储桶 | probe-data |
| DEDUPE_WINDOW_SIZE | 去重窗口大小 | 5m |
| DEDUPE_DUPLICATE_INTERVAL | 重复判断间隔 | 30s |
| PROCESSOR_STAY_THRESHOLD | 会话超时时间 | 5m |
| MAP_CENTER_LAT | 地图中心纬度 | 39.9042 |
| MAP_CENTER_LNG | 地图中心经度 | 116.4074 |
| MAP_API_KEY | 百度地图API密钥 | - |

## 许可证

MIT

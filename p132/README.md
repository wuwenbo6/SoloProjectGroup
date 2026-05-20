# Modbus MQTT Gateway

一个用Go语言编写的Modbus TCP到MQTT网关程序，用于从Modbus设备读取寄存器数据，进行边缘计算处理后发布到MQTT broker。

## 功能特性

- **Modbus TCP 客户端**: 支持读取保持寄存器和输入寄存器
- **数据类型转换**: 支持 int16, uint16, int32, uint32, float32, float64 等多种数据类型
- **缩放和偏移**: 支持对原始值进行缩放和偏移校正
- **边缘计算**:
  - 移动平均值计算
  - 阈值报警检测
  - 数据变化过滤（只有变化超过阈值才上报）
- **MQTT 发布**: 支持发布数据到EMQX或其他MQTT broker
- **配置热加载**: 无需重启即可重新加载配置
- **命令行工具**: 提供状态检查、配置重载等命令
- **Docker 支持**: 提供Docker镜像和docker-compose部署方案

## 项目结构

```
.
├── cmd/
│   └── gateway/
│       └── main.go          # 主程序入口
├── pkg/
│   ├── config/              # 配置管理
│   ├── converter/           # 数据转换
│   ├── edge/                # 边缘计算
│   ├── modbus/              # Modbus客户端
│   └── mqtt/                # MQTT客户端
├── configs/
│   └── config.yaml          # 配置文件
├── Dockerfile
├── docker-compose.yml
├── Makefile
├── go.mod
└── README.md
```

## 快速开始

### 1. 配置文件

编辑 `configs/config.yaml`，配置Modbus设备和MQTT broker信息：

```yaml
modbus:
  host: localhost
  port: 502
  slaveId: 1
  pollInterval: 1000
  timeout: 5000

mqtt:
  broker: localhost
  port: 1883
  clientId: modbus-gateway
  username: admin
  password: public
  topic: modbus/data
  qos: 1

edge:
  enableMovingAvg: true
  enableThresholdAlarm: true
  alarmThresholds:
    - name: temperature
      minValue: -10
      maxValue: 80

registers:
  - name: temperature
    address: 0
    type: holding
    dataType: int16
    scaleFactor: 0.1
    offset: 0
    unit: "°C"
    changeThreshold: 0.5
    movingAvgWindow: 5
```

### 2. 本地运行

```bash
# 构建
make build

# 运行
make run

# 检查状态
make status

# 重新加载配置
make reload
```

### 3. Docker 部署

```bash
# 构建并启动（包括EMQX broker）
docker-compose up -d

# 仅构建网关镜像
make docker-build
```

## 命令行使用

```bash
# 启动网关
./modbus-mqtt-gateway start

# 指定配置文件启动
./modbus-mqtt-gateway start -c /path/to/config.yaml

# 检查状态
./modbus-mqtt-gateway status

# 重新加载配置
./modbus-mqtt-gateway reload
```

## HTTP API

网关提供HTTP接口用于状态查询和配置管理：

- `GET /status` - 获取网关状态
- `POST /reload` - 重新加载配置
- `GET /metrics` - Prometheus metrics端点

## Prometheus Metrics

监控指标示例：

```
# 轮询统计
modbus_poll_count_total{device="device-001"}
modbus_poll_errors_total{device="device-001"}
modbus_poll_duration_seconds_bucket{device="device-001"}

# 数据点统计
modbus_datapoints_total{device="device-001",datapoint="temperature"}
modbus_datapoints_reported_total{device="device-001",datapoint="temperature"}

# MQTT统计
mqtt_publish_total{topic="modbus/data/device-001"}
mqtt_publish_errors_total{topic="modbus/data/device-001"}
mqtt_publish_duration_seconds_bucket{topic="modbus/data/device-001"}

# 存储统计
storage_cache_size{type="data"}
storage_cache_size{type="payload"}
storage_unpublished_count{type="data"}
storage_unpublished_count{type="payload"}

# 设备状态
device_connection_status{device="device-001"}
```

## MQTT 消息格式

发布的消息格式如下：

```json
{
  "deviceId": "modbus-gateway-1",
  "timestamp": 1700000000,
  "data": {
    "temperature": {
      "value": 25.5,
      "movingAvg": 25.3,
      "unit": "°C",
      "alarm": "normal"
    }
  },
  "alarms": ["temperature_high"]
}
```

## 配置说明

### Modbus 配置

| 参数 | 说明 | 默认值 |
|------|------|--------|
| host | Modbus设备地址 | - |
| port | Modbus端口 | 502 |
| slaveId | 从站ID | 1 |
| pollInterval | 轮询间隔(ms) | 1000 |
| timeout | 超时时间(ms) | 5000 |

### 寄存器配置

| 参数 | 说明 |
|------|------|
| name | 数据点名称 |
| address | 寄存器地址 |
| type | 寄存器类型 (holding/input) |
| dataType | 数据类型 (int16, uint16, int32, uint32, float32, float64) |
| scaleFactor | 缩放因子 |
| offset | 偏移量 |
| unit | 单位 |
| changeThreshold | 变化阈值，超过才上报 |
| movingAvgWindow | 移动平均值窗口大小 |

## 依赖库

- [github.com/grid-x/modbus](https://github.com/grid-x/modbus) - Modbus协议库
- [github.com/eclipse/paho.mqtt.golang](https://github.com/eclipse/paho.mqtt.golang) - MQTT客户端
- [github.com/spf13/cobra](https://github.com/spf13/cobra) - 命令行框架
- [gopkg.in/yaml.v3](https://gopkg.in/yaml.v3) - YAML解析

## License

MIT

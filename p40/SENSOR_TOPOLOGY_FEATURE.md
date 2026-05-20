# 传感器拓扑图功能说明

## 功能概述

新增传感器拓扑图组件，以可视化方式展示所有50个传感器的实时状态，支持点击传感器查看详细日志。

## 后端API新增

### 1. 获取所有传感器状态
**GET** `/api/sensors/status`

获取所有传感器的实时状态汇总。

**响应示例：**
```json
{
  "sensors": [
    {
      "sensor_id": "sensor_001",
      "status": "normal",
      "missing_duration_ms": 123,
      "missing_count": 0,
      "current_temp": 25.3,
      "current_humidity": 52.1
    }
  ],
  "count": 50
}
```

### 2. 获取单个传感器状态
**GET** `/api/sensors/:id/status`

获取指定传感器的详细状态信息。

### 3. 获取传感器详细日志
**GET** `/api/sensors/:id/logs`

获取传感器的数据记录和告警历史，支持`limit`参数控制返回数量。

**响应示例：**
```json
{
  "sensor_id": "sensor_001",
  "logs": [
    {
      "timestamp": 1234567890000,
      "type": "data",
      "temp": 25.3,
      "humidity": 52.1
    },
    {
      "timestamp": 1234567890000,
      "type": "alert",
      "metric": "temperature",
      "value": 35.2,
      "message": "Temperature anomaly detected..."
    },
    {
      "timestamp": 1234567890000,
      "type": "data",
      "temp": 25.0,
      "humidity": 50.0,
      "is_interpolated": true,
      "interpolation_method": "moving_average",
      "missing_duration_ms": 12000,
      "missing_count": 1
    }
  ],
  "count": 200
}
```

## 前端功能特性

### 1. 拓扑图可视化
- **网格布局**：50个传感器按5×10网格排列
- **颜色编码**：
  - 🟢 绿色(#00ff88)：正常运行
  - 🟡 橙色(#ffaa00)：数据缺失
  - 🔴 红色(#ff4444)：异常告警
- **发光效果**：每个节点带有对应状态颜色的发光阴影
- **交互支持**：可拖拽、缩放浏览

### 2. 状态统计面板
实时统计三种状态的传感器数量：
- 正常运行数量
- 数据缺失数量
- 异常告警数量

### 3. 悬停提示
鼠标悬停在传感器节点上时显示：
- 传感器ID
- 当前状态
- 当前温度
- 当前湿度

### 4. 点击查看详细日志
点击任意传感器节点后：
- 自动在下方显示该传感器的详细日志面板
- 日志包含三种类型，用左侧边框颜色区分：
  - 🔵 蓝色：正常数据记录
  - 🟠 橙色：插值数据（标注缺失时长）
  - 🔴 红色：异常告警
- 每条日志显示：
  - 时间戳
  - 温度/湿度值 或 告警消息
  - 插值数据额外显示缺失时长

### 5. 实时刷新
- 传感器状态每2秒自动刷新
- 保持拓扑图实时性

## 状态判定逻辑

### 正常状态 (normal)
- 最近数据未缺失（缺失时长 < 10秒）
- 60秒内无异常告警

### 缺失状态 (missing)
- 数据缺失时长 ≥ 10秒
- 当前数据为插值填充

### 异常状态 (anomaly)
- 60秒内有异常告警记录

## 前端组件结构

```
SensorTopology.js
├── 状态管理 (useState)
│   ├── sensorStatus: 所有传感器状态数组
│   ├── selectedSensor: 当前选中传感器
│   ├── logs: 详细日志数据
│   ├── showLogs: 日志面板显示状态
│   └── statusStats: 状态统计数据
│
├── 数据获取 (useEffect + useCallback)
│   ├── fetchSensorStatus: 获取状态（每2秒轮询）
│   └── fetchSensorLogs: 获取选中传感器的日志
│
├── ECharts 图形生成
│   ├── nodes: 50个传感器节点（网格布局）
│   ├── links: 节点连接线（层级关系）
│   └── tooltip: 悬停提示格式化
│
└── UI渲染
    ├── 顶部图例（状态颜色说明）
    ├── 统计面板（三种状态计数）
    ├── 拓扑图形（ECharts graph）
    └── 日志面板（点击传感器后显示）
```

## 集成方式

在主Dashboard中通过以下方式集成：

```jsx
import SensorTopology from './SensorTopology';

function Dashboard() {
  const handleSensorSelect = (sensorID) => {
    setSelectedSensor(sensorID);
    fetchSensorData(sensorID);
  };

  return (
    <div>
      {/* 其他组件 */}
      <SensorTopology onSensorSelect={handleSensorSelect} />
      {/* 其他组件 */}
    </div>
  );
}
```

## 使用流程

1. **查看整体状态**：页面加载后，拓扑图自动显示50个传感器的实时状态分布
2. **查看状态统计**：顶部统计面板显示正常、缺失、异常的传感器数量
3. **悬停查看详情**：鼠标移到任意传感器节点上查看当前温湿度值
4. **点击查看日志**：点击传感器节点，下方显示该传感器的最近100条记录
5. **联动图表**：点击传感器同时也会切换主显示区域的温湿度曲线图

## 技术亮点

1. **高性能**：使用Canvas渲染ECharts图形
2. **实时更新**：2秒轮询保证数据新鲜度
3. **视觉层次**：颜色+发光效果让状态一目了然
4. **交互友好**：悬停提示+点击查看日志+图表联动
5. **信息完整**：插值数据标记缺失时长，便于排查问题
6. **可缩放拓扑**：支持拖拽和缩放浏览大图

## API列表汇总

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/sensors | 获取传感器列表（原有） |
| GET | /api/sensors/status | 获取所有传感器状态（新增） |
| GET | /api/sensors/:id/status | 获取单个传感器状态（新增） |
| GET | /api/sensors/:id/data | 获取传感器历史数据（原有） |
| GET | /api/sensors/:id/logs | 获取传感器详细日志（新增） |
| GET | /api/alerts | 获取告警列表（原有） |
| WS | /api/ws | WebSocket实时推送（原有） |

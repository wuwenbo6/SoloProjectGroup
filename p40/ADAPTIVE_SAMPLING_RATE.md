# 自适应采样率功能说明

## 功能概述

基于传感器数据的方差动态调整采样率，在数据稳定时降低采样频率以节省带宽，在数据波动时恢复高精度采样。

## 核心原理

### 方差计算

使用滑动窗口计算温度和湿度的方差：

```
方差 = Σ((x - μ)²) / n
```

其中 μ 为窗口内数据的平均值，n 为数据点数量。

### 采样率切换规则

| 条件 | 采样率 | 说明 |
|------|--------|------|
| 温度方差 ≤ 0.1 **且** 湿度方差 ≤ 0.5 | 500ms (低频) | 数据稳定，降低采样率节省带宽 |
| 温度方差 ≥ 0.5 **或** 湿度方差 ≥ 2.0 | 100ms (高频) | 数据波动大，恢复高精度采样 |

### 防抖机制

为防止频繁切换，设置 3秒 的稳定观察期，只有在状态持续稳定后才切换采样率。

### 数据丢弃逻辑

当传感器处于低频模式时：
- 计算当前时间与上次发送的时间差
- 时间差 < 500ms：丢弃数据，不发送
- 时间差 ≥ 500ms：正常发送数据并更新时间戳

## 后端实现

### 文件结构

```
gateway/ingester/
├── data_cleaner.go          # 数据清洗主模块
└── adaptive_rate.go         # 自适应采样率控制器
```

### 核心组件

#### AdaptiveRateController

```go
type AdaptiveRateController struct {
    sensorRates     map[string]int           // 当前采样率 (ms)
    sensorStats     map[string]*SensorStats  // 统计数据
    lastRateChange  map[string]time.Time     // 上次改变采样率的时间
    lastSwitchLow  map[string]time.Time     // 上次切换到低频的时间
    rateController *AdaptiveRateController
}
```

#### 主要方法

| 方法 | 说明 |
|------|------|
| `ShouldSkipData(sensorID, history, now)` | 判断是否应跳过当前数据点，返回 (是否跳过, 新采样率) |
| `calculateVariance(data)` | 计算滑动窗口内的方差和均值 |
| `GetCurrentRate(sensorID)` | 获取传感器当前采样率 |
| `GetStatistics()` | 获取全局统计信息 |

### API 接口

#### 获取采样率统计

```
GET /api/sample-rates/statistics
```

响应示例：
```json
{
  "high_rate_count": 35,
  "low_rate_count": 15,
  "total_sensors": 50,
  "bandwidth_saved_percent": 24.0,
  "avg_temp_variance": 0.085,
  "avg_humidity_variance": 0.42,
  "sensor_rates": {
    "sensor_001": 100,
    "sensor_002": 500,
    ...
  }
}
```

#### 获取单个传感器采样率详情

```
GET /api/sensors/:id/sample-rate
```

响应示例：
```json
{
  "sensor_id": "sensor_001",
  "current_rate_ms": 100,
  "is_low_rate": false,
  "temp_variance": 0.85,
  "humidity_variance": 2.1,
  "temp_mean": 25.3,
  "humidity_mean": 52.1
}
```

## 前端组件

### 功能特性

1. **实时统计面板**
   - 高频/低频传感器数量
   - 预计带宽节省百分比
   - 平均温度/湿度方差

2. **传感器状态列表**
   - 网格布局展示所有50个传感器
   - 颜色编码显示采样率状态
   - 点击查看详细信息

3. **传感器详情面板**
   - 当前采样率和模式
   - 实时方差数值
   - 均值数据

4. **自动刷新**
   - 统计数据每2秒刷新
   - 选中传感器详情每1秒刷新

### 视觉设计

- 🟢 **绿色 (#00ff88)**: 高频采样 (100ms)，数据变化大
- 🟡 **橙色 (#ffaa00)**: 低频采样 (500ms)，数据稳定

## 预期效果

### 带宽节省

假设所有传感器都在理想条件下工作：

| 场景 | 平均采样率 | 带宽节省 |
|------|-----------|----------|
| 全高频 | 100ms | 0% |
| 50% 低频 | 300ms | 40% |
| 全低频 | 500ms | 80% |

### 实际场景

在实际环境中，预计 20-40% 的传感器会在大部分时间处于低频模式，整体可节省 15-30% 的带宽。

## 配置参数

```go
const (
    HighRateMs = 100   // 高频采样间隔
    LowRateMs  = 500   // 低频采样间隔

    VarianceWindowSize = 30    // 方差计算窗口大小 (数据点)

    LowVarianceThresholdTemp = 0.1     // 降低采样率温度阈值
    LowVarianceThresholdHumidity = 0.5 // 降低采样率湿度阈值
    HighVarianceThresholdTemp = 0.5    // 恢复采样率温度阈值
    HighVarianceThresholdHumidity = 2.0 // 恢复采样率湿度阈值

    StablePeriodRequired = 3000  // 防抖观察期 (毫秒)
)
```

## 数据模型扩展

```go
type CleanedData struct {
    // ...原有字段
    CurrentSampleRateMs int  // 当前采样率 (毫秒)
    SampleRateChanged   bool // 本次是否发生采样率变化
    WasSkipped          bool // 数据是否因采样率降低而被跳过
}
```

## 使用示例

### 查看全局统计

访问 Dashboard，在 "自适应采样率" 面板中可以看到：
- 当前高频/低频传感器数量
- 预计节省的带宽百分比
- 平均方差指标

### 查看单个传感器详情

1. 在传感器列表中点击任意传感器
2. 下方显示详情面板，包含：
   - 当前采样率和模式
   - 温度和湿度的实时方差
   - 数据均值

### 调整阈值 (开发)

修改 `gateway/ingester/adaptive_rate.go` 中的常量：

```go
const (
    LowVarianceThresholdTemp = 0.1    // 调整温度低方差阈值
    HighVarianceThresholdTemp = 0.5   // 调整温度高方差阈值
    // ...
)
```

## 注意事项

1. **窗口预热**：系统启动后需要收集至少10个数据点才开始计算方差
2. **防抖机制**：采样率切换不会立即发生，需观察3秒确保稳定
3. **边界情况**：方差非常大或非常小时不会来回振荡（高低阈值有间隔）
4. **统计延迟**：前端显示的统计数据可能有1-2秒延迟

## 未来优化方向

- [ ] 支持为不同传感器设置独立阈值
- [ ] 添加自适应阈值学习功能
- [ ] 支持更多采样率档位 (如 200ms, 1000ms)
- [ ] 添加采样率变化历史图表
- [ ] 基于预测的动态采样率调整

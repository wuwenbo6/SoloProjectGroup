# Bug修复总结：数据清洗插值算法改进

## 问题描述
当某个传感器连续10秒无数据时，原清洗模块使用前一个有效值进行简单填充，导致：
1. 数据出现"假平稳"现象
2. 异常检测的3-sigma算法无法准确计算标准差
3. 正常波动被误判为异常

## 修复方案

### 1. 数据模型改进 ([models/sensor.go](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p40/gateway/models/sensor.go#L15-L21))
新增字段：
- `MissingDurationMs`: 数据缺失时长（毫秒）
- `MissingCount`: 连续缺失次数
- `InterpolationMethod`: 插值方法标记

### 2. 数据清洗模块重构 ([ingester/data_cleaner.go](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p40/gateway/ingester/data_cleaner.go))
主要改进：

#### 新增核心常量
```go
const (
    MissingThreshold = 10 * time.Second  // 缺失阈值
    MovingAvgWindowSize = 20              // 滑动平均窗口大小
)
```

#### 新增状态追踪
- `lastSeen`: 记录每个传感器最后接收数据时间
- `missingCount`: 记录连续缺失次数

#### 插值算法改进
**原算法**: 简单线性插值（仅使用前后两点）
```go
// 已废弃
ratio := t.Sub(lastTime) / interval
temp = before.Temp + (after.Temp - before.Temp) * ratio
```

**新算法**: 滑动平均插值（基于历史20点真实数据）
```go
func (dc *DataCleaner) calculateMovingAverage(history []*models.CleanedData) (float64, float64) {
    // 只计算真实数据，排除插值数据
    for i := startIdx; i < len(history); i++ {
        if !history[i].IsInterpolated {
            tempSum += history[i].Temp
            humiditySum += history[i].Humidity
            validCount++
        }
    }
    return tempSum / float64(validCount), humiditySum / float64(validCount)
}
```

#### 新增API方法
- `CheckAndFillGap(sensorID, currentTime)`: 检测并填充数据缺口
- `GetMissingStatus(sensorID)`: 获取缺失状态

### 3. 异常检测模块增强 ([detector/anomaly_detector.go](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p40/gateway/detector/anomaly_detector.go))
新增恢复期机制：

#### 恢复期追踪
```go
type AnomalyDetector struct {
    recoveryTime  map[string]time.Time  // 恢复开始时间
    recoveryPause time.Duration          // 恢复暂停期（5秒）
    ...
}
```

#### 恢复期逻辑
```go
// 数据恢复后5秒内只更新窗口，不进行异常检测
if data.MissingCount > 0 {
    ad.recoveryTime[sensorID] = data.Timestamp
}

if recoveryStart, inRecovery := ad.recoveryTime[sensorID]; inRecovery {
    if data.Timestamp.Sub(recoveryStart) < ad.recoveryPause {
        // 恢复期内只更新窗口，不检测异常
        ad.tempWindows[sensorID].Add(data.Temp)
        return alerts
    }
    delete(ad.recoveryTime, sensorID)
}
```

## 修复效果对比

| 维度 | 修复前 | 修复后 |
|------|--------|--------|
| 插值方法 | 简单线性（前后2点） | 滑动平均（历史20点） |
| 数据权重 | 插值数据参与统计 | 只使用真实数据计算均值 |
| 异常检测 | 恢复后立即检测 | 5秒恢复期后开始检测 |
| 缺失标记 | 无 | 有完整的缺失时长和次数记录 |
| 误判率 | 高（假平稳导致标准差缩小） | 低（真实数据反映真实波动） |

## 关键设计决策

1. **排除插值数据参与统计**：计算滑动平均时只使用真实数据，避免自强化误差
2. **恢复期暂停检测**：给异常检测窗口留出数据稳定时间
3. **滑动窗口大小选择**：20个点约等于2秒数据量（100ms间隔），兼顾稳定性和时效性
4. **缺失阈值设定**：10秒与用户问题描述保持一致

## 测试验证要点

1. 连续10秒无数据后恢复：
   - 恢复数据应带有缺失标记
   - 恢复后5秒内不应触发异常告警
   - 插值数据使用历史均值而非单点值

2. 插值数据传播：
   - 插值数据的`IsInterpolated = true`
   - 异常检测自动跳过插值数据
   - 滑动平均计算自动排除插值数据

3. 告警准确性：
   - 真实异常（偏离3σ）应正常触发
   - 正常波动（3σ范围内）不应误报

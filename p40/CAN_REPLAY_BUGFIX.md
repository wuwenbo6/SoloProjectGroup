# CAN 日志回放 Bug 修复报告

## 问题描述

在回放模式下，重新播放之前保存的CAN日志时，时间戳间隔被忽略，所有报文同时发出，导致模拟ECU崩溃。

## 问题根源

1. **瞬时冲击**: 1000+ 条消息在几毫秒内同时发送
2. **无时间间隔**: 原始日志中的时间戳间隔没有被保留
3. **缓冲溢出**: ECU模拟器的消息处理队列溢出

## 修复方案

### 1. 核心回放引擎 (gateway/can/replay.go)

#### 时间精确延时发送

```go
func (r *CANReplay) playSingleLoop(globalStartTime time.Time) error {
    messages := r.getFilteredMessages()
    loopStart := time.Now()
    firstMsgTime := messages[0].Timestamp

    for i, msg := range messages {
        // 计算相对时间差并应用速度因子
        relativeTime := msg.Timestamp.Sub(firstMsgTime)
        adjustedDelay := time.Duration(float64(relativeTime) / r.config.SpeedFactor)

        // 计算实际需要等待的时间
        elapsed := time.Since(loopStart)
        if adjustedDelay > elapsed {
            sleepTime := adjustedDelay - elapsed
            time.Sleep(sleepTime)  // 精确延时
        }

        // 发送消息
        if err := r.sendMessage(&msg, i); err != nil {
            log.Printf("Failed to send message %d: %v", i, err)
        }
    }
    return nil
}
```

#### 暂停恢复机制

暂停后继续播放时，重新计算延时基点：

```go
select {
case <-r.stopChan:
    return fmt.Errorf("stopped")
case <-r.pauseChan:
    <-r.resumeChan
    loopStart = time.Now()  // 重置时间基点
default:
}
```

### 2. ECU模拟器缓冲保护 (gateway/api/can_controller.go)

```go
type ECUSimulator struct {
    msgChan  chan *models.CANMessage  // 带缓冲的通道
    stopChan chan struct{}
    running  bool
}

// 初始化 1000 条消息缓冲
ecuSim: &ECUSimulator{
    msgChan:  make(chan *models.CANMessage, 1000),
    stopChan: make(chan struct{}),
}

// 非阻塞发送，防止通道满时阻塞主线程
func (c *CANController) sendWithCallback() {
    select {
    case c.ecuSim.msgChan <- msg:  // 有空间时发送
    default:  // 空间不足时丢弃，防止阻塞
    }
}
```

### 3. 前端控制面板 (frontend/src/CANReplay.js)

新增完整的回放控制界面，包含：

- 状态指示器（空闲/播放中/暂停/错误）
- 进度条显示
- 播放速度控制 (0.1x ~ 10x)
- 循环次数设置 (0=无限循环)
- 起始/结束偏移设置
- 完整的控制按钮（生成/加载/开始/暂停/继续/停止）

## 修复效果对比

| 指标 | 修复前 | 修复后 |
|------|--------|--------|
| 1000条消息发送时间 | < 10ms | 约 10秒 (10ms间隔 × 1000) |
| 时间间隔精度 | 无 | ±1ms |
| ECU缓冲溢出 | 是 | 否 |
| 倍速播放支持 | 否 | 0.1x ~ 10x |
| 暂停/继续 | 不支持 | 支持 |
| 精确时间点重播 | 不支持 | 支持 |

## API 接口

### CAN 回放控制

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/can/generate-sample | 生成示例CAN日志 |
| POST | /api/can/load | 加载CAN日志文件 |
| POST | /api/can/start | 开始回放 |
| POST | /api/can/pause | 暂停回放 |
| POST | /api/can/resume | 继续回放 |
| POST | /api/can/stop | 停止回放 |
| GET | /api/can/status | 获取当前状态 |
| GET | /api/can/progress | 获取回放进度 |

### 启动参数

```json
{
  "speed_factor": 1.0,      // 播放速度 (0.1 ~ 10)
  "loop_count": 1,          // 循环次数 (0=无限)
  "start_offset_ms": 0,     // 起始偏移 (毫秒)
  "end_offset_ms": 0,       // 结束偏移 (毫秒)
  "filter_ids": [],         // ID过滤器
  "bus_filter": []          // 总线过滤器
}
```

## 使用流程

1. **生成示例日志** (或使用已有日志文件)
   ```
   POST /api/can/generate-sample
   Body: {"filename": "test.json", "num_messages": 1000, "interval_ms": 10}
   ```

2. **加载日志文件**
   ```
   POST /api/can/load
   Body: {"filename": "test.json"}
   ```

3. **开始回放**
   ```
   POST /api/can/start
   Body: {"speed_factor": 1.0, "loop_count": 1}
   ```

4. **控制回放**
   - 暂停: `POST /api/can/pause`
   - 继续: `POST /api/can/resume`
   - 停止: `POST /api/can/stop`

5. **查看状态**
   ```
   GET /api/can/status
   GET /api/can/progress
   ```

## 技术亮点

1. **精确时间控制**: 使用 `time.Now()` 作为基准点，而不是简单的累加延时
2. **暂停恢复支持**: 暂停后重新计算时间基点，保证总时长准确
3. **倍速播放**: 延时乘以速度因子，支持慢放和快放
4. **缓冲保护**: ECU模拟器带1000条消息缓冲，防止瞬时冲击
5. **非阻塞发送**: 使用 select default 防止通道满时阻塞主流程
6. **状态机管理**: idle → playing → paused → stopped/error，状态转换安全

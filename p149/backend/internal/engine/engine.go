package engine

import (
	"context"
	"encoding/json"
	"fmt"
	"plc-simulator/internal/models"
	"plc-simulator/internal/parser"
	"sync"
	"time"
)

const (
	// MaxCycleTime 单个扫描周期最大执行时间 (毫秒)
	MaxCycleTime = 50
	// WatchdogTimeout 看门狗超时时间 (毫秒)
	WatchdogTimeout = 1000
	// MaxConsecutiveTimeouts 最大连续超时次数
	MaxConsecutiveTimeouts = 5
)

// Engine PLC仿真引擎
type Engine struct {
	mu          sync.RWMutex
	Variables   map[string]*models.Variable
	Timers      map[string]*models.Timer
	IsRunning   bool
	CycleCount  int
	Rungs       []models.Rung
	cycleTicker *time.Ticker
	stopChan    chan struct{}

	// 看门狗相关
	watchdogTimer  *time.Timer
	lastCycleStart time.Time
	consecutiveTimeouts int
	errorCount     int
	lastError      error

	// 解析器
	ladderParser *parser.LadderParser

	// 取消函数
	cancelFunc context.CancelFunc
}

// NewEngine 创建新的仿真引擎
func NewEngine() *Engine {
	e := &Engine{
		Variables:    make(map[string]*models.Variable),
		Timers:       make(map[string]*models.Timer),
		stopChan:     make(chan struct{}, 1), // 带缓冲防止阻塞
		ladderParser: parser.NewLadderParser(),
	}
	e.initDefaultVariables()
	return e
}

// initDefaultVariables 初始化默认变量
func (e *Engine) initDefaultVariables() {
	// 输入变量 I0.0 - I0.7
	for i := 0; i < 8; i++ {
		name := fmt.Sprintf("I0.%d", i)
		e.Variables[name] = &models.Variable{
			Name:   name,
			Type:   "I",
			Value:  false,
			Forced: false,
		}
	}

	// 输出变量 Q0.0 - Q0.7
	for i := 0; i < 8; i++ {
		name := fmt.Sprintf("Q0.%d", i)
		e.Variables[name] = &models.Variable{
			Name:   name,
			Type:   "Q",
			Value:  false,
			Forced: false,
		}
	}

	// 内部变量 M0.0 - M1.7
	for byteIdx := 0; byteIdx < 2; byteIdx++ {
		for bitIdx := 0; bitIdx < 8; bitIdx++ {
			name := fmt.Sprintf("M%d.%d", byteIdx, bitIdx)
			e.Variables[name] = &models.Variable{
				Name:   name,
				Type:   "M",
				Value:  false,
				Forced: false,
			}
		}
	}

	// 定时器 T0 - T7
	for i := 0; i < 8; i++ {
		name := fmt.Sprintf("T%d", i)
		e.Timers[name] = &models.Timer{
			Name:    name,
			Preset:  1000,
			Current: 0,
			Input:   false,
			Output:  false,
			Running: false,
		}
	}
}

// Start 启动仿真
func (e *Engine) Start() {
	e.mu.Lock()
	defer e.mu.Unlock()

	if e.IsRunning {
		return
	}

	e.IsRunning = true
	e.CycleCount = 0
	e.consecutiveTimeouts = 0
	e.errorCount = 0
	e.lastError = nil
	e.cycleTicker = time.NewTicker(100 * time.Millisecond) // 100ms扫描周期

	// 启动看门狗
	e.startWatchdog()

	// 创建带取消的上下文
	ctx, cancel := context.WithCancel(context.Background())
	e.cancelFunc = cancel

	go e.runSimulation(ctx)
}

// startWatchdog 启动看门狗
func (e *Engine) startWatchdog() {
	e.watchdogTimer = time.AfterFunc(time.Duration(WatchdogTimeout)*time.Millisecond, func() {
		e.handleWatchdogTimeout()
	})
}

// handleWatchdogTimeout 处理看门狗超时
func (e *Engine) handleWatchdogTimeout() {
	e.mu.Lock()
	defer e.mu.Unlock()

	if !e.IsRunning {
		return
	}

	e.consecutiveTimeouts++
	e.errorCount++
	e.lastError = fmt.Errorf("看门狗超时: 扫描周期执行超过 %d ms", WatchdogTimeout)

	// 如果连续超时次数过多，紧急停止仿真
	if e.consecutiveTimeouts >= MaxConsecutiveTimeouts {
		e.lastError = fmt.Errorf("连续 %d 次超时，紧急停止仿真", MaxConsecutiveTimeouts)
		e.doEmergencyStop()
		return
	}

	// 重置看门狗，继续下一个周期
	e.resetWatchdog()
}

// resetWatchdog 重置看门狗
func (e *Engine) resetWatchdog() {
	if e.watchdogTimer != nil {
		e.watchdogTimer.Stop()
	}
	e.watchdogTimer = time.AfterFunc(time.Duration(WatchdogTimeout)*time.Millisecond, func() {
		e.handleWatchdogTimeout()
	})
}

// doEmergencyStop 紧急停止
func (e *Engine) doEmergencyStop() {
	if e.watchdogTimer != nil {
		e.watchdogTimer.Stop()
	}
	if e.cycleTicker != nil {
		e.cycleTicker.Stop()
	}
	if e.cancelFunc != nil {
		e.cancelFunc()
	}

	// 安全停机：所有输出复位
	for _, v := range e.Variables {
		if v.Type == "Q" && !v.Forced {
			v.Value = false
		}
	}

	e.IsRunning = false
}

// Stop 停止仿真
func (e *Engine) Stop() {
	e.mu.Lock()
	defer e.mu.Unlock()

	if !e.IsRunning {
		return
	}

	e.IsRunning = false
	if e.watchdogTimer != nil {
		e.watchdogTimer.Stop()
	}
	if e.cycleTicker != nil {
		e.cycleTicker.Stop()
	}
	if e.cancelFunc != nil {
		e.cancelFunc()
	}

	select {
	case e.stopChan <- struct{}{}:
	default:
		// 通道已满，忽略
	}
}

// runSimulation 运行仿真循环
func (e *Engine) runSimulation(ctx context.Context) {
	for {
		select {
		case <-e.cycleTicker.C:
			e.executeCycleWithTimeout(ctx)
		case <-e.stopChan:
			return
		case <-ctx.Done():
			return
		}
	}
}

// executeCycleWithTimeout 带超时保护的扫描周期
func (e *Engine) executeCycleWithTimeout(ctx context.Context) {
	e.mu.Lock()
	defer e.mu.Unlock()

	if !e.IsRunning {
		return
	}

	cycleStart := time.Now()
	e.lastCycleStart = cycleStart
	e.ladderParser.Reset()

	// 创建周期级别的超时上下文
	cycleCtx, cancel := context.WithTimeout(ctx, time.Duration(MaxCycleTime)*time.Millisecond)
	defer cancel()

	done := make(chan struct{}, 1)

	go func() {
		defer func() {
			// 捕获panic，防止单个周期错误导致整个引擎崩溃
			if r := recover(); r != nil {
				e.errorCount++
				e.lastError = fmt.Errorf("扫描周期panic: %v", r)
			}
			done <- struct{}{}
		}()

		e.CycleCount++

		// 更新定时器
		e.updateTimers()

		// 执行梯形图逻辑
		e.executeLogicSafe()

		// 重置连续超时计数
		e.consecutiveTimeouts = 0
	}()

	select {
	case <-done:
		// 周期正常完成
		e.resetWatchdog()
	case <-cycleCtx.Done():
		// 周期超时
		e.consecutiveTimeouts++
		e.errorCount++
		e.lastError = fmt.Errorf("扫描周期执行超时 (限制: %dms)", MaxCycleTime)

		if e.consecutiveTimeouts >= MaxConsecutiveTimeouts {
			e.doEmergencyStop()
		}
	}
}

// executeLogicSafe 安全执行梯形图逻辑（带错误恢复）
func (e *Engine) executeLogicSafe() {
	defer func() {
		if r := recover(); r != nil {
			e.lastError = fmt.Errorf("逻辑执行panic: %v", r)
		}
	}()

	// 执行所有梯级
	for _, rung := range e.Rungs {
		if rung.Logic == nil {
			continue
		}

		// 使用迭代式求值器执行逻辑
		result, err := e.ladderParser.EvaluateLogicNode(rung.Logic, e.getVariableValue)
		if err != nil {
			e.errorCount++
			e.lastError = err
			continue
		}

		// 处理线圈输出...
		_ = result
	}
}

// getVariableValue 获取变量值（供解析器使用）
func (e *Engine) getVariableValue(name string) (bool, bool) {
	if v, ok := e.Variables[name]; ok {
		if boolVal, ok := v.Value.(bool); ok {
			return boolVal, true
		}
	}
	return false, false
}

// updateTimers 更新定时器状态
func (e *Engine) updateTimers() {
	for _, timer := range e.Timers {
		if timer.Input && timer.Running {
			timer.Current += 100 // 每个周期增加100ms
			if timer.Current >= timer.Preset {
				timer.Output = true
				timer.Current = timer.Preset
			}
		} else if !timer.Input {
			timer.Current = 0
			timer.Output = false
			timer.Running = false
		}
	}
}

// executeLogic 执行梯形图逻辑（保留向后兼容）
func (e *Engine) executeLogic() {
	e.executeLogicSafe()
}

// SetVariable 设置变量值
func (e *Engine) SetVariable(name string, value interface{}, forced bool) {
	e.mu.Lock()
	defer e.mu.Unlock()

	if v, ok := e.Variables[name]; ok {
		v.Value = value
		v.Forced = forced
	}
}

// GetVariable 获取变量值
func (e *Engine) GetVariable(name string) (*models.Variable, bool) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	v, ok := e.Variables[name]
	return v, ok
}

// GetAllVariables 获取所有变量
func (e *Engine) GetAllVariables() []models.Variable {
	e.mu.RLock()
	defer e.mu.RUnlock()

	vars := make([]models.Variable, 0, len(e.Variables))
	for _, v := range e.Variables {
		vars = append(vars, *v)
	}
	return vars
}

// LoadProgram 加载梯形图程序（带复杂度验证）
func (e *Engine) LoadProgram(jsonData string) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	var rungs []models.Rung
	if err := json.Unmarshal([]byte(jsonData), &rungs); err != nil {
		return fmt.Errorf("程序解析失败: %w", err)
	}

	// 验证程序复杂度
	if err := parser.ValidateProgram(rungs); err != nil {
		return fmt.Errorf("程序验证失败: %w", err)
	}

	e.Rungs = rungs
	return nil
}

// ReleaseForce 释放强制
func (e *Engine) ReleaseForce(name string) {
	e.mu.Lock()
	defer e.mu.Unlock()

	if v, ok := e.Variables[name]; ok {
		v.Forced = false
	}
}

// ReleaseAllForces 释放所有强制
func (e *Engine) ReleaseAllForces() {
	e.mu.Lock()
	defer e.mu.Unlock()

	for _, v := range e.Variables {
		v.Forced = false
	}
}

// GetStats 获取引擎状态统计
func (e *Engine) GetStats() map[string]interface{} {
	e.mu.RLock()
	defer e.mu.RUnlock()

	return map[string]interface{}{
		"is_running":           e.IsRunning,
		"cycle_count":          e.CycleCount,
		"error_count":          e.errorCount,
		"consecutive_timeouts": e.consecutiveTimeouts,
		"last_error":           e.lastError,
		"rung_count":           len(e.Rungs),
	}
}

// IsHealthy 检查引擎是否健康
func (e *Engine) IsHealthy() bool {
	e.mu.RLock()
	defer e.mu.RUnlock()

	if !e.IsRunning {
		return true // 未运行时视为健康
	}

	return e.consecutiveTimeouts == 0
}

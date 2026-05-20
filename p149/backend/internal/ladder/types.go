package ladder

// ElementType 梯形图元件类型
type ElementType string

const (
	ElementNormOpen    ElementType = "NORM_OPEN"    // 常开触点
	ElementNormClosed  ElementType = "NORM_CLOSED"  // 常闭触点
	ElementCoil        ElementType = "COIL"          // 输出线圈
	ElementCoilNegate  ElementType = "COIL_NEGATE"   // 取反线圈
	ElementSet         ElementType = "SET"           // 置位线圈
	ElementReset       ElementType = "RESET"         // 复位线圈
	ElementTimerOn     ElementType = "TIMER_ON"      // 接通延时定时器
	ElementTimerOff    ElementType = "TIMER_OFF"     // 断开延时定时器
	ElementTimerPulse  ElementType = "TIMER_PULSE"   // 脉冲定时器
	ElementCounterUp   ElementType = "COUNTER_UP"    // 加计数器
	ElementCounterDown ElementType = "COUNTER_DOWN"  // 减计数器
)

// Element 梯形图元件
type Element struct {
	ID         string                 `json:"id"`
	Type       ElementType            `json:"type"`
	Name       string                 `json:"name"`
	Address    string                 `json:"address"`
	PositionX  int                    `json:"positionX"`
	PositionY  int                    `json:"positionY"`
	Parameters map[string]interface{} `json:"parameters,omitempty"`
}

// Rung 梯级
type Rung struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Elements    []Element `json:"elements"`
	Enabled     bool      `json:"enabled"`
}

// Program 梯形图程序
type Program struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Version     string   `json:"version"`
	Rungs       []Rung   `json:"rungs"`
	CreateTime  int64    `json:"createTime"`
	UpdateTime  int64    `json:"updateTime"`
}

// ExecutionState 执行状态
type ExecutionState struct {
	CycleCount    int64                `json:"cycleCount"`
	CycleTimeMs   int64                `json:"cycleTimeMs"`
	VariableState map[string]bool      `json:"variableState"`
	TimerStates   map[string]TimerState `json:"timerStates"`
	Running       bool                 `json:"running"`
}

// TimerState 定时器状态
type TimerState struct {
	CurrentValue int  `json:"currentValue"`
	PresetValue  int  `json:"presetValue"`
	Done         bool `json:"done"`
	Running      bool `json:"running"`
}

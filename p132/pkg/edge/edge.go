package edge

import (
	"math"
	"sync"
	"time"

	"modbus-mqtt-gateway/pkg/config"
	"modbus-mqtt-gateway/pkg/converter"
)

type AlarmLevel string

const (
	AlarmNormal AlarmLevel = "normal"
	AlarmLow    AlarmLevel = "low"
	AlarmHigh   AlarmLevel = "high"
)

type ProcessedData struct {
	Name          string
	Value         float64
	MovingAvg     float64
	Unit          string
	AlarmLevel    AlarmLevel
	ShouldReport  bool
	Timestamp     int64
}

type RegisterState struct {
	config        config.RegisterConfig
	values        []float64
	lastReported  float64
	lastAlarm     AlarmLevel
	lock          sync.RWMutex
}

type EdgeProcessor struct {
	states map[string]*RegisterState
	config *config.EdgeConfig
	lock   sync.RWMutex
}

func NewEdgeProcessor(edgeConfig *config.EdgeConfig, registers []config.RegisterConfig) *EdgeProcessor {
	states := make(map[string]*RegisterState)
	for _, reg := range registers {
		states[reg.Name] = &RegisterState{
			config:       reg,
			values:       make([]float64, 0, reg.MovingAvgWindow),
			lastReported: math.NaN(),
			lastAlarm:    AlarmNormal,
		}
	}
	return &EdgeProcessor{
		states: states,
		config: edgeConfig,
	}
}

func (ep *EdgeProcessor) Process(data converter.RegisterData) ProcessedData {
	ep.lock.RLock()
	state, exists := ep.states[data.Register.Name]
	ep.lock.RUnlock()

	if !exists {
		return ProcessedData{
			Name:         data.Register.Name,
			Value:        data.Value,
			ShouldReport: true,
			Timestamp:    time.Now().Unix(),
		}
	}

	state.lock.Lock()
	defer state.lock.Unlock()

	movingAvg := data.Value
	if ep.config.EnableMovingAvg {
		state.values = append(state.values, data.Value)
		if len(state.values) > state.config.MovingAvgWindow {
			state.values = state.values[1:]
		}
		movingAvg = calculateAverage(state.values)
	}

	alarmLevel := ep.checkThreshold(data.Register.Name, data.Value)

	shouldReport := false
	if math.IsNaN(state.lastReported) {
		shouldReport = true
	} else if math.Abs(data.Value-state.lastReported) >= state.config.ChangeThreshold {
		shouldReport = true
	}
	if alarmLevel != state.lastAlarm {
		shouldReport = true
	}

	if shouldReport {
		state.lastReported = data.Value
		state.lastAlarm = alarmLevel
	}

	return ProcessedData{
		Name:         data.Register.Name,
		Value:        data.Value,
		MovingAvg:    movingAvg,
		Unit:         data.Register.Unit,
		AlarmLevel:   alarmLevel,
		ShouldReport: shouldReport,
		Timestamp:    time.Now().Unix(),
	}
}

func (ep *EdgeProcessor) checkThreshold(name string, value float64) AlarmLevel {
	if !ep.config.EnableThresholdAlarm {
		return AlarmNormal
	}

	for _, threshold := range ep.config.AlarmThresholds {
		if threshold.Name == name {
			if threshold.MinValue != 0 && value < threshold.MinValue {
				return AlarmLow
			}
			if threshold.MaxValue != 0 && value > threshold.MaxValue {
				return AlarmHigh
			}
		}
	}
	return AlarmNormal
}

func calculateAverage(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	sum := 0.0
	for _, v := range values {
		sum += v
	}
	return sum / float64(len(values))
}

func (ep *EdgeProcessor) UpdateConfig(edgeConfig *config.EdgeConfig, registers []config.RegisterConfig) {
	ep.lock.Lock()
	defer ep.lock.Unlock()

	ep.config = edgeConfig
	newStates := make(map[string]*RegisterState)
	
	for _, reg := range registers {
		if oldState, exists := ep.states[reg.Name]; exists {
			oldState.lock.Lock()
			oldState.config = reg
			if cap(oldState.values) != reg.MovingAvgWindow {
				oldState.values = make([]float64, 0, reg.MovingAvgWindow)
			}
			oldState.lock.Unlock()
			newStates[reg.Name] = oldState
		} else {
			newStates[reg.Name] = &RegisterState{
				config:       reg,
				values:       make([]float64, 0, reg.MovingAvgWindow),
				lastReported: math.NaN(),
				lastAlarm:    AlarmNormal,
			}
		}
	}
	
	ep.states = newStates
}

package interpreter

import (
	"fmt"
	"sync"

	"github.com/wuwenbo/fsm-dsl/interpreter/pkg/types"
)

type Interpreter struct {
	machine            *types.StateMachine
	state              *types.ExecutionState
	stateMap           map[string]types.State
	actionMap          map[string]types.Action
	breakpointMap      map[string]bool
	stepMode           bool
	stepCount          int
	maxSteps           int
	cycleDetectionMap  map[string]int
	pauseChan          chan bool
	resumeChan         chan bool
	eventChan          chan string
	mu                 sync.RWMutex
	onStateChange      func(*types.ExecutionState)
	onCycleDetected    func(cycle []string, count int)
}

func NewInterpreter(machine *types.StateMachine) *Interpreter {
	stateMap := make(map[string]types.State)
	actionMap := make(map[string]types.Action)

	for _, s := range machine.States {
		stateMap[s.Name] = s
	}
	for _, a := range machine.Actions {
		actionMap[a.Name] = a
	}

	return &Interpreter{
		machine: machine,
		state: &types.ExecutionState{
			CurrentState: machine.Initial,
			Stack:        []string{machine.Initial},
			Breakpoints:  []string{},
			IsPaused:     false,
		},
		stateMap:          stateMap,
		actionMap:         actionMap,
		breakpointMap:     make(map[string]bool),
		stepMode:          false,
		stepCount:         0,
		maxSteps:          1000,
		cycleDetectionMap: make(map[string]int),
		pauseChan:         make(chan bool),
		resumeChan:        make(chan bool),
		eventChan:         make(chan string, 10),
	}
}

func (i *Interpreter) SetOnStateChange(fn func(*types.ExecutionState)) {
	i.onStateChange = fn
}

func (i *Interpreter) SetOnCycleDetected(fn func(cycle []string, count int)) {
	i.onCycleDetected = fn
}

func (i *Interpreter) SetMaxSteps(max int) {
	i.mu.Lock()
	defer i.mu.Unlock()
	i.maxSteps = max
}

func (i *Interpreter) Start() error {
	i.executeEnterAction(i.state.CurrentState)
	go i.eventLoop()
	return nil
}

func (i *Interpreter) SendEvent(event string) {
	i.eventChan <- event
}

func (i *Interpreter) eventLoop() {
	for event := range i.eventChan {
		i.mu.Lock()

		i.stepCount++
		if i.stepCount > i.maxSteps {
			i.state.IsPaused = true
			i.state.Error = fmt.Sprintf("Maximum step count exceeded: %d steps", i.maxSteps)
			if i.onStateChange != nil {
				i.onStateChange(i.state)
			}
			i.mu.Unlock()
			<-i.resumeChan
			i.mu.Lock()
			i.stepCount = 0
			i.state.IsPaused = false
		}

		currentState, exists := i.stateMap[i.state.CurrentState]
		if !exists {
			i.mu.Unlock()
			continue
		}

		var transition *types.Transition
		for _, t := range currentState.Transitions {
			if t.Event == event && t.Target != "" {
				transition = &t
				break
			}
		}

		if transition == nil {
			i.mu.Unlock()
			continue
		}

		i.executeExitAction(i.state.CurrentState)

		i.state.PreviousState = i.state.CurrentState
		i.state.CurrentState = transition.Target
		i.state.LastEvent = event
		i.state.Stack = append(i.state.Stack, transition.Target)

		i.executeEnterAction(transition.Target)

		cycle, count := i.detectCycle()
		if cycle != nil {
			i.state.CycleDetected = cycle
			if i.onCycleDetected != nil {
				i.onCycleDetected(cycle, count)
			}
		}

		if i.onStateChange != nil {
			i.onStateChange(i.state)
		}

		shouldPause := i.checkBreakpoint(transition.Target) || i.stepMode || (cycle != nil && len(cycle) > 0)

		if i.stepMode {
			i.stepMode = false
		}

		i.mu.Unlock()

		if shouldPause {
			i.state.IsPaused = true
			<-i.resumeChan
			i.state.IsPaused = false
		}
	}
}

func (i *Interpreter) detectCycle() ([]string, int) {
	stackLen := len(i.state.Stack)
	if stackLen < 3 {
		return nil, 0
	}

	for cycleLen := 2; cycleLen <= stackLen/2; cycleLen++ {
		isCycle := true
		for j := 0; j < cycleLen; j++ {
			if i.state.Stack[stackLen-cycleLen+j] != i.state.Stack[stackLen-2*cycleLen+j] {
				isCycle = false
				break
			}
		}
		if isCycle {
			cycle := i.state.Stack[stackLen-cycleLen : stackLen]
			cycleKey := fmt.Sprintf("%v", cycle)
			i.cycleDetectionMap[cycleKey]++
			return cycle, i.cycleDetectionMap[cycleKey]
		}
	}

	visited := make(map[string]int)
	for idx, state := range i.state.Stack {
		if prevIdx, exists := visited[state]; exists {
			cycle := i.state.Stack[prevIdx:idx]
			if len(cycle) >= 2 {
				cycleKey := fmt.Sprintf("%v", cycle)
				i.cycleDetectionMap[cycleKey]++
				return cycle, i.cycleDetectionMap[cycleKey]
			}
		}
		visited[state] = idx
	}

	return nil, 0
}

func (i *Interpreter) executeEnterAction(stateName string) {
	if state, ok := i.stateMap[stateName]; ok && state.OnEnter != "" {
		i.executeAction(state.OnEnter)
	}
}

func (i *Interpreter) executeExitAction(stateName string) {
	if state, ok := i.stateMap[stateName]; ok && state.OnExit != "" {
		i.executeAction(state.OnExit)
	}
}

func (i *Interpreter) executeAction(actionName string) {
	if action, ok := i.actionMap[actionName]; ok {
		fmt.Printf("Executing action: %s\nCode: %s\n", actionName, action.Code)
	}
}

func (i *Interpreter) AddBreakpoint(stateName string) {
	i.mu.Lock()
	defer i.mu.Unlock()
	i.breakpointMap[stateName] = true
	i.updateBreakpointsList()
}

func (i *Interpreter) RemoveBreakpoint(stateName string) {
	i.mu.Lock()
	defer i.mu.Unlock()
	delete(i.breakpointMap, stateName)
	i.updateBreakpointsList()
}

func (i *Interpreter) updateBreakpointsList() {
	i.state.Breakpoints = make([]string, 0, len(i.breakpointMap))
	for name := range i.breakpointMap {
		i.state.Breakpoints = append(i.state.Breakpoints, name)
	}
}

func (i *Interpreter) checkBreakpoint(stateName string) bool {
	i.mu.RLock()
	defer i.mu.RUnlock()
	return i.breakpointMap[stateName]
}

func (i *Interpreter) Pause() {
	i.mu.Lock()
	defer i.mu.Unlock()
	i.state.IsPaused = true
}

func (i *Interpreter) Resume() {
	i.mu.Lock()
	defer i.mu.Unlock()
	i.state.IsPaused = false
	select {
	case i.resumeChan <- true:
	default:
	}
}

func (i *Interpreter) Step() {
	i.mu.Lock()
	i.stepMode = true
	i.mu.Unlock()
	i.Resume()
}

func (i *Interpreter) SetStepMode(enabled bool) {
	i.mu.Lock()
	defer i.mu.Unlock()
	i.stepMode = enabled
}

func (i *Interpreter) GetExecutionState() *types.ExecutionState {
	i.mu.RLock()
	defer i.mu.RUnlock()
	return &types.ExecutionState{
		CurrentState:  i.state.CurrentState,
		PreviousState: i.state.PreviousState,
		LastEvent:     i.state.LastEvent,
		Stack:         append([]string{}, i.state.Stack...),
		IsPaused:      i.state.IsPaused,
		Breakpoints:   append([]string{}, i.state.Breakpoints...),
	}
}

func (i *Interpreter) Reset() {
	i.mu.Lock()
	defer i.mu.Unlock()
	i.state = &types.ExecutionState{
		CurrentState:  i.machine.Initial,
		Stack:         []string{i.machine.Initial},
		Breakpoints:   i.state.Breakpoints,
		IsPaused:      false,
		CycleDetected: nil,
		Error:         "",
	}
	i.stepCount = 0
	i.cycleDetectionMap = make(map[string]int)
	if i.onStateChange != nil {
		i.onStateChange(i.state)
	}
}

func (i *Interpreter) Stop() {
	close(i.eventChan)
}

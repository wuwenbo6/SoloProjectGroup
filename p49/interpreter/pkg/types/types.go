package types

type State struct {
	Name        string       `json:"name"`
	OnEnter     string       `json:"onEnter,omitempty"`
	OnExit      string       `json:"onExit,omitempty"`
	Transitions []Transition `json:"transitions"`
}

type Transition struct {
	Event  string `json:"event"`
	Target string `json:"target"`
	Action string `json:"action,omitempty"`
}

type Action struct {
	Name string `json:"name"`
	Code string `json:"code"`
}

type StateMachine struct {
	Name    string   `json:"name"`
	Initial string   `json:"initial"`
	States  []State  `json:"states"`
	Actions []Action `json:"actions"`
}

type ExecutionState struct {
	CurrentState  string   `json:"currentState"`
	PreviousState string   `json:"previousState,omitempty"`
	LastEvent     string   `json:"lastEvent,omitempty"`
	Stack         []string `json:"stack"`
	IsPaused      bool     `json:"isPaused"`
	Breakpoints   []string `json:"breakpoints"`
	Error         string   `json:"error,omitempty"`
	CycleDetected []string `json:"cycleDetected,omitempty"`
}

type WSMessage struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

export interface State {
  name: string;
  onEnter?: string;
  onExit?: string;
  transitions: Transition[];
}

export interface Transition {
  event: string;
  target: string;
  action?: string;
}

export interface Action {
  name: string;
  code: string;
}

export interface StateMachine {
  name: string;
  initial: string;
  states: State[];
  actions: Action[];
}

export interface ExecutionState {
  currentState: string;
  previousState: string | null;
  lastEvent: string | null;
  stack: string[];
  isPaused: boolean;
  breakpoints: string[];
  error?: string;
  cycleDetected?: string[];
}

export interface WSMessage {
  type: 'breakpoint' | 'step' | 'resume' | 'pause' | 'state' | 'event';
  payload: any;
}

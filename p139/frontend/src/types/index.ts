export interface Gate {
  type: string;
  target: number;
  controls?: number[];
}

export interface Circuit {
  id: string;
  name?: string;
  num_qubits: number;
  gates: Gate[];
  created_at: string;
  updated_at?: string;
}

export interface BlochCoordinates {
  x: number;
  y: number;
  z: number;
}

export interface Job {
  id: string;
  circuit_id?: string;
  num_qubits: number;
  gates: Gate[];
  shots: number;
  status: string;
  state_vector?: string[];
  probabilities?: Record<string, number>;
  measurements?: Record<string, number>;
  bloch_spheres?: BlochCoordinates[];
  execution_time?: number;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export interface CircuitState {
  numQubits: number;
  gates: Gate[];
  currentJob: Job | null;
  results: SimulationResult | null;
  isRunning: boolean;
  
  setNumQubits: (n: number) => void;
  addGate: (gate: Gate) => void;
  removeGate: (index: number) => void;
  clearCircuit: () => void;
  runCircuit: () => Promise<void>;
  setCurrentJob: (job: Job | null) => void;
  setResults: (results: SimulationResult | null) => void;
}

export interface SimulationResult {
  probabilities: Record<string, number>;
  measurements: Record<string, number>;
  bloch_spheres: BlochCoordinates[];
  execution_time: number;
}

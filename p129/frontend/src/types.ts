export type ParticleState = 'foraging' | 'attacking' | 'reproducing' | 'sleeping';

export interface Particle {
  id: string;
  position: Float32Array;
  velocity: Float32Array;
  state: ParticleState;
  energy: number;
  age: number;
  maxAge: number;
}

export interface ParticleData {
  id: string;
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  state: ParticleState;
  energy: number;
  isDead?: boolean;
}

export interface SimulationConfig {
  particleCount: number;
  boundarySize: number;
  speed: number;
  energyDecayRate: number;
  sleepThreshold: number;
  wakeThreshold: number;
  reproductionThreshold: number;
  attackDistance: number;
  terrainInfluence: number;
  energyFieldStrength: number;
}

export interface HistoryFrame {
  timestamp: number;
  particles: ParticleData[];
}

export interface Point {
  x: number;
  y: number;
  z: number;
}

export interface Node {
  id: string;
  position: Point;
  velocity: Point;
  acceleration: Point;
  mass: number;
  isFixed: boolean;
  stress: number;
  maxStress: number;
}

export interface Edge {
  id: string;
  startNodeId: string;
  endNodeId: string;
  length: number;
  stiffness: number;
  damping: number;
  currentForce: number;
  maxForce: number;
}

export interface Skeleton {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
  createdAt: Date;
  updatedAt: Date;
}

export interface StressConfig {
  gravity: number;
  iterationSteps: number;
  dampingFactor: number;
}

export interface StressResult {
  nodeStresses: Map<string, number>;
  edgeForces: Map<string, number>;
  totalPotentialEnergy: number;
  isStable: boolean;
}

export interface WindConfig {
  speed: number;
  direction: Point;
  turbulence: number;
  frequency: number;
}

export interface HangingConfig {
  anchorPoints: string[];
  gravity: Point;
  airResistance: number;
}

export interface Level {
  id: string;
  name: string;
  description: string;
  difficulty: number;
  targetSkeleton?: Skeleton;
  constraints: LevelConstraints;
  objectives: Objective[];
  unlocked: boolean;
  completed: boolean;
  stars: number;
}

export interface LevelConstraints {
  maxNodes: number;
  maxEdges: number;
  maxWeight: number;
  minStressThreshold: number;
  windResistance?: WindConfig;
}

export interface Objective {
  id: string;
  description: string;
  type: 'stress' | 'weight' | 'stability' | 'wind';
  targetValue: number;
  currentValue?: number;
  completed: boolean;
}

export interface SaveData {
  id: string;
  name: string;
  skeleton: Skeleton;
  currentLevelId?: string;
  progress: LevelProgress;
  createdAt: Date;
  updatedAt: Date;
}

export interface LevelProgress {
  completedLevels: string[];
  levelStars: Map<string, number>;
  totalScore: number;
}

export interface SimulationState {
  skeleton: Skeleton;
  stressConfig: StressConfig;
  windConfig: WindConfig;
  hangingConfig: HangingConfig;
  time: number;
  isRunning: boolean;
}

export interface ClothConfig {
  width: number;
  height: number;
  columns: number;
  rows: number;
  stiffness: number;
  damping: number;
  mass: number;
  gravity: Point;
  windInfluence: number;
}

export interface ClothParticle {
  position: Point;
  velocity: Point;
  acceleration: Point;
  mass: number;
  isFixed: boolean;
  normal: Point;
}

export interface ClothConstraint {
  particleA: number;
  particleB: number;
  restLength: number;
  stiffness: number;
}

export interface ClothSimulation {
  particles: ClothParticle[];
  constraints: ClothConstraint[];
  config: ClothConfig;
}

export interface Light {
  id: string;
  type: 'point' | 'spot' | 'directional' | 'ambient';
  position: Point;
  direction?: Point;
  color: Color;
  intensity: number;
  range?: number;
  angle?: number;
  castShadows?: boolean;
}

export interface Color {
  r: number;
  g: number;
  b: number;
  a?: number;
}

export interface Material {
  id: string;
  name: string;
  color: Color;
  emissiveColor?: Color;
  emissiveIntensity?: number;
  roughness: number;
  metalness: number;
  transparency: number;
}

export interface RenderConfig {
  ambientIntensity: number;
  backgroundColor: Color;
  enableShadows: boolean;
  enableReflections: boolean;
  exposure: number;
}

export interface RenderState {
  lights: Light[];
  materials: Map<string, Material>;
  config: RenderConfig;
  cameraPosition: Point;
  cameraTarget: Point;
}

export interface User {
  id: string;
  name: string;
  avatar?: string;
  color: Color;
  isOnline: boolean;
  cursorPosition?: Point;
  selectedNodeId?: string;
}

export interface CollaborationAction {
  id: string;
  userId: string;
  userName: string;
  type: 'node_add' | 'node_remove' | 'node_move' | 'node_fix' | 'edge_add' | 'edge_remove' | 'light_add' | 'light_remove' | 'light_update' | 'material_update';
  timestamp: number;
  data: Record<string, any>;
}

export interface CollaborationSession {
  id: string;
  name: string;
  hostId: string;
  users: User[];
  skeletonId: string;
  createdAt: Date;
  lastActivity: Date;
  isPublic: boolean;
  maxUsers: number;
  actionHistory: CollaborationAction[];
}

export interface SharedWork {
  id: string;
  title: string;
  description: string;
  authorId: string;
  authorName: string;
  skeleton: Skeleton;
  renderState?: RenderState;
  likes: number;
  views: number;
  tags: string[];
  createdAt: Date;
  isPublic: boolean;
  allowRemix: boolean;
  remixCount: number;
  parentId?: string;
}

export interface ShareConfig {
  title: string;
  description: string;
  tags: string[];
  isPublic: boolean;
  allowRemix: boolean;
  includeRenderState: boolean;
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: Date;
  likes: number;
}

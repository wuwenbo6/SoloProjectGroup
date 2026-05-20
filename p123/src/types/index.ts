export type ObjectType = 'waterwheel' | 'gear' | 'waterSource' | 'load';

export type MaterialType = 'wood' | 'metal' | 'plastic' | 'stone';
export type LoadType = 'generator' | 'millstone' | 'pump' | 'conveyor';
export type UserColor = 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'cyan';

export interface Material {
  type: MaterialType;
  name: string;
  durability: number;
  friction: number;
  strength: number;
  density: number;
  color: string;
}

export interface LoadAttachment {
  type: LoadType;
  name: string;
  efficiency: number;
  powerConsumption: number;
  connectedGearId: string | null;
}

export interface CollaborationUser {
  id: string;
  name: string;
  color: UserColor;
  online: boolean;
  objectsCreated: number;
}

export interface EditHistory {
  id: string;
  userId: string;
  action: 'create' | 'delete' | 'move' | 'modify';
  objectId: string;
  objectType: ObjectType;
  timestamp: number;
}

export interface BaseObject {
  id: string;
  x: number;
  y: number;
  rotation: number;
  type: ObjectType;
  material?: MaterialType;
  durability?: number;
  maxDurability?: number;
  creatorId?: string;
}

export interface WaterWheel extends BaseObject {
  radius: number;
  bladeCount: number;
  angularVelocity: number;
  angularAcceleration: number;
}

export interface Gear extends BaseObject {
  radius: number;
  teeth: number;
  angularVelocity: number;
  connectedTo: string[];
  attachedLoad?: LoadAttachment | null;
}

export interface WaterSource extends BaseObject {
  flowRate: number;
  width: number;
  active: boolean;
}

export interface LoadObject extends BaseObject {
  loadType: LoadType;
  efficiency: number;
  isRunning: boolean;
  connectedTo: string | null;
  output: number;
}

export interface WaterLevel {
  height: number;
  targetHeight: number;
  maxHeight: number;
  minHeight: number;
}

export interface Level {
  id: number;
  name: string;
  description: string;
  targetRPM: number;
  timeLimit: number;
  initialObjects: BaseObject[];
  stars: { rpm: number; time: number }[];
}

export interface SaveData {
  id: string;
  name: string;
  timestamp: number;
  levelId: number;
  objects: BaseObject[];
  waterLevel: WaterLevel;
  score: number;
  totalPowerOutput?: number;
  shareCode?: string;
}

export type ToolType = 'select' | 'waterwheel' | 'gear' | 'waterSource' | 'delete' | 'load';

export interface GameState {
  objects: BaseObject[];
  waterLevel: WaterLevel;
  selectedTool: ToolType;
  selectedObjectId: string | null;
  currentLevelId: number | null;
  isPlaying: boolean;
  score: number;
  elapsedTime: number;
  currentUser: CollaborationUser;
  allUsers: CollaborationUser[];
  editHistory: EditHistory[];
  showCollaborationPanel: boolean;
  totalPowerOutput: number;
  selectedLoadType: LoadType;
}

export const MATERIALS: Record<MaterialType, Material> = {
  wood: {
    type: 'wood',
    name: '木材',
    durability: 100,
    friction: 0.1,
    strength: 50,
    density: 0.6,
    color: '#8B4513',
  },
  metal: {
    type: 'metal',
    name: '金属',
    durability: 200,
    friction: 0.05,
    strength: 150,
    density: 7.8,
    color: '#708090',
  },
  plastic: {
    type: 'plastic',
    name: '塑料',
    durability: 80,
    friction: 0.15,
    strength: 30,
    density: 0.9,
    color: '#FF6B6B',
  },
  stone: {
    type: 'stone',
    name: '石材',
    durability: 250,
    friction: 0.08,
    strength: 200,
    density: 2.7,
    color: '#696969',
  },
};

export const LOAD_TYPES: Record<LoadType, { name: string; icon: string; basePower: number; color: string }> = {
  generator: { name: '发电机', icon: '⚡', basePower: 100, color: '#FFD700' },
  millstone: { name: '磨盘', icon: '🌾', basePower: 50, color: '#A0522D' },
  pump: { name: '水泵', icon: '💧', basePower: 75, color: '#4169E1' },
  conveyor: { name: '传送带', icon: '⚙️', basePower: 60, color: '#32CD32' },
};

export const USER_COLORS: Record<UserColor, string> = {
  blue: '#3B82F6',
  green: '#10B981',
  red: '#EF4444',
  yellow: '#F59E0B',
  purple: '#8B5CF6',
  cyan: '#06B6D4',
};

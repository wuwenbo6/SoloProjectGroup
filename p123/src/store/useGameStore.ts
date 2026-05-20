import { create } from 'zustand';
import { BaseObject, WaterLevel, ToolType, GameState, LoadType, MaterialType, MATERIALS } from '@/types';

const initialWaterLevel: WaterLevel = {
  height: 200,
  targetHeight: 200,
  maxHeight: 400,
  minHeight: 50,
};

const initialState: GameState = {
  objects: [],
  waterLevel: initialWaterLevel,
  selectedTool: 'select',
  selectedObjectId: null,
  currentLevelId: null,
  isPlaying: false,
  score: 0,
  elapsedTime: 0,
  currentUser: {
    id: 'user-1',
    name: '玩家1',
    color: 'blue',
    online: true,
    objectsCreated: 0,
  },
  allUsers: [
    { id: 'user-1', name: '玩家1', color: 'blue', online: true, objectsCreated: 0 },
    { id: 'user-2', name: '玩家2', color: 'green', online: false, objectsCreated: 0 },
    { id: 'user-3', name: '玩家3', color: 'red', online: false, objectsCreated: 0 },
    { id: 'user-4', name: '玩家4', color: 'yellow', online: false, objectsCreated: 0 },
  ],
  editHistory: [],
  showCollaborationPanel: false,
  totalPowerOutput: 0,
  selectedLoadType: 'generator',
};

interface GameActions {
  addObject: (obj: BaseObject) => void;
  removeObject: (id: string) => void;
  updateObject: (id: string, updates: Partial<BaseObject>) => void;
  setWaterLevel: (height: number) => void;
  setTargetWaterLevel: (height: number) => void;
  setSelectedTool: (tool: ToolType) => void;
  setSelectedObject: (id: string | null) => void;
  setPlaying: (playing: boolean) => void;
  setCurrentLevel: (levelId: number | null) => void;
  updateScore: (score: number) => void;
  updateElapsedTime: (time: number) => void;
  resetGame: () => void;
  updateAllObjects: (objects: BaseObject[]) => void;
  setTotalPowerOutput: (output: number) => void;
  setSelectedLoadType: (type: LoadType) => void;
  toggleUserOnline: (userId: string) => void;
  setShowCollaborationPanel: (show: boolean) => void;
  addEditHistory: (action: 'create' | 'delete' | 'move' | 'modify', objectId: string, objectType: any) => void;
  setObjectMaterial: (objectId: string, material: MaterialType) => void;
  repairObject: (objectId: string) => void;
  connectLoadToGear: (loadId: string, gearId: string | null) => void;
  switchUser: (userId: string) => void;
  importObjects: (objects: BaseObject[]) => void;
  getExportData: () => string;
}

export const useGameStore = create<GameState & GameActions>((set, get) => ({
  ...initialState,

  addObject: (obj) => set((state) => {
    const newObj = {
      ...obj,
      material: obj.material || 'wood',
      durability: obj.durability ?? MATERIALS[obj.material || 'wood'].durability,
      maxDurability: obj.maxDurability ?? MATERIALS[obj.material || 'wood'].durability,
      creatorId: obj.creatorId || state.currentUser.id,
    };
    
    state.addEditHistory('create', newObj.id, newObj.type);
    
    const updatedUsers = state.allUsers.map(u => 
      u.id === state.currentUser.id 
        ? { ...u, objectsCreated: u.objectsCreated + 1 }
        : u
    );
    
    return {
      objects: [...state.objects, newObj],
      allUsers: updatedUsers,
    };
  }),

  removeObject: (id) => set((state) => {
    const obj = state.objects.find(o => o.id === id);
    if (obj) {
      state.addEditHistory('delete', id, obj.type);
    }
    return {
      objects: state.objects.filter((o) => o.id !== id),
      selectedObjectId: state.selectedObjectId === id ? null : state.selectedObjectId,
    };
  }),

  updateObject: (id, updates) => set((state) => ({
    objects: state.objects.map((o) =>
      o.id === id ? { ...o, ...updates } : o
    ),
  })),

  setWaterLevel: (height) => set((state) => ({
    waterLevel: { ...state.waterLevel, height },
  })),

  setTargetWaterLevel: (height) => set((state) => ({
    waterLevel: { ...state.waterLevel, targetHeight: height },
  })),

  setSelectedTool: (tool) => set({ selectedTool: tool }),

  setSelectedObject: (id) => set({ selectedObjectId: id }),

  setPlaying: (playing) => set({ isPlaying: playing }),

  setCurrentLevel: (levelId) => set({ currentLevelId: levelId }),

  updateScore: (score) => set({ score }),

  updateElapsedTime: (time) => set({ elapsedTime: time }),

  resetGame: () => set(initialState),

  updateAllObjects: (objects) => set({ objects }),

  setTotalPowerOutput: (output) => set({ totalPowerOutput: output }),

  setSelectedLoadType: (type) => set({ selectedLoadType: type }),

  toggleUserOnline: (userId) => set((state) => ({
    allUsers: state.allUsers.map(u => 
      u.id === userId ? { ...u, online: !u.online } : u
    ),
  })),

  setShowCollaborationPanel: (show) => set({ showCollaborationPanel: show }),

  addEditHistory: (action, objectId, objectType) => set((state) => ({
    editHistory: [
      {
        id: `history-${Date.now()}`,
        userId: state.currentUser.id,
        action,
        objectId,
        objectType,
        timestamp: Date.now(),
      },
      ...state.editHistory.slice(0, 99),
    ],
  })),

  setObjectMaterial: (objectId, material) => set((state) => ({
    objects: state.objects.map(o => 
      o.id === objectId 
        ? { 
            ...o, 
            material,
            durability: MATERIALS[material].durability,
            maxDurability: MATERIALS[material].durability,
          }
        : o
    ),
  })),

  repairObject: (objectId) => set((state) => ({
    objects: state.objects.map(o => 
      o.id === objectId && o.maxDurability
        ? { ...o, durability: o.maxDurability }
        : o
    ),
  })),

  connectLoadToGear: (loadId, gearId) => set((state) => ({
    objects: state.objects.map(o => 
      o.id === loadId && o.type === 'load'
        ? { ...o, connectedTo: gearId, isRunning: !!gearId }
        : o
    ),
  })),

  switchUser: (userId) => set((state) => {
    const user = state.allUsers.find(u => u.id === userId);
    if (!user) return state;
    return {
      currentUser: user,
    };
  }),

  importObjects: (objects) => set((state) => {
    const newObjects = objects.map((obj, index) => ({
      ...obj,
      id: obj.id || `imported-${Date.now()}-${index}`,
      creatorId: obj.creatorId || state.currentUser.id,
    }));
    return {
      objects: [...state.objects, ...newObjects],
    };
  }),

  getExportData: () => {
    const state = get();
    const exportData = {
      version: '1.0',
      timestamp: Date.now(),
      objects: state.objects,
      waterLevel: state.waterLevel,
      totalPowerOutput: state.totalPowerOutput,
      creator: state.currentUser.name,
    };
    return JSON.stringify(exportData, null, 2);
  },
}));

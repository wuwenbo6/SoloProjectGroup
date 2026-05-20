import { create } from 'zustand';

export interface VariableState {
  name: string;
  type: 'I' | 'Q' | 'M' | 'T';
  value: boolean | number;
  forced: boolean;
  forcedValue?: boolean;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  xmlData: string;
  createdAt: Date;
  updatedAt: Date;
}

interface SimulationState {
  isRunning: boolean;
  cycleCount: number;
  variables: VariableState[];
  currentProject: Project | null;
  projects: Project[];
  wsConnected: boolean;
  modbusConnected: boolean;
  modbusConfig: {
    host: string;
    port: number;
    slaveId: number;
  };
  
  startSimulation: () => void;
  stopSimulation: () => void;
  setVariables: (variables: VariableState[]) => void;
  updateVariable: (name: string, value: boolean | number) => void;
  forceVariable: (name: string, value: boolean) => void;
  releaseForce: (name: string) => void;
  setCurrentProject: (project: Project | null) => void;
  saveProject: (name: string, xmlData: string) => void;
  loadProject: (id: string) => void;
  deleteProject: (id: string) => void;
  setWsConnected: (connected: boolean) => void;
  setModbusConnected: (connected: boolean) => void;
  setModbusConfig: (config: { host: string; port: number; slaveId: number }) => void;
}

const generateDefaultVariables = (): VariableState[] => {
  const variables: VariableState[] = [];
  
  // 输入变量 I
  for (let i = 0; i < 8; i++) {
    variables.push({
      name: `I${Math.floor(i / 8)}.${i % 8}`,
      type: 'I',
      value: false,
      forced: false
    });
  }
  
  // 输出变量 Q
  for (let i = 0; i < 8; i++) {
    variables.push({
      name: `Q${Math.floor(i / 8)}.${i % 8}`,
      type: 'Q',
      value: false,
      forced: false
    });
  }
  
  // 内部变量 M
  for (let i = 0; i < 16; i++) {
    variables.push({
      name: `M${Math.floor(i / 8)}.${i % 8}`,
      type: 'M',
      value: false,
      forced: false
    });
  }
  
  // 定时器 T
  for (let i = 0; i < 8; i++) {
    variables.push({
      name: `T${i}`,
      type: 'T',
      value: 0,
      forced: false
    });
  }
  
  return variables;
};

export const useSimulationStore = create<SimulationState>((set, get) => ({
  isRunning: false,
  cycleCount: 0,
  variables: generateDefaultVariables(),
  currentProject: null,
  projects: [],
  wsConnected: false,
  modbusConnected: false,
  modbusConfig: {
    host: '127.0.0.1',
    port: 502,
    slaveId: 1
  },
  
  startSimulation: () => set({ isRunning: true }),
  stopSimulation: () => set({ isRunning: false, cycleCount: 0 }),
  
  setVariables: (variables) => set({ variables }),
  
  updateVariable: (name, value) => set((state) => ({
    variables: state.variables.map(v => 
      v.name === name ? { ...v, value } : v
    )
  })),
  
  forceVariable: (name, value) => set((state) => ({
    variables: state.variables.map(v => 
      v.name === name ? { ...v, forced: true, forcedValue: value, value } : v
    )
  })),
  
  releaseForce: (name) => set((state) => ({
    variables: state.variables.map(v => 
      v.name === name ? { ...v, forced: false, forcedValue: undefined } : v
    )
  })),
  
  setCurrentProject: (project) => set({ currentProject: project }),
  
  saveProject: (name, xmlData) => set((state) => {
    const newProject: Project = {
      id: Date.now().toString(),
      name,
      description: '',
      xmlData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    return {
      projects: [...state.projects, newProject],
      currentProject: newProject
    };
  }),
  
  loadProject: (id) => set((state) => {
    const project = state.projects.find(p => p.id === id);
    return { currentProject: project || null };
  }),
  
  deleteProject: (id) => set((state) => ({
    projects: state.projects.filter(p => p.id !== id),
    currentProject: state.currentProject?.id === id ? null : state.currentProject
  })),
  
  setWsConnected: (connected) => set({ wsConnected: connected }),
  setModbusConnected: (connected) => set({ modbusConnected: connected }),
  setModbusConfig: (config) => set({ modbusConfig: config })
}));

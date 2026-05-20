export type ToolType = 'model' | 'annotation' | 'corrosion' | 'stress' | 'section' | 'inspection' | 'repair' | 'history' | 'vr' | null;

export interface Annotation {
  id: string;
  position: [number, number, number];
  text: string;
  color: string;
}

export interface InspectionPoint {
  id: string;
  position: [number, number, number];
  name: string;
  duration: number;
  checked: boolean;
}

export interface RepairNote {
  id: string;
  position: [number, number, number];
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in-progress' | 'completed';
  assignee: string;
  createdAt: string;
}

export interface ModelVersion {
  id: string;
  name: string;
  date: string;
  description: string;
  author: string;
}

export interface AppState {
  activeTool: ToolType;
  model: {
    loaded: boolean;
    url: string;
  };
  annotations: Annotation[];
  corrosion: {
    enabled: boolean;
    intensity: number;
  };
  stress: {
    enabled: boolean;
    animationSpeed: number;
  };
  section: {
    enabled: boolean;
    axis: 'x' | 'y' | 'z';
    position: number;
  };
  inspection: {
    enabled: boolean;
    isPlaying: boolean;
    speed: number;
    currentIndex: number;
    path: InspectionPoint[];
  };
  repair: {
    enabled: boolean;
    notes: RepairNote[];
    selectedNoteId: string | null;
  };
  history: {
    enabled: boolean;
    versions: ModelVersion[];
    leftVersion: string | null;
    rightVersion: string | null;
    opacity: number;
  };
  vr: {
    enabled: boolean;
    mode: '3d' | 'vr' | 'ar';
    fov: number;
  };
  setActiveTool: (tool: ToolType) => void;
  addAnnotation: (annotation: Omit<Annotation, 'id'>) => void;
  removeAnnotation: (id: string) => void;
  updateAnnotation: (id: string, text: string) => void;
  setCorrosionEnabled: (enabled: boolean) => void;
  setCorrosionIntensity: (intensity: number) => void;
  setStressEnabled: (enabled: boolean) => void;
  setStressAnimationSpeed: (speed: number) => void;
  setSectionEnabled: (enabled: boolean) => void;
  setSectionAxis: (axis: 'x' | 'y' | 'z') => void;
  setSectionPosition: (position: number) => void;
  setModelLoaded: (loaded: boolean) => void;
  setInspectionEnabled: (enabled: boolean) => void;
  setInspectionPlaying: (playing: boolean) => void;
  setInspectionSpeed: (speed: number) => void;
  setInspectionCurrentIndex: (index: number) => void;
  addInspectionPoint: (point: Omit<InspectionPoint, 'id'>) => void;
  removeInspectionPoint: (id: string) => void;
  toggleInspectionPoint: (id: string) => void;
  setRepairEnabled: (enabled: boolean) => void;
  addRepairNote: (note: Omit<RepairNote, 'id' | 'createdAt'>) => void;
  removeRepairNote: (id: string) => void;
  updateRepairNote: (id: string, updates: Partial<RepairNote>) => void;
  setSelectedRepairNote: (id: string | null) => void;
  setHistoryEnabled: (enabled: boolean) => void;
  setLeftVersion: (id: string | null) => void;
  setRightVersion: (id: string | null) => void;
  setHistoryOpacity: (opacity: number) => void;
  setVrEnabled: (enabled: boolean) => void;
  setVrMode: (mode: '3d' | 'vr' | 'ar') => void;
  setVrFov: (fov: number) => void;
}

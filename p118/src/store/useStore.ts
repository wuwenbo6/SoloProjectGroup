import { create } from 'zustand';
import { AppState } from '@/types';

// Default inspection path
const defaultInspectionPath = [
  { id: '1', position: [-6, 3, 3] as [number, number, number], name: '左柱底部', duration: 2, checked: false },
  { id: '2', position: [-6, 0, 0] as [number, number, number], name: '左柱顶部', duration: 2, checked: false },
  { id: '3', position: [0, 3, 0] as [number, number, number], name: '主梁中点', duration: 3, checked: false },
  { id: '4', position: [6, 0, 0] as [number, number, number], name: '右柱顶部', duration: 2, checked: false },
  { id: '5', position: [6, 3, -3] as [number, number, number], name: '右柱底部', duration: 2, checked: false },
  { id: '6', position: [0, 5, 0] as [number, number, number], name: '次梁连接点', duration: 3, checked: false },
];

// Default repair notes
const defaultRepairNotes = [
  {
    id: '1',
    position: [-3, 2, 0.5] as [number, number, number],
    title: '主梁腐蚀修复',
    description: '左侧主梁发现严重腐蚀，需要进行喷砂除锈和防腐涂层处理',
    priority: 'high' as const,
    status: 'pending' as const,
    assignee: '张工程师',
    createdAt: '2024-01-15',
  },
  {
    id: '2',
    position: [4, 0, 0.3] as [number, number, number],
    title: '柱脚螺栓加固',
    description: '右柱地脚螺栓松动，需要重新紧固并做防锈处理',
    priority: 'critical' as const,
    status: 'in-progress' as const,
    assignee: '李工',
    createdAt: '2024-01-18',
  },
];

// Default versions
const defaultVersions = [
  { id: 'v1', name: '初始设计', date: '2023-06-01', description: '原始结构设计', author: '王工' },
  { id: 'v2', name: '荷载调整', date: '2023-09-15', description: '增加风荷载系数', author: '李工' },
  { id: 'v3', name: '材料升级', date: '2024-01-10', description: '更换为高强度钢材', author: '张工' },
];

export const useStore = create<AppState>((set) => ({
  activeTool: null,
  model: {
    loaded: true,
    url: '',
  },
  annotations: [],
  corrosion: {
    enabled: false,
    intensity: 0.5,
  },
  stress: {
    enabled: false,
    animationSpeed: 1,
  },
  section: {
    enabled: false,
    axis: 'x',
    position: 0,
  },
  inspection: {
    enabled: false,
    isPlaying: false,
    speed: 1,
    currentIndex: 0,
    path: defaultInspectionPath,
  },
  repair: {
    enabled: false,
    notes: defaultRepairNotes,
    selectedNoteId: null,
  },
  history: {
    enabled: false,
    versions: defaultVersions,
    leftVersion: 'v1',
    rightVersion: 'v3',
    opacity: 0.7,
  },
  vr: {
    enabled: false,
    mode: '3d',
    fov: 75,
  },
  setActiveTool: (tool) => set({ activeTool: tool }),
  addAnnotation: (annotation) =>
    set((state) => ({
      annotations: [...state.annotations, { ...annotation, id: crypto.randomUUID() }],
    })),
  removeAnnotation: (id) =>
    set((state) => ({
      annotations: state.annotations.filter((a) => a.id !== id),
    })),
  updateAnnotation: (id, text) =>
    set((state) => ({
      annotations: state.annotations.map((a) =>
        a.id === id ? { ...a, text } : a
      ),
    })),
  setCorrosionEnabled: (enabled) =>
    set((state) => ({
      corrosion: { ...state.corrosion, enabled },
    })),
  setCorrosionIntensity: (intensity) =>
    set((state) => ({
      corrosion: { ...state.corrosion, intensity },
    })),
  setStressEnabled: (enabled) =>
    set((state) => ({
      stress: { ...state.stress, enabled },
    })),
  setStressAnimationSpeed: (animationSpeed) =>
    set((state) => ({
      stress: { ...state.stress, animationSpeed },
    })),
  setSectionEnabled: (enabled) =>
    set((state) => ({
      section: { ...state.section, enabled },
    })),
  setSectionAxis: (axis) =>
    set((state) => ({
      section: { ...state.section, axis },
    })),
  setSectionPosition: (position) =>
    set((state) => ({
      section: { ...state.section, position },
    })),
  setModelLoaded: (loaded) =>
    set((state) => ({
      model: { ...state.model, loaded },
    })),
  // Inspection
  setInspectionEnabled: (enabled) =>
    set((state) => ({
      inspection: { ...state.inspection, enabled },
    })),
  setInspectionPlaying: (isPlaying) =>
    set((state) => ({
      inspection: { ...state.inspection, isPlaying },
    })),
  setInspectionSpeed: (speed) =>
    set((state) => ({
      inspection: { ...state.inspection, speed },
    })),
  setInspectionCurrentIndex: (currentIndex) =>
    set((state) => ({
      inspection: { ...state.inspection, currentIndex },
    })),
  addInspectionPoint: (point) =>
    set((state) => ({
      inspection: {
        ...state.inspection,
        path: [...state.inspection.path, { ...point, id: crypto.randomUUID() }],
      },
    })),
  removeInspectionPoint: (id) =>
    set((state) => ({
      inspection: {
        ...state.inspection,
        path: state.inspection.path.filter((p) => p.id !== id),
      },
    })),
  toggleInspectionPoint: (id) =>
    set((state) => ({
      inspection: {
        ...state.inspection,
        path: state.inspection.path.map((p) =>
          p.id === id ? { ...p, checked: !p.checked } : p
        ),
      },
    })),
  // Repair
  setRepairEnabled: (enabled) =>
    set((state) => ({
      repair: { ...state.repair, enabled },
    })),
  addRepairNote: (note) =>
    set((state) => ({
      repair: {
        ...state.repair,
        notes: [...state.repair.notes, { ...note, id: crypto.randomUUID(), createdAt: new Date().toISOString().split('T')[0] }],
      },
    })),
  removeRepairNote: (id) =>
    set((state) => ({
      repair: {
        ...state.repair,
        notes: state.repair.notes.filter((n) => n.id !== id),
      },
    })),
  updateRepairNote: (id, updates) =>
    set((state) => ({
      repair: {
        ...state.repair,
        notes: state.repair.notes.map((n) =>
          n.id === id ? { ...n, ...updates } : n
        ),
      },
    })),
  setSelectedRepairNote: (selectedNoteId) =>
    set((state) => ({
      repair: { ...state.repair, selectedNoteId },
    })),
  // History
  setHistoryEnabled: (enabled) =>
    set((state) => ({
      history: { ...state.history, enabled },
    })),
  setLeftVersion: (leftVersion) =>
    set((state) => ({
      history: { ...state.history, leftVersion },
    })),
  setRightVersion: (rightVersion) =>
    set((state) => ({
      history: { ...state.history, rightVersion },
    })),
  setHistoryOpacity: (opacity) =>
    set((state) => ({
      history: { ...state.history, opacity },
    })),
  // VR
  setVrEnabled: (enabled) =>
    set((state) => ({
      vr: { ...state.vr, enabled },
    })),
  setVrMode: (mode) =>
    set((state) => ({
      vr: { ...state.vr, mode },
    })),
  setVrFov: (fov) =>
    set((state) => ({
      vr: { ...state.vr, fov },
    })),
}));

import { create } from 'zustand';
import { SensorData, Alert, ThresholdConfig, QualityPrediction, ParameterRecommendation, RootCauseAnalysis, DeviceData } from '../../shared/types';

interface MonitorState {
  currentData: SensorData | null;
  historyData: SensorData[];
  alerts: Alert[];
  thresholds: ThresholdConfig | null;
  isConnected: boolean;

  // AI 功能状态
  qualityPrediction: QualityPrediction | null;
  parameterRecommendations: ParameterRecommendation[];
  rootCauseAnalysis: RootCauseAnalysis | null;
  deviceList: DeviceData[];

  setCurrentData: (data: SensorData) => void;
  setHistoryData: (data: SensorData[]) => void;
  addAlerts: (alerts: Alert[]) => void;
  updateAlert: (alert: Alert) => void;
  setThresholds: (config: ThresholdConfig) => void;
  setConnected: (connected: boolean) => void;
  acknowledgeAlert: (id: string) => void;
  getUnacknowledgedCount: () => number;

  setQualityPrediction: (prediction: QualityPrediction) => void;
  setParameterRecommendations: (recommendations: ParameterRecommendation[]) => void;
  setRootCauseAnalysis: (analysis: RootCauseAnalysis | null) => void;
  setDeviceList: (devices: DeviceData[]) => void;
}

export const useMonitorStore = create<MonitorState>((set, get) => ({
  currentData: null,
  historyData: [],
  alerts: [],
  thresholds: null,
  isConnected: false,

  // AI 功能状态初始值
  qualityPrediction: null,
  parameterRecommendations: [],
  rootCauseAnalysis: null,
  deviceList: [],

  setCurrentData: (data) => set({ currentData: data }),

  setHistoryData: (data) => set({ historyData: data }),

  addAlerts: (newAlerts) =>
    set((state) => ({
      alerts: [...newAlerts, ...state.alerts].slice(0, 100),
    })),

  updateAlert: (updatedAlert) =>
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === updatedAlert.id ? updatedAlert : a)),
    })),

  setThresholds: (config) => set({ thresholds: config }),

  setConnected: (connected) => set({ isConnected: connected }),

  acknowledgeAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)),
    })),

  getUnacknowledgedCount: () => get().alerts.filter((a) => !a.acknowledged).length,

  // AI 功能 setters
  setQualityPrediction: (prediction) => set({ qualityPrediction: prediction }),
  setParameterRecommendations: (recommendations) => set({ parameterRecommendations: recommendations }),
  setRootCauseAnalysis: (analysis) => set({ rootCauseAnalysis: analysis }),
  setDeviceList: (devices) => set({ deviceList: devices }),
}));

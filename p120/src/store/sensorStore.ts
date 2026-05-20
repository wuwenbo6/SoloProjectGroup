
import { create } from 'zustand';
import type { SensorData, AlertRecord, AlertConfig } from '../../shared/types';

interface SensorState {
    latestData: SensorData | null;
    historyData: SensorData[];
    alerts: AlertRecord[];
    alertConfigs: AlertConfig[];
    latestAlert: AlertRecord | null;
    showAlertNotification: boolean;

    setLatestData: (data: SensorData) => void;
    setHistoryData: (data: SensorData[]) => void;
    addAlert: (alert: AlertRecord) => void;
    setAlerts: (alerts: AlertRecord[]) => void;
    setAlertConfigs: (configs: AlertConfig[]) => void;
    setShowAlertNotification: (show: boolean) => void;
}

export const useSensorStore = create<SensorState>((set) => ({
    latestData: null,
    historyData: [],
    alerts: [],
    alertConfigs: [],
    latestAlert: null,
    showAlertNotification: false,

    setLatestData: (data) => set({ latestData: data }),
    setHistoryData: (data) => set({ historyData: data }),
    addAlert: (alert) => set((state) => ({
        alerts: [alert, ...state.alerts].slice(0, 100),
        latestAlert: alert,
        showAlertNotification: true,
    })),
    setAlerts: (alerts) => set({ alerts }),
    setAlertConfigs: (configs) => set({ alertConfigs: configs }),
    setShowAlertNotification: (show) => set({ showAlertNotification: show }),
}));


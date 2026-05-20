import { useEffect, useRef, useCallback } from 'react';
import { useMonitorStore } from '../store/monitorStore';

export const useWebSocket = () => {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef(false);

  const setCurrentData = useMonitorStore((state) => state.setCurrentData);
  const setHistoryData = useMonitorStore((state) => state.setHistoryData);
  const addAlerts = useMonitorStore((state) => state.addAlerts);
  const updateAlert = useMonitorStore((state) => state.updateAlert);
  const setConnected = useMonitorStore((state) => state.setConnected);

  const connect = useCallback(() => {
    if (isConnectingRef.current || (wsRef.current && wsRef.current.readyState === WebSocket.OPEN)) {
      return;
    }

    isConnectingRef.current = true;
    const wsUrl = 'ws://localhost:3001/ws';
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      isConnectingRef.current = false;
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case 'sensorData':
            setCurrentData(message.data);
            break;
          case 'historyData':
            setHistoryData(message.data);
            break;
          case 'newAlerts':
            addAlerts(message.data);
            break;
          case 'alerts':
            addAlerts(message.data);
            break;
          case 'alertUpdated':
            updateAlert(message.data);
            break;
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason);
      isConnectingRef.current = false;
      setConnected(false);

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = setTimeout(connect, 2000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      isConnectingRef.current = false;
      setConnected(false);
    };
  }, [setCurrentData, setHistoryData, addAlerts, updateAlert, setConnected]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return wsRef.current;
};


import { useEffect } from 'react';
import { useSensorStore } from '../store/sensorStore';
import type { SensorData, AlertRecord } from '../../shared/types';

export const useSSE = () => {
    const setLatestData = useSensorStore((state) => state.setLatestData);
    const addAlert = useSensorStore((state) => state.addAlert);

    useEffect(() => {
        const eventSource = new EventSource('/api/sse/events');

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'sensor_update') {
                    setLatestData(data.data as SensorData);
                } else if (data.type === 'alert') {
                    addAlert(data.data as AlertRecord);
                }
            } catch (error) {
                console.error('Error parsing SSE message:', error);
            }
        };

        eventSource.onerror = (error) => {
            console.error('SSE error:', error);
        };

        return () => {
            eventSource.close();
        };
    }, [setLatestData, addAlert]);
};


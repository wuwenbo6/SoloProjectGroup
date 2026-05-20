
import db from './db';
import { checkAndCreateAlerts } from './alertService';
import { broadcastSensorUpdate } from './sseManager';
import type { SensorData } from '../shared/types';

let baseValues = {
    temperature: 25,
    humidity: 60,
    salinity: 30,
    ph: 7,
};

const smoothValues = { ...baseValues };

const generateSensorData = (): Omit<SensorData, 'id' | 'created_at'> => {
    baseValues.temperature += (Math.random() - 0.5) * 0.8;
    baseValues.humidity += (Math.random() - 0.5) * 2;
    baseValues.salinity += (Math.random() - 0.5) * 0.4;
    baseValues.ph += (Math.random() - 0.5) * 0.1;

    baseValues.temperature = Math.max(20, Math.min(35, baseValues.temperature));
    baseValues.humidity = Math.max(40, Math.min(80, baseValues.humidity));
    baseValues.salinity = Math.max(20, Math.min(40, baseValues.salinity));
    baseValues.ph = Math.max(6, Math.min(8, baseValues.ph));

    smoothValues.temperature = smoothValues.temperature * 0.7 + baseValues.temperature * 0.3;
    smoothValues.humidity = smoothValues.humidity * 0.7 + baseValues.humidity * 0.3;
    smoothValues.salinity = smoothValues.salinity * 0.7 + baseValues.salinity * 0.3;
    smoothValues.ph = smoothValues.ph * 0.7 + baseValues.ph * 0.3;

    return {
        temperature: Math.round(smoothValues.temperature * 100) / 100,
        humidity: Math.round(smoothValues.humidity * 100) / 100,
        salinity: Math.round(smoothValues.salinity * 100) / 100,
        ph: Math.round(smoothValues.ph * 100) / 100,
    };
};

export const startDataSimulation = () => {
    setInterval(() => {
        const data = generateSensorData();
        const stmt = db.prepare(`
            INSERT INTO sensor_data (temperature, humidity, salinity, ph)
            VALUES (?, ?, ?, ?)
        `);
        const result = stmt.run(data.temperature, data.humidity, data.salinity, data.ph);

        const sensorData: SensorData = {
            id: result.lastInsertRowid as number,
            ...data,
            created_at: new Date().toISOString(),
        };

        broadcastSensorUpdate(sensorData);
        checkAndCreateAlerts(sensorData);
    }, 2000);
};


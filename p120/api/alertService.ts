
import db from './db';
import { broadcastAlert } from './sseManager';
import type { SensorData, AlertRecord, AlertConfig } from '../shared/types';

const sensorLabels: Record<string, string> = {
    temperature: '温度',
    humidity: '湿度',
    salinity: '盐度',
    ph: 'pH值',
};

export const checkAndCreateAlerts = (sensorData: SensorData) => {
    const configs = db.prepare('SELECT * FROM alert_config WHERE enabled = 1').all() as AlertConfig[];

    configs.forEach((config) => {
        const value = sensorData[config.sensor_type as keyof SensorData] as number;
        let alertType: 'low' | 'high' | null = null;
        let threshold = 0;
        let message = '';

        if (value < config.min_threshold) {
            alertType = 'low';
            threshold = config.min_threshold;
            message = `${sensorLabels[config.sensor_type]}低于下限阈值`;
        } else if (value > config.max_threshold) {
            alertType = 'high';
            threshold = config.max_threshold;
            message = `${sensorLabels[config.sensor_type]}高于上限阈值`;
        }

        if (alertType) {
            const stmt = db.prepare(`
                INSERT INTO alert_records (sensor_type, alert_type, current_value, threshold_value, message)
                VALUES (?, ?, ?, ?, ?)
            `);
            const result = stmt.run(config.sensor_type, alertType, value, threshold, message);

            const alert: AlertRecord = {
                id: result.lastInsertRowid as number,
                sensor_type: config.sensor_type,
                alert_type: alertType,
                current_value: value,
                threshold_value: threshold,
                message,
                created_at: new Date().toISOString(),
            };

            broadcastAlert(alert);
        }
    });
};


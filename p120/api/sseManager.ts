
import type { Response } from 'express';
import type { SensorData, AlertRecord } from '../shared/types';

const clients: Map<number, Response> = new Map();
let clientId = 0;

export const addClient = (res: Response): number => {
    const id = ++clientId;
    clients.set(id, res);

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    });

    res.on('close', () => {
        clients.delete(id);
    });

    return id;
};

export const broadcastSensorUpdate = (data: SensorData) => {
    const event = JSON.stringify({
        type: 'sensor_update',
        data,
        timestamp: new Date().toISOString(),
    });

    clients.forEach((client) => {
        client.write(`data: ${event}\n\n`);
    });
};

export const broadcastAlert = (data: AlertRecord) => {
    const event = JSON.stringify({
        type: 'alert',
        data,
        timestamp: new Date().toISOString(),
    });

    clients.forEach((client) => {
        client.write(`data: ${event}\n\n`);
    });
};


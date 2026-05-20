
export interface SensorData {
    id: number;
    temperature: number;
    humidity: number;
    salinity: number;
    ph: number;
    created_at: string;
}

export interface AlertRecord {
    id: number;
    sensor_type: string;
    alert_type: 'low' | 'high';
    current_value: number;
    threshold_value: number;
    message: string;
    created_at: string;
}

export interface AlertConfig {
    id: number;
    sensor_type: string;
    min_threshold: number;
    max_threshold: number;
    enabled: boolean;
    updated_at: string;
}

export interface SSEEvent {
    type: 'sensor_update' | 'alert';
    data: SensorData | AlertRecord;
    timestamp: string;
}


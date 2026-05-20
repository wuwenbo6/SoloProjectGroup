export type ProcessType = 'soaking' | 'beating' | 'papermaking';

export type AlertLevel = 'info' | 'warning' | 'error' | 'critical';

export interface SensorData {
  id: number;
  process_type: ProcessType;
  timestamp: string;
  temperature: number;
  humidity: number;
  pressure: number;
  ph_value: number;
  concentration: number;
  speed: number;
  device_id: string;
  created_at: string;
}

export interface Alert {
  id: number;
  alert_level: AlertLevel;
  process_type: ProcessType;
  device_id: string;
  message: string;
  parameter: string;
  value: number;
  threshold: number;
  timestamp: string;
  acknowledged: boolean;
  acknowledged_at?: string;
}

export interface ProcessConfig {
  id: number;
  process_type: ProcessType;
  config_name: string;
  temp_min: number;
  temp_max: number;
  ph_min: number;
  ph_max: number;
  concentration_min: number;
  concentration_max: number;
  speed_min: number;
  speed_max: number;
  updated_at: string;
}

export interface DiagnosticIssue {
  severity: string;
  parameter: string;
  message: string;
  value: number;
  threshold: number;
}

export interface DiagnosticResult {
  device_id: string;
  process_type: ProcessType;
  status: string;
  health_score: number;
  issues: DiagnosticIssue[];
  suggestions: string[];
  last_check: string;
}

export interface AdjustmentRecord {
  id: number;
  process_type: ProcessType;
  parameter: string;
  old_value: number;
  new_value: number;
  reason: string;
  adjustment_type: string;
  created_at: string;
}

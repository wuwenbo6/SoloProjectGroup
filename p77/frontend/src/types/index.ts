export type MaterialType = '皮革' | '纸张' | '木材' | '织物' | '塑料';

export type AlertLevel = 'normal' | 'warning' | 'error';

export type DeviceStatus = 'online' | 'offline' | 'busy' | 'error';

export interface DetectionRecord {
  id: number;
  created_at: string;
  updated_at: string;
  device_id: string;
  batch_no: string;
  material_type: MaterialType;
  thickness: number;
  hardness: number;
  tensile_strength: number;
  moisture: number;
  color_value: string;
  quality_score: number;
  alert_level: AlertLevel;
  is_qualified: boolean;
  remark: string;
}

export interface MaterialParam {
  id: number;
  created_at: string;
  updated_at: string;
  material_type: MaterialType;
  min_thickness: number;
  max_thickness: number;
  min_hardness: number;
  max_hardness: number;
  min_tensile_strength: number;
  max_tensile_strength: number;
  min_moisture: number;
  max_moisture: number;
  pass_score: number;
  warn_threshold: number;
  description: string;
}

export interface DeviceInfo {
  id: number;
  created_at: string;
  updated_at: string;
  device_id: string;
  device_name: string;
  device_type: string;
  status: DeviceStatus;
  location: string;
  ip_address: string;
  last_online: string;
  temperature: number;
  detection_count: number;
  remark: string;
}

export interface AlertRecord {
  id: number;
  created_at: string;
  device_id: string;
  alert_level: AlertLevel;
  alert_type: string;
  message: string;
  record_id?: number;
  is_handled: boolean;
  handled_at?: string;
  handled_by?: string;
}

export interface DetectionStats {
  date: string;
  total_count: number;
  pass_count: number;
  fail_count: number;
  pass_rate: number;
  avg_score: number;
}

export interface QualityPoint {
  date: string;
  quality: number;
}

export interface AgingPrediction {
  material_type: string;
  current_quality: number;
  predicted_days: number;
  trend: string;
  confidence: number;
  history_data: QualityPoint[];
  predicted_data: QualityPoint[];
  warning_level: string;
}

export interface DiagnosticItem {
  type: string;
  status: string;
  value: number;
  threshold: number;
  message: string;
  severity: string;
}

export interface DeviceDiagnostic {
  device_id: string;
  device_name: string;
  status: string;
  health_score: number;
  uptime_seconds: number;
  last_check: string;
  diagnostics: DiagnosticItem[];
  recommendations: string[];
  maintenance_due: boolean;
}

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data?: T;
}

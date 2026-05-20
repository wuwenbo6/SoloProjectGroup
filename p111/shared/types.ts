export interface SensorData {
  id: string;
  timestamp: string;
  temperature: number;
  humidity: number;
  oxygen: number;
  fermentationTime: number;
}

export interface Alert {
  id: string;
  timestamp: string;
  type: 'temperature' | 'humidity' | 'oxygen';
  level: 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  acknowledged: boolean;
}

export interface ThresholdConfig {
  temperature: { min: number; max: number; warning: number; critical: number };
  humidity: { min: number; max: number; warning: number; critical: number };
  oxygen: { min: number; max: number; warning: number; critical: number };
}

export type AlertType = 'temperature' | 'humidity' | 'oxygen';
export type AlertLevel = 'warning' | 'critical';

// AI 功能相关类型
export type QualityLevel = 'excellent' | 'good' | 'normal' | 'poor';

export interface QualityPrediction {
  level: QualityLevel;
  score: number;
  confidence: number;
  factors: {
    temperature: number;
    humidity: number;
    oxygen: number;
    fermentationTime: number;
  };
  recommendations: string[];
}

export interface ParameterRecommendation {
  targetTemperature: number;
  targetHumidity: number;
  targetOxygen: number;
  rationale: string;
  priority: 'high' | 'medium' | 'low';
}

export interface RootCauseAnalysis {
  anomalyType: string;
  primaryCause: string;
  contributingFactors: string[];
  suggestedActions: string[];
  severity: 'critical' | 'high' | 'medium';
}

export interface DeviceData {
  id: string;
  name: string;
  status: 'running' | 'idle' | 'warning' | 'error';
  currentData: SensorData;
  qualityScore: number;
  elapsedTime: number;
}

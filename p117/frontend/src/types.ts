export interface FiberData {
  area: number;
  centroid: number[];
  length: number;
  width: number;
  thickness: number;
  orientation: number;
  eccentricity: number;
  solidity: number;
  bbox: number[];
}

export interface SegmentationResult {
  fiber_count: number;
  total_fiber_area: number;
  average_length: number;
  average_width: number;
  fiber_density: number;
  orientation_distribution: {
    [key: string]: number;
  };
  fibers: FiberData[];
}

export interface AgingFeatures {
  fiber_density: number;
  fiber_count: number;
  average_length: number;
  average_width: number;
  texture_contrast: number;
  mean_intensity: number;
  sharpness: number;
  fiber_length_variance: number;
  orientation_entropy: number;
  breakage_index: number;
}

export interface AgingLevel {
  level: number;
  level_description: string;
  score: number;
  features: AgingFeatures;
  confidence: number;
}

export interface DamageIndicators {
  crack_density: number;
  void_count: number;
  void_density: number;
  fiber_breakage_count: number;
  fiber_breakage_ratio: number;
  texture_uniformity: number;
  gradient_magnitude: number;
}

export interface RiskAssessment {
  crack_risk: number;
  void_risk: number;
  breakage_risk: number;
  degradation_risk: number;
  delamination_risk: number;
}

export interface DamagePrediction {
  type: string;
  type_description: string;
  probability: number;
  severity: string;
  recommendation: string;
}

export interface DamageResult {
  current_damage: DamageIndicators;
  risk_assessment: RiskAssessment;
  predictions: DamagePrediction[];
  overall_risk_level: string;
}

export interface AnalysisData {
  file_id: string;
  filename: string;
  timestamp: string;
  segmentation: SegmentationResult;
  aging_level: AgingLevel;
  damage_prediction: DamageResult;
}

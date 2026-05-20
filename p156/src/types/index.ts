export interface User {
  id: string;
  email: string;
  role: string;
  company_id: string;
  company_name: string;
  industry: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export interface EmissionSummary {
  id: string;
  period: string;
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
  calculated_at: string;
}

export interface EmissionTrend {
  period: string;
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
}

export interface EmissionBreakdown {
  category: string;
  scope: number;
  emission: number;
  activity_data: number;
}

export interface HotspotData {
  category: string;
  emission: number;
  percentage: number;
  cumulative: number;
  level: 'high' | 'medium' | 'low';
}

export interface HotspotAnalysis {
  hotspots: HotspotData[];
  total: number;
  top_contributors: HotspotData[];
}

export interface ReductionSuggestion {
  id: string;
  title: string;
  description: string;
  category: string;
  cost_level: string;
  payback_period: string;
  estimated_reduction_pct: number;
  estimated_reduction_amount: number;
  priority: 'high' | 'medium' | 'low';
}

export interface BenchmarkComparison {
  metric: string;
  company_value: number;
  industry_average: number;
  industry_top25: number;
  vs_average_pct: number;
  gap_to_top25: number;
}

export interface Report {
  id: string;
  title: string;
  period_start: string;
  period_end: string;
  status: 'generating' | 'completed' | 'failed';
  created_at: string;
}

export interface UploadResult {
  file_id: string;
  file_path: string;
  preview: any[];
  columns: string[];
  row_count: number;
}

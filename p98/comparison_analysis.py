import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional
from scipy import stats
from scipy.interpolate import interp1d
from dataclasses import dataclass


@dataclass
class ComparisonMetrics:
    variable: str
    mae: float
    rmse: float
    mape: float
    r_squared: float
    correlation: float
    bias: float


@dataclass
class PhaseAnalysis:
    phase_name: str
    time_range: Tuple[float, float]
    simulation_stats: Dict
    actual_stats: Dict
    difference_stats: Dict


class SimulationComparator:
    def __init__(self):
        self.metrics: Dict[str, ComparisonMetrics] = {}
        self.phase_analyses: List[PhaseAnalysis] = []

    def _align_time_series(self, sim_time: np.ndarray, sim_data: np.ndarray,
                           actual_time: np.ndarray, actual_data: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        sim_interp = interp1d(sim_time, sim_data, kind='linear', fill_value='extrapolate')
        
        common_time = np.sort(np.unique(np.concatenate([sim_time, actual_time])))
        
        sim_aligned = sim_interp(common_time)
        
        actual_interp = interp1d(actual_time, actual_data, kind='linear', fill_value='extrapolate')
        actual_aligned = actual_interp(common_time)
        
        return sim_aligned, actual_aligned, common_time

    def _calculate_metrics(self, sim_data: np.ndarray, actual_data: np.ndarray, 
                          variable_name: str) -> ComparisonMetrics:
        mask = np.isfinite(sim_data) & np.isfinite(actual_data)
        sim_clean = sim_data[mask]
        actual_clean = actual_data[mask]
        
        if len(sim_clean) < 2:
            return ComparisonMetrics(
                variable=variable_name,
                mae=np.nan,
                rmse=np.nan,
                mape=np.nan,
                r_squared=np.nan,
                correlation=np.nan,
                bias=np.nan
            )
        
        mae = np.mean(np.abs(sim_clean - actual_clean))
        rmse = np.sqrt(np.mean((sim_clean - actual_clean) ** 2))
        
        non_zero_mask = actual_clean != 0
        if np.sum(non_zero_mask) > 0:
            mape = np.mean(np.abs((sim_clean[non_zero_mask] - actual_clean[non_zero_mask]) / 
                                   actual_clean[non_zero_mask])) * 100
        else:
            mape = np.nan
        
        correlation, _ = stats.pearsonr(sim_clean, actual_clean) if len(sim_clean) > 2 else (np.nan, np.nan)
        
        slope, intercept, r_value, _, _ = stats.linregress(actual_clean, sim_clean) if len(sim_clean) > 2 else (np.nan, np.nan, np.nan, np.nan, np.nan)
        r_squared = r_value ** 2 if not np.isnan(r_value) else np.nan
        
        bias = np.mean(sim_clean - actual_clean)
        
        return ComparisonMetrics(
            variable=variable_name,
            mae=mae,
            rmse=rmse,
            mape=mape,
            r_squared=r_squared,
            correlation=correlation,
            bias=bias
        )

    def compare_results(self, simulation_results: Dict, actual_results: Dict) -> Dict:
        variables = ['temperature', 'humidity', 'biomass', 'substrate', 'product', 'co2']
        
        sim_time = np.array(simulation_results['time'])
        
        if isinstance(actual_results, pd.DataFrame):
            actual_time = actual_results['time'].values
            actual_dict = {col: actual_results[col].values for col in actual_results.columns}
        else:
            actual_time = np.array(actual_results['time'])
            actual_dict = actual_results
        
        self.metrics = {}
        self.aligned_data = {}
        
        for var in variables:
            if var in simulation_results and var in actual_dict:
                sim_data = np.array(simulation_results[var])
                actual_data = np.array(actual_dict[var])
                
                sim_aligned, actual_aligned, common_time = self._align_time_series(
                    sim_time, sim_data, actual_time, actual_data
                )
                
                self.aligned_data[var] = {
                    'time': common_time,
                    'simulation': sim_aligned,
                    'actual': actual_aligned
                }
                
                self.metrics[var] = self._calculate_metrics(sim_aligned, actual_aligned, var)
        
        return self.metrics

    def analyze_phases(self, simulation_results: Dict, actual_results: Dict,
                       phase_definitions: List[Dict]) -> List[PhaseAnalysis]:
        self.phase_analyses = []
        
        sim_time = np.array(simulation_results['time'])
        actual_time = np.array(actual_results['time'])
        
        for phase in phase_definitions:
            phase_name = phase['name']
            t_start, t_end = phase['time_range']
            
            sim_mask = (sim_time >= t_start) & (sim_time <= t_end)
            actual_mask = (actual_time >= t_start) & (actual_time <= t_end)
            
            phase_sim_stats = {}
            phase_actual_stats = {}
            phase_diff_stats = {}
            
            for var in ['temperature', 'humidity', 'biomass', 'substrate', 'product']:
                if var in simulation_results and var in actual_results:
                    sim_data = np.array(simulation_results[var])[sim_mask]
                    actual_data = np.array(actual_results[var])[actual_mask]
                    
                    if len(sim_data) > 0:
                        phase_sim_stats[var] = {
                            'mean': np.mean(sim_data),
                            'std': np.std(sim_data),
                            'min': np.min(sim_data),
                            'max': np.max(sim_data)
                        }
                    
                    if len(actual_data) > 0:
                        phase_actual_stats[var] = {
                            'mean': np.mean(actual_data),
                            'std': np.std(actual_data),
                            'min': np.min(actual_data),
                            'max': np.max(actual_data)
                        }
                    
                    if len(sim_data) > 0 and len(actual_data) > 0:
                        sim_mean = np.mean(sim_data)
                        actual_mean = np.mean(actual_data)
                        phase_diff_stats[var] = {
                            'abs_diff': abs(sim_mean - actual_mean),
                            'rel_diff': (abs(sim_mean - actual_mean) / abs(actual_mean) * 100 
                                        if actual_mean != 0 else np.nan),
                            'bias': sim_mean - actual_mean
                        }
            
            self.phase_analyses.append(PhaseAnalysis(
                phase_name=phase_name,
                time_range=(t_start, t_end),
                simulation_stats=phase_sim_stats,
                actual_stats=phase_actual_stats,
                difference_stats=phase_diff_stats
            ))
        
        return self.phase_analyses

    def detect_discrepancies(self, threshold_mape: float = 15.0) -> List[Dict]:
        discrepancies = []
        
        for var, metrics in self.metrics.items():
            if not np.isnan(metrics.mape) and metrics.mape > threshold_mape:
                discrepancies.append({
                    'variable': var,
                    'mape': metrics.mape,
                    'threshold': threshold_mape,
                    'severity': 'HIGH' if metrics.mape > 30 else 'MEDIUM',
                    'recommendation': f'{var}的MAPE为{metrics.mape:.1f}%，建议重新校准模型参数'
                })
        
        return discrepancies

    def generate_comparison_report(self) -> str:
        report = []
        report.append("=" * 70)
        report.append("仿真与实际数据对比分析报告")
        report.append("=" * 70)
        report.append("")
        
        report.append("精度指标汇总:")
        report.append("-" * 70)
        report.append(f"{'变量':<12} {'MAE':>10} {'RMSE':>10} {'MAPE(%)':>10} {'R²':>10} {'相关系数':>10}")
        report.append("-" * 70)
        
        for var, metrics in self.metrics.items():
            mae_str = f"{metrics.mae:.4f}" if not np.isnan(metrics.mae) else "N/A"
            rmse_str = f"{metrics.rmse:.4f}" if not np.isnan(metrics.rmse) else "N/A"
            mape_str = f"{metrics.mape:.2f}" if not np.isnan(metrics.mape) else "N/A"
            r2_str = f"{metrics.r_squared:.4f}" if not np.isnan(metrics.r_squared) else "N/A"
            corr_str = f"{metrics.correlation:.4f}" if not np.isnan(metrics.correlation) else "N/A"
            
            report.append(f"{var:<12} {mae_str:>10} {rmse_str:>10} {mape_str:>10} {r2_str:>10} {corr_str:>10}")
        
        report.append("")
        
        discrepancies = self.detect_discrepancies()
        if discrepancies:
            report.append("显著偏差检测:")
            report.append("-" * 70)
            for disc in discrepancies:
                report.append(f"[{disc['severity']}] {disc['variable']}: MAPE={disc['mape']:.1f}%")
                report.append(f"    建议: {disc['recommendation']}")
            report.append("")
        
        if self.phase_analyses:
            report.append("阶段分析结果:")
            report.append("-" * 70)
            for phase in self.phase_analyses:
                report.append(f"\n{phase.phase_name} (时间范围: {phase.time_range[0]:.1f}-{phase.time_range[1]:.1f}h)")
                for var, diff in phase.difference_stats.items():
                    if not np.isnan(diff['rel_diff']):
                        report.append(f"  {var}: 相对偏差={diff['rel_diff']:.1f}%, 绝对偏差={diff['abs_diff']:.4f}")
        
        return "\n".join(report)

    def get_overall_score(self) -> float:
        valid_metrics = [m for m in self.metrics.values() if not np.isnan(m.r_squared)]
        
        if not valid_metrics:
            return 0.0
        
        r2_scores = [m.r_squared for m in valid_metrics]
        mape_scores = [min(100, max(0, 100 - m.mape)) / 100 for m in self.metrics.values() if not np.isnan(m.mape)]
        
        avg_r2 = np.mean(r2_scores) if r2_scores else 0
        avg_mape_score = np.mean(mape_scores) if mape_scores else 0
        
        return (avg_r2 * 0.6 + avg_mape_score * 0.4) * 100


class ModelCalibrator:
    def __init__(self):
        self.calibration_history = []

    def calculate_parameter_sensitivity(self, base_params: Dict, simulation_func, 
                                        actual_results: Dict, param_range: Dict) -> Dict:
        sensitivity = {}
        
        for param_name, (min_val, max_val) in param_range.items():
            test_values = np.linspace(min_val, max_val, 5)
            errors = []
            
            for val in test_values:
                test_params = base_params.copy()
                test_params[param_name] = val
                
                sim_results = simulation_func(test_params)
                
                comparator = SimulationComparator()
                comparator.compare_results(sim_results, actual_results)
                
                metrics = list(comparator.metrics.values())
                if metrics:
                    avg_rmse = np.mean([m.rmse for m in metrics if not np.isnan(m.rmse)])
                    errors.append(avg_rmse)
            
            if len(errors) > 1:
                sensitivity[param_name] = {
                    'values': test_values.tolist(),
                    'errors': errors,
                    'sensitivity_index': (max(errors) - min(errors)) / (max_val - min_val) if (max_val - min_val) != 0 else 0
                }
        
        return sensitivity

    def recommend_calibration(self, current_metrics: Dict[str, ComparisonMetrics]) -> List[Dict]:
        recommendations = []
        
        for var, metrics in current_metrics.items():
            if np.isnan(metrics.bias):
                continue
            
            if abs(metrics.bias) > metrics.mae * 0.5:
                if metrics.bias > 0:
                    direction = '偏高'
                else:
                    direction = '偏低'
                
                recommendations.append({
                    'variable': var,
                    'bias': metrics.bias,
                    'direction': direction,
                    'action': f'考虑调整与{var}相关的动力学参数以修正系统性{direction}'
                })
        
        return recommendations

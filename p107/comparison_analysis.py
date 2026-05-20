import numpy as np
from typing import Dict, List, Optional, Tuple, Union
from dataclasses import dataclass
from scipy import stats
from scipy.stats import pearsonr, spearmanr, linregress
import matplotlib.pyplot as plt


@dataclass
class TestDataPoint:
    sample_id: str
    formula_name: str
    materials: Dict[str, float]
    process_params: Dict[str, float]
    measured_blackness: Optional[float] = None
    measured_gloss: Optional[float] = None
    measured_durability: Optional[float] = None
    measured_smoothness: Optional[float] = None
    measured_viscosity: Optional[float] = None
    measured_particle_size: Optional[float] = None
    overall_score: Optional[float] = None
    notes: Optional[str] = None
    timestamp: Optional[float] = None

    def to_dict(self) -> Dict:
        return {
            'sample_id': self.sample_id,
            'formula_name': self.formula_name,
            'materials': self.materials,
            'process_params': self.process_params,
            'measured_blackness': self.measured_blackness,
            'measured_gloss': self.measured_gloss,
            'measured_durability': self.measured_durability,
            'measured_smoothness': self.measured_smoothness,
            'measured_viscosity': self.measured_viscosity,
            'measured_particle_size': self.measured_particle_size,
            'overall_score': self.overall_score,
            'notes': self.notes,
            'timestamp': self.timestamp
        }


@dataclass
class ComparisonResult:
    parameter: str
    simulated_value: float
    measured_value: float
    absolute_error: float
    relative_error: float
    error_percentage: float

    def to_dict(self) -> Dict:
        return {
            'parameter': self.parameter,
            'simulated_value': self.simulated_value,
            'measured_value': self.measured_value,
            'absolute_error': self.absolute_error,
            'relative_error': self.relative_error,
            'error_percentage': self.error_percentage
        }


class SimulationVsTestComparison:
    def __init__(self):
        self.test_data: List[TestDataPoint] = []
        self.simulation_results: List[Dict] = []
        self.comparison_history: List[Dict] = []

    def add_test_data(self, test_data: Union[TestDataPoint, List[TestDataPoint]]) -> None:
        if isinstance(test_data, list):
            self.test_data.extend(test_data)
        else:
            self.test_data.append(test_data)

    def add_simulation_result(self, sim_result: Dict) -> None:
        self.simulation_results.append(sim_result)

    def compare_single(self, simulation_result: Dict, 
                       test_data: TestDataPoint) -> Dict:
        comparisons = []
        param_mapping = {
            'blackness': ('blackness_score', 'measured_blackness'),
            'gloss': ('gloss_score', 'measured_gloss'),
            'durability': ('durability_score', 'measured_durability'),
            'smoothness': ('smoothness_score', 'measured_smoothness')
        }

        quality_scores = simulation_result.get('quality_scores', {})
        
        for param_name, (sim_key, test_key) in param_mapping.items():
            sim_value = quality_scores.get(sim_key)
            test_value = getattr(test_data, test_key, None)
            
            if sim_value is not None and test_value is not None and test_value > 0:
                abs_error = abs(sim_value - test_value)
                rel_error = abs_error / test_value
                comparisons.append(ComparisonResult(
                    parameter=param_name,
                    simulated_value=sim_value,
                    measured_value=test_value,
                    absolute_error=abs_error,
                    relative_error=rel_error,
                    error_percentage=rel_error * 100
                ))

        overall_sim = quality_scores.get('overall_quality')
        overall_test = test_data.overall_score
        
        if overall_sim is not None and overall_test is not None and overall_test > 0:
            abs_error = abs(overall_sim - overall_test)
            rel_error = abs_error / overall_test
            comparisons.append(ComparisonResult(
                parameter='overall_quality',
                simulated_value=overall_sim,
                measured_value=overall_test,
                absolute_error=abs_error,
                relative_error=rel_error,
                error_percentage=rel_error * 100
            ))

        avg_error = np.mean([c.error_percentage for c in comparisons]) if comparisons else 0
        
        result = {
            'sample_id': test_data.sample_id,
            'formula_name': test_data.formula_name,
            'comparisons': [c.to_dict() for c in comparisons],
            'average_error_percentage': avg_error,
            'max_error_percentage': max([c.error_percentage for c in comparisons]) if comparisons else 0,
            'accuracy': 100 - avg_error,
            'match_level': self._get_match_level(avg_error)
        }
        
        self.comparison_history.append(result)
        return result

    def _get_match_level(self, avg_error: float) -> str:
        if avg_error < 5:
            return 'excellent'
        elif avg_error < 10:
            return 'good'
        elif avg_error < 15:
            return 'fair'
        elif avg_error < 25:
            return 'poor'
        else:
            return 'very_poor'

    def batch_compare(self, simulation_results: List[Dict], 
                      test_data_list: List[TestDataPoint]) -> Dict:
        results = []
        for sim_result, test_data in zip(simulation_results, test_data_list):
            result = self.compare_single(sim_result, test_data)
            results.append(result)
        
        accuracies = [r['accuracy'] for r in results]
        errors = [r['average_error_percentage'] for r in results]
        
        summary = {
            'total_comparisons': len(results),
            'average_accuracy': np.mean(accuracies),
            'min_accuracy': np.min(accuracies),
            'max_accuracy': np.max(accuracies),
            'std_accuracy': np.std(accuracies),
            'average_error': np.mean(errors),
            'by_match_level': self._count_by_match_level(results),
            'individual_results': results
        }
        
        param_stats = self._calculate_parameter_statistics(results)
        summary['parameter_statistics'] = param_stats
        
        return summary

    def _count_by_match_level(self, results: List[Dict]) -> Dict:
        counts = {'excellent': 0, 'good': 0, 'fair': 0, 'poor': 0, 'very_poor': 0}
        for r in results:
            counts[r['match_level']] += 1
        return counts

    def _calculate_parameter_statistics(self, results: List[Dict]) -> Dict:
        param_errors = {}
        
        for result in results:
            for comp in result['comparisons']:
                param = comp['parameter']
                if param not in param_errors:
                    param_errors[param] = []
                param_errors[param].append(comp['error_percentage'])
        
        stats = {}
        for param, errors in param_errors.items():
            stats[param] = {
                'mean_error': np.mean(errors),
                'std_error': np.std(errors),
                'max_error': np.max(errors),
                'min_error': np.min(errors),
                'median_error': np.median(errors)
            }
        
        return stats

    def calculate_correlation(self, parameter: str = 'overall_quality') -> Dict:
        sim_values = []
        test_values = []
        
        for result in self.comparison_history:
            for comp in result['comparisons']:
                if comp['parameter'] == parameter:
                    sim_values.append(comp['simulated_value'])
                    test_values.append(comp['measured_value'])
        
        if len(sim_values) < 3:
            return {'error': 'Insufficient data for correlation analysis'}
        
        pearson_corr, pearson_p = pearsonr(sim_values, test_values)
        spearman_corr, spearman_p = spearmanr(sim_values, test_values)
        
        regression = linregress(test_values, sim_values)
        
        return {
            'parameter': parameter,
            'n_samples': len(sim_values),
            'pearson_correlation': float(pearson_corr),
            'pearson_p_value': float(pearson_p),
            'spearman_correlation': float(spearman_corr),
            'spearman_p_value': float(spearman_p),
            'r_squared': float(regression.rvalue ** 2),
            'slope': float(regression.slope),
            'intercept': float(regression.intercept),
            'rmse': float(np.sqrt(np.mean((np.array(sim_values) - np.array(test_values)) ** 2))),
            'mae': float(np.mean(np.abs(np.array(sim_values) - np.array(test_values))))
        }

    def generate_calibration_model(self, parameter: str = 'overall_quality') -> Dict:
        sim_values = []
        test_values = []
        
        for result in self.comparison_history:
            for comp in result['comparisons']:
                if comp['parameter'] == parameter:
                    sim_values.append(comp['simulated_value'])
                    test_values.append(comp['measured_value'])
        
        if len(sim_values) < 5:
            return {'error': 'Insufficient data for calibration model'}
        
        x = np.array(test_values)
        y = np.array(sim_values)
        
        coeffs = np.polyfit(x, y, 2)
        poly_func = np.poly1d(coeffs)
        
        y_pred = poly_func(x)
        r_squared = 1 - np.sum((y - y_pred) ** 2) / np.sum((y - np.mean(y)) ** 2)
        
        return {
            'parameter': parameter,
            'calibration_formula': f"calibrated = {coeffs[2]:.4f} + {coeffs[1]:.4f}*x + {coeffs[0]:.4f}*x^2",
            'coefficients': coeffs.tolist(),
            'r_squared': float(r_squared),
            'rmse': float(np.sqrt(np.mean((y - y_pred) ** 2))),
            'calibrated_values': y_pred.tolist(),
            'original_values': y.tolist(),
            'test_values': x.tolist()
        }

    def suggest_model_improvements(self) -> List[Dict]:
        suggestions = []
        param_stats = self._calculate_parameter_statistics(self.comparison_history)
        
        for param, stats in param_stats.items():
            if stats['mean_error'] > 15:
                suggestions.append({
                    'parameter': param,
                    'issue': f"平均误差较高 ({stats['mean_error']:.1f}%)",
                    'suggestion': f"建议重新校准{param}的计算模型，考虑引入更多影响因素",
                    'priority': 'high'
                })
            elif stats['mean_error'] > 10:
                suggestions.append({
                    'parameter': param,
                    'issue': f"平均误差中等 ({stats['mean_error']:.1f}%)",
                    'suggestion': f"建议微调{param}的权重参数",
                    'priority': 'medium'
                })
        
        return suggestions

    def export_comparison_report(self) -> Dict:
        if not self.comparison_history:
            return {'error': 'No comparison data available'}
        
        overall_corr = self.calculate_correlation('overall_quality')
        improvements = self.suggest_model_improvements()
        
        accuracies = [r['accuracy'] for r in self.comparison_history]
        
        report = {
            'summary': {
                'total_comparisons': len(self.comparison_history),
                'average_accuracy': float(np.mean(accuracies)),
                'accuracy_std': float(np.std(accuracies)),
                'overall_correlation': overall_corr
            },
            'parameter_statistics': self._calculate_parameter_statistics(self.comparison_history),
            'suggested_improvements': improvements,
            'individual_comparisons': self.comparison_history
        }
        
        return report

    def visualize_comparison(self, parameter: str = 'overall_quality', 
                              save_path: Optional[str] = None) -> plt.Figure:
        fig, axes = plt.subplots(2, 2, figsize=(14, 12))
        
        sim_values = []
        test_values = []
        sample_ids = []
        
        for result in self.comparison_history:
            for comp in result['comparisons']:
                if comp['parameter'] == parameter:
                    sim_values.append(comp['simulated_value'])
                    test_values.append(comp['measured_value'])
                    sample_ids.append(result['sample_id'])
        
        if not sim_values:
            return fig
        
        ax1 = axes[0, 0]
        max_val = max(max(sim_values), max(test_values))
        ax1.scatter(test_values, sim_values, alpha=0.6, s=80, edgecolors='k')
        ax1.plot([0, max_val], [0, max_val], 'r--', label='完美预测线')
        ax1.set_xlabel('实测值', fontsize=12)
        ax1.set_ylabel('仿真值', fontsize=12)
        ax1.set_title(f'{parameter} - 仿真值 vs 实测值', fontsize=14, fontweight='bold')
        ax1.legend()
        ax1.grid(True, alpha=0.3)
        
        ax2 = axes[0, 1]
        errors = [abs(s - t) for s, t in zip(sim_values, test_values)]
        ax2.bar(range(len(errors)), errors, alpha=0.7, color='steelblue')
        ax2.set_xlabel('样本序号', fontsize=12)
        ax2.set_ylabel('绝对误差', fontsize=12)
        ax2.set_title('各样本绝对误差', fontsize=14, fontweight='bold')
        ax2.grid(True, alpha=0.3, axis='y')
        
        ax3 = axes[1, 0]
        error_percents = [abs(s - t) / t * 100 if t > 0 else 0 
                         for s, t in zip(sim_values, test_values)]
        ax3.hist(error_percents, bins=15, alpha=0.7, color='forestgreen', edgecolor='k')
        ax3.axvline(np.mean(error_percents), color='r', linestyle='--', 
                   label=f'平均误差: {np.mean(error_percents):.1f}%')
        ax3.set_xlabel('相对误差 (%)', fontsize=12)
        ax3.set_ylabel('频数', fontsize=12)
        ax3.set_title('误差分布直方图', fontsize=14, fontweight='bold')
        ax3.legend()
        ax3.grid(True, alpha=0.3, axis='y')
        
        ax4 = axes[1, 1]
        x_pos = np.arange(len(sim_values))
        width = 0.35
        ax4.bar(x_pos - width/2, sim_values, width, label='仿真值', alpha=0.8)
        ax4.bar(x_pos + width/2, test_values, width, label='实测值', alpha=0.8)
        ax4.set_xlabel('样本序号', fontsize=12)
        ax4.set_ylabel('数值', fontsize=12)
        ax4.set_title('仿真值与实测值对比', fontsize=14, fontweight='bold')
        ax4.legend()
        ax4.grid(True, alpha=0.3, axis='y')
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=150, bbox_inches='tight')
        
        return fig

    def load_test_data_from_json(self, json_path: str) -> None:
        import json
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        for item in data.get('test_data', []):
            test_point = TestDataPoint(
                sample_id=item.get('sample_id', ''),
                formula_name=item.get('formula_name', ''),
                materials=item.get('materials', {}),
                process_params=item.get('process_params', {}),
                measured_blackness=item.get('measured_blackness'),
                measured_gloss=item.get('measured_gloss'),
                measured_durability=item.get('measured_durability'),
                measured_smoothness=item.get('measured_smoothness'),
                measured_viscosity=item.get('measured_viscosity'),
                measured_particle_size=item.get('measured_particle_size'),
                overall_score=item.get('overall_score'),
                notes=item.get('notes'),
                timestamp=item.get('timestamp')
            )
            self.add_test_data(test_point)


def generate_sample_test_data() -> List[TestDataPoint]:
    test_data = []
    
    formulas = [
        {'name': '传统松烟墨A', 'materials': {'松烟': 0.65, '骨胶': 0.25, '珍珠粉': 0.05, '冰片': 0.05}},
        {'name': '桐油烟墨B', 'materials': {'桐油烟': 0.60, '桃胶': 0.30, '冰片': 0.05, '珍珠粉': 0.05}},
        {'name': '混合烟墨C', 'materials': {'松烟': 0.30, '桐油烟': 0.30, '骨胶': 0.28, '冰片': 0.06, '珍珠粉': 0.06}},
        {'name': '高档漆烟墨D', 'materials': {'漆烟': 0.55, '骨胶': 0.32, '冰片': 0.07, '珍珠粉': 0.06}},
    ]
    
    for i, formula in enumerate(formulas):
        base_noise = np.random.normal(0, 3)
        test_point = TestDataPoint(
            sample_id=f'TEST_{i+1:03d}',
            formula_name=formula['name'],
            materials=formula['materials'],
            process_params={
                'firing_temperature': 850 + np.random.randint(-100, 100),
                'firing_time': 120 + np.random.randint(-30, 60),
                'grinding_time': 60 + np.random.randint(-20, 40)
            },
            measured_blackness=75 + base_noise + np.random.normal(0, 5),
            measured_gloss=45 + base_noise + np.random.normal(0, 8),
            measured_durability=70 + base_noise + np.random.normal(0, 6),
            measured_smoothness=65 + base_noise + np.random.normal(0, 7),
            overall_score=72 + base_noise + np.random.normal(0, 4)
        )
        test_data.append(test_point)
    
    return test_data

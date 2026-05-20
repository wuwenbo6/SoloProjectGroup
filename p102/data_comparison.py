import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
from scipy import stats
import json
import warnings


@dataclass
class TestDataPoint:
    position: Tuple[float, float, float]
    stress_type: str
    value: float
    unit: str
    timestamp: Optional[str] = None
    uncertainty: Optional[float] = None
    sensor_id: Optional[str] = None


@dataclass
class ComparisonMetric:
    metric_name: str
    simulation_value: float
    experimental_value: float
    difference_abs: float
    difference_rel: float
    error_percent: float
    passed: bool
    tolerance: float = 10.0


class DataComparator:
    def __init__(self, tolerance: float = 10.0):
        self.default_tolerance = tolerance
        self.simulation_data: Dict[str, Any] = {}
        self.experimental_data: List[TestDataPoint] = []
        self.comparison_results: List[ComparisonMetric] = []
    
    def load_simulation_data(self, results: Dict[str, Any]) -> None:
        self.simulation_data = results
    
    def load_experimental_data(self, data: List[TestDataPoint]) -> None:
        self.experimental_data = data
    
    def load_experimental_from_json(self, filepath: str) -> None:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        for point in data.get('measurements', []):
            self.experimental_data.append(TestDataPoint(
                position=tuple(point.get('position', [0, 0, 0])),
                stress_type=point.get('stress_type', 'unknown'),
                value=float(point.get('value', 0)),
                unit=point.get('unit', 'Pa'),
                timestamp=point.get('timestamp'),
                uncertainty=float(point.get('uncertainty')) if point.get('uncertainty') else None,
                sensor_id=point.get('sensor_id')
            ))
    
    def extract_simulation_value(self,
                                  position: Tuple[float, float, float],
                                  stress_type: str) -> Optional[float]:
        if stress_type == 'deformation':
            if 'deformation' in self.simulation_data:
                return self.simulation_data['deformation'].get('total', 0.0)
        
        if 'max_stresses' in self.simulation_data:
            stress_map = {
                'von_mises': self.simulation_data['max_stresses'].get('max_von_mises', 0.0),
                'sigma_x': self.simulation_data['max_stresses'].get('max_normal', 0.0),
                'tau': self.simulation_data['max_stresses'].get('max_shear', 0.0)
            }
            return stress_map.get(stress_type, 0.0)
        
        if 'stress_field' in self.simulation_data:
            stress_field = self.simulation_data['stress_field']
            if 'sigma_x' in stress_field:
                stress_map = stress_field.get(stress_type, stress_field.get('sigma_x'))
                if isinstance(stress_map, np.ndarray):
                    pos_idx = min(int(position[0] * 100), len(stress_map) - 1)
                    pos_idx = max(0, pos_idx)
                    return float(stress_map[pos_idx])
                return float(stress_map)
        
        return 0.0
    
    def compare_point(self,
                       test_point: TestDataPoint,
                       tolerance: Optional[float] = None) -> ComparisonMetric:
        tol = tolerance if tolerance is not None else self.default_tolerance
        
        sim_value = self.extract_simulation_value(
            test_point.position,
            test_point.stress_type
        )
        
        if sim_value is None:
            sim_value = 0.0
        
        exp_value = test_point.value
        diff_abs = abs(sim_value - exp_value)
        diff_rel = diff_abs / abs(exp_value) if abs(exp_value) > 1e-10 else 0.0
        error_percent = diff_rel * 100
        
        return ComparisonMetric(
            metric_name=f"{test_point.stress_type}_{test_point.sensor_id or 'point'}",
            simulation_value=sim_value,
            experimental_value=exp_value,
            difference_abs=diff_abs,
            difference_rel=diff_rel,
            error_percent=error_percent,
            passed=error_percent <= tol,
            tolerance=tol
        )
    
    def run_comparison(self, tolerance: Optional[float] = None) -> List[ComparisonMetric]:
        self.comparison_results = []
        
        for test_point in self.experimental_data:
            result = self.compare_point(test_point, tolerance)
            self.comparison_results.append(result)
        
        if 'deformation' in self.simulation_data and self.experimental_data:
            deform_sim = self.simulation_data['deformation'].get('total', 0)
            deform_exp_points = [p for p in self.experimental_data if p.stress_type == 'deformation']
            if deform_exp_points:
                deform_exp = np.mean([p.value for p in deform_exp_points])
                diff_abs = abs(deform_sim - deform_exp)
                diff_rel = diff_abs / abs(deform_exp) if abs(deform_exp) > 1e-10 else 0
                
                self.comparison_results.append(ComparisonMetric(
                    metric_name='overall_deformation',
                    simulation_value=deform_sim,
                    experimental_value=deform_exp,
                    difference_abs=diff_abs,
                    difference_rel=diff_rel,
                    error_percent=diff_rel * 100,
                    passed=diff_rel * 100 <= (tolerance or self.default_tolerance),
                    tolerance=tolerance or self.default_tolerance
                ))
        
        if 'max_stresses' in self.simulation_data:
            stress_sim = self.simulation_data['max_stresses'].get('max_von_mises', 0)
            stress_exp_points = [p for p in self.experimental_data if p.stress_type == 'von_mises']
            if stress_exp_points:
                stress_exp = np.mean([p.value for p in stress_exp_points])
                diff_abs = abs(stress_sim - stress_exp)
                diff_rel = diff_abs / abs(stress_exp) if abs(stress_exp) > 1e-10 else 0
                
                self.comparison_results.append(ComparisonMetric(
                    metric_name='max_von_mises_stress',
                    simulation_value=stress_sim,
                    experimental_value=stress_exp,
                    difference_abs=diff_abs,
                    difference_rel=diff_rel,
                    error_percent=diff_rel * 100,
                    passed=diff_rel * 100 <= (tolerance or self.default_tolerance),
                    tolerance=tolerance or self.default_tolerance
                ))
        
        return self.comparison_results
    
    def get_summary(self) -> Dict[str, Any]:
        if not self.comparison_results:
            return {'error': 'No comparison results available'}
        
        errors = [r.error_percent for r in self.comparison_results]
        passed = [r.passed for r in self.comparison_results]
        
        summary = {
            'total_comparisons': len(self.comparison_results),
            'passed_count': sum(passed),
            'failed_count': len(passed) - sum(passed),
            'pass_rate': sum(passed) / len(passed) * 100,
            'mean_error_percent': np.mean(errors),
            'max_error_percent': np.max(errors),
            'min_error_percent': np.min(errors),
            'std_error_percent': np.std(errors),
            'rmse': np.sqrt(np.mean([r.difference_abs ** 2 for r in self.comparison_results]))
        }
        
        all_sim = [r.simulation_value for r in self.comparison_results]
        all_exp = [r.experimental_value for r in self.comparison_results]
        
        if len(all_sim) > 1 and np.std(all_exp) > 1e-10:
            slope, intercept, r_value, p_value, std_err = stats.linregress(all_exp, all_sim)
            summary.update({
                'correlation_coefficient': r_value,
                'r_squared': r_value ** 2,
                'regression_slope': slope,
                'regression_intercept': intercept
            })
        
        summary['validation_status'] = 'PASS' if summary['pass_rate'] >= 80 else 'FAIL'
        
        return summary
    
    def identify_outliers(self, threshold: float = 2.0) -> List[ComparisonMetric]:
        if not self.comparison_results:
            return []
        
        errors = [r.error_percent for r in self.comparison_results]
        mean_err = np.mean(errors)
        std_err = np.std(errors)
        
        outliers = []
        for result in self.comparison_results:
            z_score = abs(result.error_percent - mean_err) / (std_err + 1e-10)
            if z_score > threshold:
                outliers.append(result)
        
        return outliers
    
    def generate_correction_model(self) -> Dict[str, float]:
        if len(self.comparison_results) < 3:
            return {
                'scale_factor': 1.0,
                'offset': 0.0,
                'confidence': 0.5
            }
        
        all_sim = np.array([r.simulation_value for r in self.comparison_results])
        all_exp = np.array([r.experimental_value for r in self.comparison_results])
        
        valid_mask = (np.abs(all_exp) > 1e-10)
        if np.sum(valid_mask) < 3:
            return {
                'scale_factor': 1.0,
                'offset': 0.0,
                'confidence': 0.5
            }
        
        ratios = all_exp[valid_mask] / all_sim[valid_mask]
        scale_factor = np.median(ratios)
        
        residuals = all_exp[valid_mask] - scale_factor * all_sim[valid_mask]
        offset = np.mean(residuals)
        
        corrected = scale_factor * all_sim + offset
        mae = np.mean(np.abs(corrected - all_exp))
        confidence = max(0, 1 - mae / (np.mean(np.abs(all_exp)) + 1e-10))
        
        return {
            'scale_factor': float(scale_factor),
            'offset': float(offset),
            'confidence': float(confidence)
        }
    
    def apply_correction(self, correction_model: Dict[str, float]) -> Dict[str, Any]:
        if 'stress_field' in self.simulation_data:
            for key in self.simulation_data['stress_field']:
                if isinstance(self.simulation_data['stress_field'][key], np.ndarray):
                    self.simulation_data['stress_field'][key] = (
                        self.simulation_data['stress_field'][key] * correction_model['scale_factor'] +
                        correction_model['offset']
                    )
        
        if 'max_stresses' in self.simulation_data:
            for key in self.simulation_data['max_stresses']:
                value = self.simulation_data['max_stresses'][key]
                if isinstance(value, (int, float, np.number)):
                    self.simulation_data['max_stresses'][key] = (
                        value * correction_model['scale_factor'] +
                        correction_model['offset']
                    )
        
        return self.simulation_data
    
    def print_comparison_report(self) -> None:
        summary = self.get_summary()
        
        print("\n" + "="*60)
        print("📊 仿真与实验数据对比分析报告")
        print("="*60)
        
        print(f"\n总体统计:")
        print(f"  比较点数: {summary['total_comparisons']}")
        print(f"  通过点数: {summary['passed_count']}")
        print(f"  未通过点数: {summary['failed_count']}")
        print(f"  通过率: {summary['pass_rate']:.1f}%")
        
        print(f"\n误差分析:")
        print(f"  平均误差: {summary['mean_error_percent']:.2f}%")
        print(f"  最大误差: {summary['max_error_percent']:.2f}%")
        print(f"  最小误差: {summary['min_error_percent']:.2f}%")
        print(f"  误差标准差: {summary['std_error_percent']:.2f}%")
        
        if 'correlation_coefficient' in summary:
            print(f"\n相关性分析:")
            print(f"  相关系数: {summary['correlation_coefficient']:.4f}")
            print(f"  R² 决定系数: {summary['r_squared']:.4f}")
        
        print(f"\n验证状态: {'✅ 通过' if summary['validation_status'] == 'PASS' else '❌ 未通过'}")
        
        outliers = self.identify_outliers()
        if outliers:
            print(f"\n⚠️  检测到 {len(outliers)} 个异常点:")
            for outlier in outliers[:5]:
                print(f"  - {outlier.metric_name}: 误差 {outlier.error_percent:.1f}%")
        
        print("\n" + "-"*60)
        print("详细对比结果:")
        print("-"*60)
        
        for i, result in enumerate(self.comparison_results):
            status = "✅" if result.passed else "❌"
            print(f"\n{i+1:2d}. {result.metric_name} {status}")
            print(f"    仿真值: {result.simulation_value:.6g}")
            print(f"    实验值: {result.experimental_value:.6g}")
            print(f"    误差: {result.error_percent:.2f}% (容差: {result.tolerance}%)")
        
        correction = self.generate_correction_model()
        print(f"\n" + "-"*60)
        print("建议校正模型:")
        print(f"  缩放因子: {correction['scale_factor']:.4f}")
        print(f"  偏移量: {correction['offset']:.6g}")
        print(f"  置信度: {correction['confidence']:.1%}")
        print("="*60 + "\n")


def generate_sample_test_data(n_points: int = 10, noise_level: float = 0.05) -> List[TestDataPoint]:
    test_data = []
    
    for i in range(n_points):
        x = 0.05 + i * 0.25 / n_points
        base_stress = 10e6 * (1 + 0.5 * np.sin(x * 10))
        noise = np.random.normal(0, noise_level * base_stress)
        
        test_data.append(TestDataPoint(
            position=(x, 0.025, 0.025),
            stress_type='sigma_x',
            value=base_stress + noise,
            unit='Pa',
            uncertainty=0.05 * base_stress,
            sensor_id=f'STRAIN_{i:03d}'
        ))
    
    test_data.append(TestDataPoint(
        position=(0.15, 0.025, 0.025),
        stress_type='von_mises',
        value=14.4e6 * (1 + np.random.normal(0, noise_level)),
        unit='Pa',
        sensor_id='VM_MAX'
    ))
    
    test_data.append(TestDataPoint(
        position=(0.15, 0, 0),
        stress_type='deformation',
        value=0.00144 * (1 + np.random.normal(0, noise_level)),
        unit='m',
        sensor_id='DEF_MAX'
    ))
    
    return test_data

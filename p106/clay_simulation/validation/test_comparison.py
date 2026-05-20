import numpy as np
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
import json
import warnings
from scipy import stats
from scipy.interpolate import griddata


@dataclass
class TestMeasurement:
    test_id: str
    clay_type: str
    measurement_type: str
    locations: np.ndarray
    values: np.ndarray
    units: str
    timestamp: Optional[str] = None
    test_conditions: Optional[Dict] = None
    measurement_uncertainty: Optional[float] = None


@dataclass
class ComparisonResult:
    test_id: str
    metric_name: str
    rmse: float
    mae: float
    max_error: float
    r_squared: float
    correlation: float
    bias: float
    relative_error: float
    simulation_mean: float
    test_mean: float
    passed_threshold: bool
    error_distribution: Optional[np.ndarray] = None


class TestDataComparator:
    def __init__(self, tolerance_threshold: float = 0.15):
        self.tolerance_threshold = tolerance_threshold
        self.test_measurements: List[TestMeasurement] = []
        self.comparison_results: List[ComparisonResult] = []
        self.validation_history = []

    def add_test_measurement(self, measurement: TestMeasurement) -> None:
        self.test_measurements.append(measurement)

    def load_test_data_from_json(self, filepath: str) -> None:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)

        for test_data in data.get('tests', []):
            measurement = TestMeasurement(
                test_id=test_data['test_id'],
                clay_type=test_data['clay_type'],
                measurement_type=test_data['measurement_type'],
                locations=np.array(test_data['locations']),
                values=np.array(test_data['values']),
                units=test_data['units'],
                timestamp=test_data.get('timestamp'),
                test_conditions=test_data.get('test_conditions'),
                measurement_uncertainty=test_data.get('measurement_uncertainty')
            )
            self.add_test_measurement(measurement)

    def sample_simulation_field(self, field: np.ndarray,
                                 locations: np.ndarray) -> np.ndarray:
        ny, nx = field.shape
        x_coords = np.linspace(0, 1, nx)
        y_coords = np.linspace(0, 1, ny)
        X, Y = np.meshgrid(x_coords, y_coords)

        grid_points = np.column_stack((X.flatten(), Y.flatten()))
        field_values = field.flatten()

        sampled_values = griddata(grid_points, field_values, locations, method='cubic')

        if np.any(np.isnan(sampled_values)):
            linear_values = griddata(grid_points, field_values, locations, method='linear')
            mask = np.isnan(sampled_values)
            sampled_values[mask] = linear_values[mask]

        if np.any(np.isnan(sampled_values)):
            nearest_values = griddata(grid_points, field_values, locations, method='nearest')
            mask = np.isnan(sampled_values)
            sampled_values[mask] = nearest_values[mask]

        return sampled_values

    def compare_stress_field(self, simulation_stress: np.ndarray,
                              measurement: TestMeasurement) -> ComparisonResult:
        if measurement.measurement_type != 'stress':
            warnings.warn(f"测量类型不匹配: 期望 stress, 得到 {measurement.measurement_type}")

        sampled_stress = self.sample_simulation_field(simulation_stress, measurement.locations)

        rmse = np.sqrt(np.mean((sampled_stress - measurement.values) ** 2))
        mae = np.mean(np.abs(sampled_stress - measurement.values))
        max_error = np.max(np.abs(sampled_stress - measurement.values))
        bias = np.mean(sampled_stress - measurement.values)

        relative_error = rmse / (np.mean(measurement.values) + 1e-10)

        if len(measurement.values) > 2:
            correlation, p_value = stats.pearsonr(sampled_stress, measurement.values)
            slope, intercept, r_value, p_value, std_err = stats.linregress(
                measurement.values, sampled_stress
            )
            r_squared = r_value ** 2
        else:
            correlation = 0.0
            r_squared = 0.0

        passed = relative_error <= self.tolerance_threshold

        result = ComparisonResult(
            test_id=measurement.test_id,
            metric_name='stress',
            rmse=float(rmse),
            mae=float(mae),
            max_error=float(max_error),
            r_squared=float(r_squared),
            correlation=float(correlation),
            bias=float(bias),
            relative_error=float(relative_error),
            simulation_mean=float(np.mean(sampled_stress)),
            test_mean=float(np.mean(measurement.values)),
            passed_threshold=passed,
            error_distribution=sampled_stress - measurement.values
        )

        self.comparison_results.append(result)
        return result

    def compare_displacement_field(self, simulation_disp: np.ndarray,
                                    measurement: TestMeasurement) -> ComparisonResult:
        if measurement.measurement_type != 'displacement':
            warnings.warn(f"测量类型不匹配: 期望 displacement, 得到 {measurement.measurement_type}")

        if simulation_disp.ndim == 3:
            disp_magnitude = np.sqrt(simulation_disp[0] ** 2 + simulation_disp[1] ** 2)
        else:
            disp_magnitude = simulation_disp

        sampled_disp = self.sample_simulation_field(disp_magnitude, measurement.locations)

        rmse = np.sqrt(np.mean((sampled_disp - measurement.values) ** 2))
        mae = np.mean(np.abs(sampled_disp - measurement.values))
        max_error = np.max(np.abs(sampled_disp - measurement.values))
        bias = np.mean(sampled_disp - measurement.values)

        relative_error = rmse / (np.mean(measurement.values) + 1e-10)

        if len(measurement.values) > 2:
            correlation, _ = stats.pearsonr(sampled_disp, measurement.values)
            slope, intercept, r_value, p_value, std_err = stats.linregress(
                measurement.values, sampled_disp
            )
            r_squared = r_value ** 2
        else:
            correlation = 0.0
            r_squared = 0.0

        passed = relative_error <= self.tolerance_threshold

        result = ComparisonResult(
            test_id=measurement.test_id,
            metric_name='displacement',
            rmse=float(rmse),
            mae=float(mae),
            max_error=float(max_error),
            r_squared=float(r_squared),
            correlation=float(correlation),
            bias=float(bias),
            relative_error=float(relative_error),
            simulation_mean=float(np.mean(sampled_disp)),
            test_mean=float(np.mean(measurement.values)),
            passed_threshold=passed,
            error_distribution=sampled_disp - measurement.values
        )

        self.comparison_results.append(result)
        return result

    def batch_compare(self, simulation_results: Dict[str, np.ndarray],
                       measurements: Optional[List[TestMeasurement]] = None) -> Dict[str, ComparisonResult]:
        if measurements is None:
            measurements = self.test_measurements

        results = {}

        for measurement in measurements:
            if measurement.measurement_type == 'stress' and 'stress' in simulation_results:
                result = self.compare_stress_field(simulation_results['stress'], measurement)
                results[measurement.test_id] = result
            elif measurement.measurement_type == 'displacement' and 'displacement' in simulation_results:
                result = self.compare_displacement_field(simulation_results['displacement'], measurement)
                results[measurement.test_id] = result

        return results

    def get_validation_summary(self) -> Dict:
        if not self.comparison_results:
            return {'message': 'No comparison results available'}

        stress_results = [r for r in self.comparison_results if r.metric_name == 'stress']
        disp_results = [r for r in self.comparison_results if r.metric_name == 'displacement']

        def calc_stats(results):
            if not results:
                return {}
            return {
                'mean_rmse': float(np.mean([r.rmse for r in results])),
                'mean_relative_error': float(np.mean([r.relative_error for r in results])),
                'mean_r_squared': float(np.mean([r.r_squared for r in results])),
                'max_error': float(np.max([r.max_error for r in results])),
                'pass_rate': float(sum(1 for r in results if r.passed_threshold) / len(results)),
                'total_tests': len(results),
                'passed_tests': sum(1 for r in results if r.passed_threshold)
            }

        return {
            'stress_validation': calc_stats(stress_results),
            'displacement_validation': calc_stats(disp_results),
            'overall_pass_rate': float(sum(1 for r in self.comparison_results if r.passed_threshold) / len(self.comparison_results)),
            'total_comparisons': len(self.comparison_results)
        }

    def generate_validation_report(self) -> str:
        summary = self.get_validation_summary()

        report = [
            "=" * 60,
            "仿真-实测对比验证报告",
            "=" * 60,
            "",
            "整体验证结果:",
        ]

        if 'stress_validation' in summary:
            stress_stats = summary['stress_validation']
            if stress_stats:
                report.extend([
                    "",
                    "应力场验证:",
                    f"  测试数量: {stress_stats.get('total_tests', 0)}",
                    f"  通过数量: {stress_stats.get('passed_tests', 0)}",
                    f"  通过率: {stress_stats.get('pass_rate', 0):.1%}",
                    f"  平均相对误差: {stress_stats.get('mean_relative_error', 0):.1%}",
                    f"  平均 R²: {stress_stats.get('mean_r_squared', 0):.3f}",
                ])

        if 'displacement_validation' in summary:
            disp_stats = summary['displacement_validation']
            if disp_stats:
                report.extend([
                    "",
                    "位移场验证:",
                    f"  测试数量: {disp_stats.get('total_tests', 0)}",
                    f"  通过数量: {disp_stats.get('passed_tests', 0)}",
                    f"  通过率: {disp_stats.get('pass_rate', 0):.1%}",
                    f"  平均相对误差: {disp_stats.get('mean_relative_error', 0):.1%}",
                    f"  平均 R²: {disp_stats.get('mean_r_squared', 0):.3f}",
                ])

        report.extend([
            "",
            "-" * 60,
            "详细结果:",
        ])

        for result in self.comparison_results:
            status = "✓ 通过" if result.passed_threshold else "✗ 未通过"
            report.extend([
                "",
                f"测试 {result.test_id} ({result.metric_name}): {status}",
                f"  RMSE: {result.rmse:.4e} {self._get_units(result.metric_name)}",
                f"  相对误差: {result.relative_error:.1%}",
                f"  R²: {result.r_squared:.3f}",
                f"  相关系数: {result.correlation:.3f}",
                f"  偏差: {result.bias:.4e}",
                f"  仿真平均值: {result.simulation_mean:.4e}",
                f"  实测平均值: {result.test_mean:.4e}",
            ])

        report.extend([
            "",
            "=" * 60,
            f"整体验证结论: {'通过' if summary.get('overall_pass_rate', 0) >= 0.8 else '需改进'}",
            f"总体通过率: {summary.get('overall_pass_rate', 0):.1%}",
            "=" * 60,
        ])

        return "\n".join(report)

    def _get_units(self, metric_name: str) -> str:
        units_map = {
            'stress': 'Pa',
            'displacement': 'm',
            'strain': ''
        }
        return units_map.get(metric_name, '')

    def plot_comparison_scatter(self, result: ComparisonResult,
                                  save_path: Optional[str] = None) -> None:
        try:
            import matplotlib.pyplot as plt

            if result.error_distribution is None:
                warnings.warn("No error distribution data available for plotting")
                return

            test_vals = np.array([r.test_mean for r in self.comparison_results
                                   if r.metric_name == result.metric_name])
            sim_vals = np.array([r.simulation_mean for r in self.comparison_results
                                   if r.metric_name == result.metric_name])

            if len(test_vals) == 0:
                return

            fig, axes = plt.subplots(1, 2, figsize=(14, 6))

            axes[0].scatter(test_vals, sim_vals, alpha=0.7, s=80, edgecolor='black')
            max_val = max(np.max(test_vals), np.max(sim_vals))
            axes[0].plot([0, max_val], [0, max_val], 'r--', linewidth=2, label='完美拟合')
            axes[0].set_xlabel('实测值')
            axes[0].set_ylabel('仿真值')
            axes[0].set_title(f'{result.metric_name} 仿真-实测对比')
            axes[0].legend()
            axes[0].grid(True, alpha=0.3)

            errors = result.error_distribution
            axes[1].hist(errors, bins=20, alpha=0.7, edgecolor='black')
            axes[1].axvline(x=0, color='r', linestyle='--', linewidth=2)
            axes[1].set_xlabel('误差 (仿真 - 实测)')
            axes[1].set_ylabel('频次')
            axes[1].set_title('误差分布')
            axes[1].grid(True, alpha=0.3)

            plt.tight_layout()

            if save_path:
                plt.savefig(save_path, dpi=300, bbox_inches='tight')
                plt.close()
            else:
                plt.show()

        except ImportError:
            warnings.warn("Matplotlib not available for plotting")

    def export_validation_results(self, filepath: str) -> None:
        import numpy as np

        def convert_numpy(obj):
            if isinstance(obj, np.bool_):
                return bool(obj)
            elif isinstance(obj, np.integer):
                return int(obj)
            elif isinstance(obj, np.floating):
                return float(obj)
            elif isinstance(obj, np.ndarray):
                return obj.tolist()
            return obj

        results_data = {
            'summary': self.get_validation_summary(),
            'comparisons': [
                {
                    'test_id': r.test_id,
                    'metric_name': r.metric_name,
                    'rmse': float(r.rmse),
                    'mae': float(r.mae),
                    'max_error': float(r.max_error),
                    'r_squared': float(r.r_squared),
                    'correlation': float(r.correlation),
                    'bias': float(r.bias),
                    'relative_error': float(r.relative_error),
                    'simulation_mean': float(r.simulation_mean),
                    'test_mean': float(r.test_mean),
                    'passed_threshold': bool(r.passed_threshold)
                }
                for r in self.comparison_results
            ],
            'tolerance_threshold': self.tolerance_threshold
        }

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(results_data, f, ensure_ascii=False, indent=2, default=convert_numpy)


def generate_sample_test_data(output_file: str) -> None:
    test_data = {
        'tests': [
            {
                'test_id': 'STRESS_TEST_001',
                'clay_type': 'kaolin',
                'measurement_type': 'stress',
                'locations': [[0.2, 0.3], [0.5, 0.5], [0.8, 0.7], [0.3, 0.6], [0.7, 0.3]],
                'values': [25000, 35000, 28000, 32000, 29000],
                'units': 'Pa',
                'timestamp': '2024-01-15 10:30:00',
                'test_conditions': {
                    'force_magnitude': 1000,
                    'moisture_content': 0.25,
                    'temperature': 25
                },
                'measurement_uncertainty': 0.05
            },
            {
                'test_id': 'DISP_TEST_001',
                'clay_type': 'kaolin',
                'measurement_type': 'displacement',
                'locations': [[0.2, 0.3], [0.5, 0.5], [0.8, 0.7]],
                'values': [0.0012, 0.0025, 0.0018],
                'units': 'm',
                'timestamp': '2024-01-15 11:00:00',
                'test_conditions': {
                    'force_magnitude': 1000,
                    'moisture_content': 0.25
                },
                'measurement_uncertainty': 0.03
            }
        ]
    }

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(test_data, f, ensure_ascii=False, indent=2)

    print(f"Sample test data generated at: {output_file}")

import numpy as np
import json
from typing import Dict, List, Optional, Tuple
from scipy import stats
from scipy.signal import correlate
from scipy.interpolate import interp1d
from dataclasses import dataclass


@dataclass
class ComparisonMetrics:
    mae: float
    rmse: float
    mape: float
    r2: float
    correlation: float
    max_error: float
    bias: float


@dataclass
class PhaseAnalysis:
    phase_name: str
    start_time: float
    end_time: float
    metrics: ComparisonMetrics
    time_shift: float
    amplitude_ratio: float


class DataAligner:
    def __init__(self):
        pass

    def align_time_series(self,
                            sim_time: np.ndarray,
                            sim_data: np.ndarray,
                            real_time: np.ndarray,
                            real_data: np.ndarray,
                            method: str = 'linear') -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        common_start = max(sim_time[0], real_time[0])
        common_end = min(sim_time[-1], real_time[-1])
        common_time = np.linspace(common_start, common_end,
                                    max(len(sim_time), len(real_time)))

        sim_interp = interp1d(sim_time, sim_data, kind=method,
                                bounds_error=False, fill_value='extrapolate')
        real_interp = interp1d(real_time, real_data, kind=method,
                                 bounds_error=False, fill_value='extrapolate')

        sim_aligned = sim_interp(common_time)
        real_aligned = real_interp(common_time)

        return common_time, sim_aligned, real_aligned

    def find_time_shift(self, sim_signal: np.ndarray, real_signal: np.ndarray,
                         max_shift: int = 100) -> int:
        if len(sim_signal) < 10 or len(real_signal) < 10:
            return 0

        sim_norm = (sim_signal - np.mean(sim_signal)) / (np.std(sim_signal) + 1e-8)
        real_norm = (real_signal - np.mean(real_signal)) / (np.std(real_signal) + 1e-8)

        correlation = correlate(sim_norm, real_norm, mode='full')
        best_shift = np.argmax(correlation) - len(real_norm) + 1
        best_shift = np.clip(best_shift, -max_shift, max_shift)

        return int(best_shift)


class MetricsCalculator:
    @staticmethod
    def calculate_metrics(sim_data: np.ndarray,
                           real_data: np.ndarray) -> ComparisonMetrics:
        valid_mask = ~(np.isnan(sim_data) | np.isnan(real_data))
        sim_valid = sim_data[valid_mask]
        real_valid = real_data[valid_mask]

        if len(sim_valid) < 2:
            return ComparisonMetrics(0, 0, 0, 0, 0, 0, 0)

        errors = sim_valid - real_valid
        mae = float(np.mean(np.abs(errors)))
        rmse = float(np.sqrt(np.mean(errors ** 2)))
        mape = float(np.mean(np.abs(errors) / (np.abs(real_valid) + 1e-8)) * 100)

        if len(real_valid) > 1 and np.std(real_valid) > 0:
            slope, intercept, r_value, _, _ = stats.linregress(real_valid, sim_valid)
            r2 = float(r_value ** 2)
        else:
            r2 = 0.0

        correlation = float(np.corrcoef(sim_valid, real_valid)[0, 1]
                            if len(sim_valid) > 1 else 0.0)
        max_error = float(np.max(np.abs(errors)))
        bias = float(np.mean(errors))

        return ComparisonMetrics(mae, rmse, mape, r2, correlation, max_error, bias)

    @staticmethod
    def calculate_error_distribution(errors: np.ndarray) -> Dict:
        percentiles = np.percentile(errors, [10, 25, 50, 75, 90])
        return {
            'mean': float(np.mean(errors)),
            'std': float(np.std(errors)),
            'percentiles': {
                'p10': float(percentiles[0]),
                'p25': float(percentiles[1]),
                'p50': float(percentiles[2]),
                'p75': float(percentiles[3]),
                'p90': float(percentiles[4])
            },
            'skewness': float(stats.skew(errors)),
            'kurtosis': float(stats.kurtosis(errors))
        }


class PhaseDetector:
    def __init__(self):
        self.phase_definitions = {
            'drying': {'temp_range': (273.15, 473.15), 'description': '干燥阶段'},
            'heating': {'temp_range': (473.15, 873.15), 'description': '升温阶段'},
            'decomposition': {'temp_range': (873.15, 1073.15), 'description': '分解阶段'},
            'high_heating': {'temp_range': (1073.15, 1473.15), 'description': '高温阶段'},
            'soaking': {'temp_range': (1473.15, 1800.0), 'description': '保温阶段'},
            'cooling': {'temp_range': (273.15, 1500.0), 'description': '冷却阶段'}
        }

    def detect_phases(self, time: np.ndarray,
                       temperature: np.ndarray) -> List[Dict]:
        phases = []
        current_phase = None

        heating_rate = np.gradient(temperature, time)

        for i in range(len(time)):
            temp = temperature[i]
            rate = heating_rate[i]

            if rate < -0.005:
                phase_type = 'cooling'
            else:
                phase_type = None
                for name, definition in self.phase_definitions.items():
                    if name == 'cooling':
                        continue
                    t_min, t_max = definition['temp_range']
                    if t_min <= temp < t_max:
                        phase_type = name
                        break

            if phase_type != current_phase:
                if current_phase is not None and phases:
                    phases[-1]['end_time'] = time[i]
                    phases[-1]['duration'] = time[i] - phases[-1]['start_time']

                if phase_type is not None:
                    phases.append({
                        'phase_name': phase_type,
                        'start_time': time[i],
                        'end_time': time[i],
                        'duration': 0.0,
                        'description': self.phase_definitions[phase_type]['description']
                    })
                current_phase = phase_type

        if phases:
            phases[-1]['end_time'] = time[-1]
            phases[-1]['duration'] = time[-1] - phases[-1]['start_time']

        return phases


class SimulationComparator:
    def __init__(self):
        self.aligner = DataAligner()
        self.metrics_calculator = MetricsCalculator()
        self.phase_detector = PhaseDetector()

    def compare_temperature(self, sim_results: Dict,
                             real_data: Dict) -> Dict:
        sim_time = sim_results.get('time', np.array([]))
        sim_temp = sim_results.get('kiln_temperature', np.array([]))

        real_time = real_data.get('time', np.array([]))
        real_temp = real_data.get('temperature', np.array([]))

        if len(sim_time) == 0 or len(real_time) == 0:
            return {'error': 'Insufficient data'}

        common_time, sim_aligned, real_aligned = self.aligner.align_time_series(
            sim_time, sim_temp, real_time, real_temp
        )

        time_shift = self.aligner.find_time_shift(sim_aligned, real_aligned)

        overall_metrics = self.metrics_calculator.calculate_metrics(
            sim_aligned, real_aligned
        )

        sim_phases = self.phase_detector.detect_phases(sim_time, sim_temp)
        real_phases = self.phase_detector.detect_phases(real_time, real_temp)

        phase_analysis = []
        for i, (sim_phase, real_phase) in enumerate(zip(sim_phases, real_phases)):
            if i >= len(sim_phases) or i >= len(real_phases):
                break

            phase_mask = (common_time >= sim_phase['start_time']) & \
                         (common_time <= sim_phase['end_time'])

            if np.sum(phase_mask) > 1:
                phase_metrics = self.metrics_calculator.calculate_metrics(
                    sim_aligned[phase_mask], real_aligned[phase_mask]
                )
                phase_analysis.append(PhaseAnalysis(
                    phase_name=sim_phase['phase_name'],
                    start_time=sim_phase['start_time'],
                    end_time=sim_phase['end_time'],
                    metrics=phase_metrics,
                    time_shift=float(time_shift) * (common_time[1] - common_time[0]),
                    amplitude_ratio=float(
                        np.mean(sim_aligned[phase_mask]) / (np.mean(real_aligned[phase_mask]) + 1e-8)
                    )
                ))

        errors = sim_aligned - real_aligned
        error_distribution = self.metrics_calculator.calculate_error_distribution(errors)

        result = {
            'common_time_range': [float(common_time[0]), float(common_time[-1])],
            'num_points': len(common_time),
            'overall_metrics': {
                'mae': overall_metrics.mae,
                'rmse': overall_metrics.rmse,
                'mape': overall_metrics.mape,
                'r2': overall_metrics.r2,
                'correlation': overall_metrics.correlation,
                'max_error': overall_metrics.max_error,
                'bias': overall_metrics.bias
            },
            'time_shift_samples': int(time_shift),
            'time_shift_seconds': float(time_shift * (common_time[1] - common_time[0])),
            'error_distribution': error_distribution,
            'phase_analysis': [
                {
                    'phase_name': pa.phase_name,
                    'start_time': pa.start_time,
                    'end_time': pa.end_time,
                    'metrics': {
                        'mae': pa.metrics.mae,
                        'rmse': pa.metrics.rmse,
                        'mape': pa.metrics.mape,
                        'r2': pa.metrics.r2
                    },
                    'time_shift': pa.time_shift,
                    'amplitude_ratio': pa.amplitude_ratio
                }
                for pa in phase_analysis
            ],
            'simulation_phases': [
                {
                    'phase_name': p['phase_name'],
                    'description': p['description'],
                    'start_time': p['start_time'],
                    'end_time': p['end_time'],
                    'duration': p['duration']
                }
                for p in sim_phases
            ],
            'real_phases': [
                {
                    'phase_name': p['phase_name'],
                    'description': p['description'],
                    'start_time': p['start_time'],
                    'end_time': p['end_time'],
                    'duration': p['duration']
                }
                for p in real_phases
            ]
        }

        return result

    def compare_humidity(self, sim_results: Dict, real_data: Dict) -> Dict:
        sim_time = sim_results.get('time', np.array([]))
        sim_humidity = sim_results.get('relative_humidity', np.array([]))

        real_time = real_data.get('time', np.array([]))
        real_humidity = real_data.get('humidity', np.array([]))

        if len(sim_humidity) == 0 or len(real_humidity) == 0:
            return {'error': 'Humidity data not available'}

        common_time, sim_aligned, real_aligned = self.aligner.align_time_series(
            sim_time, sim_humidity, real_time, real_humidity
        )

        metrics = self.metrics_calculator.calculate_metrics(sim_aligned, real_aligned)

        return {
            'overall_metrics': {
                'mae': metrics.mae,
                'rmse': metrics.rmse,
                'mape': metrics.mape,
                'r2': metrics.r2,
                'correlation': metrics.correlation
            }
        }

    def generate_comparison_report(self, sim_results: Dict,
                                     real_data: Dict) -> Dict:
        temp_comparison = self.compare_temperature(sim_results, real_data)
        humidity_comparison = self.compare_humidity(sim_results, real_data)

        overall_quality = self._assess_quality(temp_comparison)

        recommendations = self._generate_recommendations(temp_comparison)

        report = {
            'temperature_comparison': temp_comparison,
            'humidity_comparison': humidity_comparison,
            'overall_quality': overall_quality,
            'recommendations': recommendations,
            'summary_statistics': self._generate_summary(temp_comparison)
        }

        return report

    def _assess_quality(self, temp_comparison: Dict) -> Dict:
        metrics = temp_comparison.get('overall_metrics', {})
        rmse = metrics.get('rmse', 999)
        r2 = metrics.get('r2', 0)
        mape = metrics.get('mape', 100)

        if rmse < 50 and r2 > 0.95 and mape < 5:
            quality_level = 'excellent'
        elif rmse < 100 and r2 > 0.90 and mape < 10:
            quality_level = 'good'
        elif rmse < 200 and r2 > 0.80 and mape < 20:
            quality_level = 'acceptable'
        else:
            quality_level = 'needs_improvement'

        return {
            'quality_level': quality_level,
            'score': float(max(0, 100 - rmse / 2 - (1 - r2) * 50 - mape / 2))
        }

    def _generate_recommendations(self, temp_comparison: Dict) -> List[str]:
        recommendations = []
        metrics = temp_comparison.get('overall_metrics', {})

        if abs(metrics.get('bias', 0)) > 20:
            recommendations.append("仿真存在系统性偏差，建议检查热传导参数校准")

        if metrics.get('rmse', 0) > 100:
            recommendations.append("温度预测误差较大，建议优化温度曲线参数")

        time_shift = temp_comparison.get('time_shift_seconds', 0)
        if abs(time_shift) > 3600:
            recommendations.append("仿真与实测时间偏差较大，建议检查升温速率设置")

        if metrics.get('r2', 0) < 0.8:
            recommendations.append("相关性较低，建议检查材料热物性参数")

        if not recommendations:
            recommendations.append("仿真与实测吻合度良好，无需特别调整")

        return recommendations

    def _generate_summary(self, temp_comparison: Dict) -> Dict:
        metrics = temp_comparison.get('overall_metrics', {})
        return {
            'accuracy_level': 'high' if metrics.get('rmse', 999) < 50 else 'low',
            'precision_level': 'high' if metrics.get('r2', 0) > 0.95 else 'low',
            'bias_level': 'low' if abs(metrics.get('bias', 0)) < 10 else 'high',
            'total_deviation': metrics.get('rmse', 0)
        }

    def export_report(self, report: Dict, filepath: str):
        import numpy as np

        def numpy_encoder(obj):
            if isinstance(obj, np.integer):
                return int(obj)
            elif isinstance(obj, np.floating):
                return float(obj)
            elif isinstance(obj, np.ndarray):
                return obj.tolist()
            raise TypeError(f"Object of type {obj.__class__.__name__} is not JSON serializable")

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False, default=numpy_encoder)

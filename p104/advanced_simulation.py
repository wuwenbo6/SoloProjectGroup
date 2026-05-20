import numpy as np
import h5py
import json
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime
from collections import defaultdict
import warnings

from bamboo_data import BambooDataCollector, BambooStrip
from tension_simulation import SimulationResult, WeaveConfig


@dataclass
class PatternConfig:
    pattern_type: str
    warp_start: int
    warp_end: int
    weft_start: int
    weft_end: int
    base_tension: float
    friction_coefficient: float = 0.3


@dataclass
class AnomalyRecord:
    time: float
    node: int
    anomaly_type: str
    severity: str
    value: float
    threshold: float
    description: str


@dataclass
class TestDataRecord:
    time: float
    node: int
    measured_tension: float
    measurement_type: str
    confidence: float = 1.0


@dataclass
class ComparisonMetrics:
    mae: float
    rmse: float
    correlation: float
    max_error: float
    mean_error_ratio: float
    pattern_accuracy: Dict[str, float] = field(default_factory=dict)


class MultiPatternSimulator:
    def __init__(self, data_collector: BambooDataCollector):
        self.data_collector = data_collector
        self.pattern_configs: List[PatternConfig] = []
        self.global_config = WeaveConfig()
        self._anomaly_records: List[AnomalyRecord] = []
        self._anomaly_thresholds = {
            'max_tension': 300.0,
            'tension_change_rate': 50.0,
            'uniformity_std': 30.0,
            'min_tension': 10.0
        }

    def add_pattern(self, pattern_config: PatternConfig):
        self.pattern_configs.append(pattern_config)

    def set_global_config(self, **kwargs):
        for key, value in kwargs.items():
            if hasattr(self.global_config, key):
                setattr(self.global_config, key, value)

    def set_anomaly_thresholds(self, **kwargs):
        for key, value in kwargs.items():
            if key in self._anomaly_thresholds:
                self._anomaly_thresholds[key] = value

    def _get_pattern_at_position(self, warp_idx: int, weft_idx: int) -> Optional[PatternConfig]:
        for pattern in self.pattern_configs:
            if (pattern.warp_start <= warp_idx < pattern.warp_end and
                pattern.weft_start <= weft_idx < pattern.weft_end):
                return pattern
        return None

    def _check_anomalies(self, time: float, tension_data: np.ndarray, 
                         prev_tension: Optional[np.ndarray] = None):
        num_nodes = tension_data.shape[1]
        mean_tension = np.mean(tension_data)
        std_tension = np.std(tension_data)

        for node in range(num_nodes):
            current_tension = tension_data[-1, node] if len(tension_data.shape) > 1 else tension_data[node]

            if current_tension > self._anomaly_thresholds['max_tension']:
                self._anomaly_records.append(AnomalyRecord(
                    time=time, node=node, anomaly_type='OVERTENSION',
                    severity='HIGH', value=float(current_tension),
                    threshold=self._anomaly_thresholds['max_tension'],
                    description=f'张力超过上限: {current_tension:.1f}N > {self._anomaly_thresholds["max_tension"]}N'
                ))

            if current_tension < self._anomaly_thresholds['min_tension']:
                self._anomaly_records.append(AnomalyRecord(
                    time=time, node=node, anomaly_type='UNDERTENSION',
                    severity='MEDIUM', value=float(current_tension),
                    threshold=self._anomaly_thresholds['min_tension'],
                    description=f'张力低于下限: {current_tension:.1f}N < {self._anomaly_thresholds["min_tension"]}N'
                ))

            if prev_tension is not None and len(prev_tension) > 0:
                prev_val = prev_tension[-1, node] if len(prev_tension.shape) > 1 else prev_tension[node]
                change_rate = abs(current_tension - prev_val)
                if change_rate > self._anomaly_thresholds['tension_change_rate']:
                    self._anomaly_records.append(AnomalyRecord(
                        time=time, node=node, anomaly_type='RAPID_CHANGE',
                        severity='MEDIUM', value=float(change_rate),
                        threshold=self._anomaly_thresholds['tension_change_rate'],
                        description=f'张力变化过快: {change_rate:.1f}N/步'
                    ))

        if std_tension > self._anomaly_thresholds['uniformity_std']:
            self._anomaly_records.append(AnomalyRecord(
                time=time, node=-1, anomaly_type='POOR_UNIFORMITY',
                severity='LOW', value=float(std_tension),
                threshold=self._anomaly_thresholds['uniformity_std'],
                description=f'张力均匀性差，标准差: {std_tension:.1f}N'
            ))

    def simulate_multi_pattern(self, num_nodes: int = 20) -> SimulationResult:
        if not self.pattern_configs:
            raise ValueError("请先添加编织方式配置")

        time_steps = self.global_config.time_steps
        time = np.linspace(0, self.global_config.simulation_time, time_steps)
        warp_tension = np.zeros((time_steps, num_nodes))
        weft_tension = np.zeros((time_steps, num_nodes))
        contact_tension = np.zeros((time_steps, num_nodes))

        pattern_tensions = np.zeros((len(self.pattern_configs), time_steps, num_nodes))

        for t_idx, t in enumerate(time):
            tension_factor = 0.5 * (1 + 0.5 * np.sin(np.pi * t / self.global_config.simulation_time))

            for p_idx, pattern in enumerate(self.pattern_configs):
                pattern_effect = {
                    'plain': 1.0,
                    'twill': 0.85,
                    'satin': 0.75,
                    'lattice': 0.9,
                    'herringbone': 0.95,
                    'jacquard': 1.1
                }.get(pattern.pattern_type, 1.0)

                for node in range(num_nodes):
                    node_pattern = self._get_pattern_at_position(node, node)
                    if node_pattern == pattern:
                        base_t = pattern.base_tension * pattern_effect * tension_factor
                        warp_tension[t_idx, node] += base_t
                        weft_tension[t_idx, node] += base_t * 0.9
                        contact_tension[t_idx, node] += base_t * 0.1 * pattern.friction_coefficient

            if t_idx > 0:
                self._check_anomalies(t, warp_tension, warp_tension[:t_idx])

        total_tension = warp_tension + weft_tension + contact_tension
        strain = total_tension / 1000.0
        displacement = strain * 0.1

        metadata = {
            'simulation_type': 'multi_pattern',
            'timestamp': datetime.now().isoformat(),
            'num_patterns': len(self.pattern_configs),
            'pattern_types': [p.pattern_type for p in self.pattern_configs],
            'anomaly_count': len(self._anomaly_records)
        }

        return SimulationResult(
            time=time,
            warp_tension=warp_tension,
            weft_tension=weft_tension,
            contact_tension=contact_tension,
            total_tension=total_tension,
            strain=strain,
            displacement=displacement,
            config={},
            metadata=metadata
        )

    def get_anomaly_summary(self) -> Dict[str, Any]:
        if not self._anomaly_records:
            return {'total_anomalies': 0, 'by_type': {}, 'by_severity': {}, 'anomalies': []}

        by_type = defaultdict(int)
        by_severity = defaultdict(int)
        for anomaly in self._anomaly_records:
            by_type[anomaly.anomaly_type] += 1
            by_severity[anomaly.severity] += 1

        return {
            'total_anomalies': len(self._anomaly_records),
            'by_type': dict(by_type),
            'by_severity': dict(by_severity),
            'anomalies': [
                {
                    'time': a.time,
                    'node': a.node,
                    'type': a.anomaly_type,
                    'severity': a.severity,
                    'description': a.description
                }
                for a in self._anomaly_records
            ]
        }

    def export_anomalies_to_json(self, filepath: str):
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(self.get_anomaly_summary(), f, indent=2, ensure_ascii=False)


class TensionComparator:
    def __init__(self):
        self.test_data: List[TestDataRecord] = []
        self.simulation_result: Optional[SimulationResult] = None

    def load_test_data_from_csv(self, filepath: str):
        try:
            data = np.genfromtxt(filepath, delimiter=',', skip_header=1)
            for row in data:
                if len(row) >= 4:
                    record = TestDataRecord(
                        time=float(row[0]),
                        node=int(row[1]),
                        measured_tension=float(row[2]),
                        measurement_type=str(row[3]),
                        confidence=float(row[4]) if len(row) > 4 else 1.0
                    )
                    self.test_data.append(record)
        except Exception as e:
            raise ValueError(f"加载测试数据失败: {e}")

    def load_test_data_from_json(self, filepath: str):
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        for item in data:
            self.test_data.append(TestDataRecord(**item))

    def generate_sample_test_data(self, sim_result: SimulationResult, noise_level: float = 5.0):
        self.simulation_result = sim_result
        self.test_data = []
        
        for t_idx, time_val in enumerate(sim_result.time):
            for node in range(min(10, sim_result.total_tension.shape[1])):
                true_tension = sim_result.total_tension[t_idx, node]
                noise = np.random.normal(0, noise_level)
                measured = true_tension + noise
                
                self.test_data.append(TestDataRecord(
                    time=float(time_val),
                    node=node,
                    measured_tension=float(max(0, measured)),
                    measurement_type='warp',
                    confidence=0.95
                ))

    def set_simulation_result(self, result: SimulationResult):
        self.simulation_result = result

    def compare(self) -> ComparisonMetrics:
        if not self.test_data or self.simulation_result is None:
            raise ValueError("请先加载测试数据和仿真结果")

        sim_times = self.simulation_result.time
        sim_tension = self.simulation_result.total_tension

        measured_values = []
        simulated_values = []
        confidences = []

        for record in self.test_data:
            t_idx = np.argmin(np.abs(sim_times - record.time))
            node = min(record.node, sim_tension.shape[1] - 1)
            
            measured_values.append(record.measured_tension)
            simulated_values.append(sim_tension[t_idx, node])
            confidences.append(record.confidence)

        measured = np.array(measured_values)
        simulated = np.array(simulated_values)
        conf = np.array(confidences)

        mae = np.average(np.abs(measured - simulated), weights=conf)
        rmse = np.sqrt(np.average((measured - simulated) ** 2, weights=conf))
        max_error = np.max(np.abs(measured - simulated))
        mean_error_ratio = np.mean(np.abs(measured - simulated) / (measured + 1e-6)) * 100

        if len(measured) > 1:
            correlation = np.corrcoef(measured, simulated)[0, 1]
        else:
            correlation = 1.0 if abs(measured[0] - simulated[0]) < 1 else 0.0

        return ComparisonMetrics(
            mae=float(mae),
            rmse=float(rmse),
            correlation=float(correlation),
            max_error=float(max_error),
            mean_error_ratio=float(mean_error_ratio)
        )

    def get_comparison_data(self) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        if not self.test_data or self.simulation_result is None:
            raise ValueError("请先加载测试数据和仿真结果")

        sim_times = self.simulation_result.time
        sim_tension = self.simulation_result.total_tension

        measured_values = []
        simulated_values = []
        times = []

        for record in self.test_data:
            t_idx = np.argmin(np.abs(sim_times - record.time))
            node = min(record.node, sim_tension.shape[1] - 1)
            
            measured_values.append(record.measured_tension)
            simulated_values.append(sim_tension[t_idx, node])
            times.append(record.time)

        return np.array(times), np.array(measured_values), np.array(simulated_values)

    def export_comparison_report(self, filepath: str):
        metrics = self.compare()
        
        report = {
            'comparison_metrics': {
                'MAE': metrics.mae,
                'RMSE': metrics.rmse,
                'correlation': metrics.correlation,
                'max_error': metrics.max_error,
                'mean_error_ratio_percent': metrics.mean_error_ratio
            },
            'test_data_points': len(self.test_data),
            'quality_assessment': self._assess_quality(metrics),
            'recommendations': self._generate_recommendations(metrics)
        }

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)

        return report

    def _assess_quality(self, metrics: ComparisonMetrics) -> str:
        if metrics.rmse < 10 and metrics.correlation > 0.9:
            return 'EXCELLENT'
        elif metrics.rmse < 20 and metrics.correlation > 0.75:
            return 'GOOD'
        elif metrics.rmse < 35 and metrics.correlation > 0.6:
            return 'FAIR'
        else:
            return 'POOR'

    def _generate_recommendations(self, metrics: ComparisonMetrics) -> List[str]:
        recommendations = []
        
        if metrics.rmse > 20:
            recommendations.append("建议调整材料参数，杨氏模量可能需要校准")
        if metrics.correlation < 0.7:
            recommendations.append("建议检查摩擦系数和编织方式参数设置")
        if metrics.mean_error_ratio > 15:
            recommendations.append("建议增加边界条件验证，检查约束设置")
        if metrics.max_error > 40:
            recommendations.append("存在较大误差点，建议检查异常节点的网格质量")
        
        if not recommendations:
            recommendations.append("仿真结果与测试数据匹配良好，可以用于工艺优化")
        
        return recommendations


class OptimizedNumericalSolver:
    def __init__(self, use_cache: bool = True):
        self.use_cache = use_cache
        self._stiffness_cache = {}
        self._tension_cache = {}

    @staticmethod
    def vectorized_tension_calculation(strain: np.ndarray, 
                                         youngs_modulus: float,
                                         cross_section_area: np.ndarray) -> np.ndarray:
        stress = youngs_modulus * strain
        tension = stress * cross_section_area
        return tension

    @staticmethod
    def batch_tension_simulation(base_tensions: np.ndarray,
                                  num_nodes: int = 20,
                                  num_time_steps: int = 100) -> np.ndarray:
        time = np.linspace(0, 1, num_time_steps)
        tension_factor = 0.5 * (1 + 0.5 * np.sin(np.pi * time))
        
        result = np.zeros((len(base_tensions), num_time_steps, num_nodes))
        
        for i, bt in enumerate(base_tensions):
            for node in range(num_nodes):
                result[i, :, node] = bt * tension_factor * (1 + 0.02 * np.random.randn())
        
        return result

    def cached_stiffness_matrix(self, length: float, ea: float, key: str) -> np.ndarray:
        if not self.use_cache or key not in self._stiffness_cache:
            k = np.array([
                [ea/length, -ea/length],
                [-ea/length, ea/length]
            ])
            self._stiffness_cache[key] = k
        return self._stiffness_cache[key]

    @staticmethod
    def vectorized_contact_calculation(normal_forces: np.ndarray,
                                        friction_coeff: float,
                                        contact_area: float) -> np.ndarray:
        return normal_forces * friction_coeff / contact_area

    @staticmethod
    def parallel_tension_analysis(tension_data: np.ndarray,
                                   num_processes: int = 4) -> Dict[str, np.ndarray]:
        mean_tension = np.mean(tension_data, axis=(1, 2))
        std_tension = np.std(tension_data, axis=(1, 2))
        max_tension = np.max(tension_data, axis=(1, 2))
        min_tension = np.min(tension_data, axis=(1, 2))
        
        return {
            'mean': mean_tension,
            'std': std_tension,
            'max': max_tension,
            'min': min_tension
        }

    @staticmethod
    def memory_efficient_simulation(num_samples: int = 1000,
                                     num_nodes: int = 50,
                                     num_time_steps: int = 200,
                                     batch_size: int = 100) -> np.ndarray:
        result = np.zeros((num_samples, num_time_steps, num_nodes))
        
        for start in range(0, num_samples, batch_size):
            end = min(start + batch_size, num_samples)
            batch_base = np.random.uniform(50, 200, end - start)
            result[start:end] = OptimizedNumericalSolver.batch_tension_simulation(
                batch_base, num_nodes, num_time_steps
            )
        
        return result

    def clear_cache(self):
        self._stiffness_cache.clear()
        self._tension_cache.clear()

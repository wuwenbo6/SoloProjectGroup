import numpy as np
from typing import Dict, List, Tuple, Optional, Callable, Any
from dataclasses import dataclass, field
from collections import OrderedDict
import warnings
from simulation import CeramicFiringSimulation, FiringConfig, FiringState
from numerics import ThermalCalculation


@dataclass
class Kiln:
    kiln_id: str
    config: FiringConfig
    max_power: float = 50.0
    efficiency: float = 0.85
    current_load: float = 0.0
    simulation: Optional[CeramicFiringSimulation] = None
    results: Optional[Dict[str, np.ndarray]] = None


@dataclass
class AnomalyAlert:
    timestamp: float
    alert_type: str
    severity: str
    message: str
    value: float
    threshold: float


@dataclass
class ComparisonMetrics:
    mae: float
    rmse: float
    max_error: float
    correlation: float
    mean_bias: float
    profile_similarity: float


class KilnCoordinator:
    def __init__(self, total_power_capacity: float = 200.0):
        self.kilns: Dict[str, Kiln] = OrderedDict()
        self.total_power_capacity = total_power_capacity
        self.power_allocation: Dict[str, float] = {}
        self.coordination_history: List[Dict] = []

    def add_kiln(self, kiln_id: str, config: FiringConfig,
                  max_power: float = 50.0, efficiency: float = 0.85):
        kiln = Kiln(
            kiln_id=kiln_id,
            config=config,
            max_power=max_power,
            efficiency=efficiency
        )
        self.kilns[kiln_id] = kiln
        return kiln

    def remove_kiln(self, kiln_id: str):
        if kiln_id in self.kilns:
            del self.kilns[kiln_id]

    def optimize_power_allocation(self, priorities: Optional[Dict[str, float]] = None) -> Dict[str, float]:
        if priorities is None:
            priorities = {kid: 1.0 for kid in self.kilns.keys()}

        total_priority = sum(priorities.get(kid, 1.0) for kid in self.kilns.keys())
        total_max_power = sum(k.max_power for k in self.kilns.values())

        if total_max_power <= self.total_power_capacity:
            for kid, kiln in self.kilns.items():
                self.power_allocation[kid] = kiln.max_power
        else:
            for kid, kiln in self.kilns.items():
                priority = priorities.get(kid, 1.0)
                allocated = self.total_power_capacity * priority / total_priority
                self.power_allocation[kid] = min(allocated, kiln.max_power)

        self.coordination_history.append({
            'timestamp': getattr(self, '_current_time', 0.0),
            'allocation': self.power_allocation.copy()
        })

        return self.power_allocation

    def run_coordinated_simulation(self, dt: float = 1.0,
                                    priorities: Optional[Dict[str, float]] = None) -> Dict[str, Dict]:
        self.optimize_power_allocation(priorities)

        all_results = {}
        for kid, kiln in self.kilns.items():
            allocated_power = self.power_allocation.get(kid, kiln.max_power)
            power_ratio = allocated_power / kiln.max_power

            adjusted_config = FiringConfig(
                initial_temp=kiln.config.initial_temp,
                target_temp=kiln.config.target_temp,
                heating_rate=kiln.config.heating_rate * power_ratio,
                holding_time=kiln.config.holding_time,
                cooling_rate=kiln.config.cooling_rate,
                total_time=kiln.config.total_time,
                clay_type=kiln.config.clay_type,
                atmosphere=kiln.config.atmosphere
            )

            simulation = CeramicFiringSimulation(adjusted_config)
            kiln.simulation = simulation
            kiln.results = simulation.run_simulation(dt=dt)
            all_results[kid] = kiln.results

        return all_results

    def get_total_energy_consumption(self) -> Dict[str, Any]:
        total_energy = 0.0
        breakdown = {}

        for kid, kiln in self.kilns.items():
            if kiln.results is not None:
                temp = kiln.results['temperature']
                dt = kiln.results['time'][1] - kiln.results['time'][0]
                energy = ThermalCalculation.calculate_energy_consumption(temp, dt)
                actual_energy = energy / kiln.efficiency
                breakdown[kid] = actual_energy
                total_energy += actual_energy

        return {
            'total_kwh': total_energy / 3600.0,
            'breakdown_kwh': {k: v / 3600.0 for k, v in breakdown.items()}
        }

    def get_load_profile(self) -> Tuple[np.ndarray, Dict[str, np.ndarray]]:
        if not self.kilns:
            return np.array([]), {}

        first_kiln = next(iter(self.kilns.values()))
        if first_kiln.results is None:
            return np.array([]), {}

        time = first_kiln.results['time']
        profiles = {}
        total_profile = np.zeros_like(time)

        for kid, kiln in self.kilns.items():
            if kiln.results is not None:
                temp = kiln.results['temperature']
                dT_dt = np.gradient(temp, time)
                load = kiln.max_power * np.clip(dT_dt / kiln.config.heating_rate * 60, 0, 1)
                profiles[kid] = load
                total_profile += load

        return time, {'individual': profiles, 'total': total_profile}


class AnomalyDetector:
    def __init__(self, custom_thresholds: Optional[Dict[str, Tuple[float, float]]] = None):
        self.thresholds = {
            'temp_rise_rate': (0, 10.0),
            'temp_drop_rate': (-10.0, 0),
            'temp_deviation': (-50.0, 50.0),
            'humidity_rate': (-5.0, 5.0),
            'oxygen_rate': (-2.0, 2.0),
            'shrinkage_rate': (-0.5, 0.5)
        }
        if custom_thresholds:
            self.thresholds.update(custom_thresholds)

        self.alerts: List[AnomalyAlert] = []
        self.alert_history: List[List[AnomalyAlert]] = []

    def detect_temperature_anomalies(self, time: np.ndarray, temperature: np.ndarray,
                                      reference_profile: Optional[np.ndarray] = None) -> List[AnomalyAlert]:
        alerts = []
        dt = time[1] - time[0]
        temp_rate = np.gradient(temperature, time) * 60

        for i, (t, rate) in enumerate(zip(time, temp_rate)):
            if rate > self.thresholds['temp_rise_rate'][1]:
                alerts.append(AnomalyAlert(
                    timestamp=t,
                    alert_type='TEMPERATURE_RUSH_RISE',
                    severity='HIGH',
                    message=f'窑温骤升，速率{rate:.1f}°C/min超过阈值',
                    value=rate,
                    threshold=self.thresholds['temp_rise_rate'][1]
                ))
            elif rate < self.thresholds['temp_drop_rate'][0]:
                alerts.append(AnomalyAlert(
                    timestamp=t,
                    alert_type='TEMPERATURE_RUSH_DROP',
                    severity='HIGH',
                    message=f'窑温骤降，速率{rate:.1f}°C/min低于阈值',
                    value=rate,
                    threshold=self.thresholds['temp_drop_rate'][0]
                ))

        if reference_profile is not None:
            deviation = temperature - reference_profile
            for i, (t, dev) in enumerate(zip(time, deviation)):
                if dev > self.thresholds['temp_deviation'][1]:
                    alerts.append(AnomalyAlert(
                        timestamp=t,
                        alert_type='TEMPERATURE_OVERSHOOT',
                        severity='MEDIUM',
                        message=f'温度偏高{dev:.1f}°C，超过偏差阈值',
                        value=dev,
                        threshold=self.thresholds['temp_deviation'][1]
                    ))
                elif dev < self.thresholds['temp_deviation'][0]:
                    alerts.append(AnomalyAlert(
                        timestamp=t,
                        alert_type='TEMPERATURE_UNDERSHOOT',
                        severity='MEDIUM',
                        message=f'温度偏低{abs(dev):.1f}°C，低于偏差阈值',
                        value=dev,
                        threshold=self.thresholds['temp_deviation'][0]
                    ))

        return alerts

    def detect_parameter_anomalies(self, time: np.ndarray, humidity: np.ndarray,
                                    oxygen: np.ndarray, shrinkage: np.ndarray) -> List[AnomalyAlert]:
        alerts = []

        humidity_rate = np.gradient(humidity, time) * 60
        oxygen_rate = np.gradient(oxygen, time) * 60
        shrinkage_rate = np.gradient(shrinkage, time) * 60

        for i, t in enumerate(time):
            if abs(humidity_rate[i]) > self.thresholds['humidity_rate'][1]:
                alerts.append(AnomalyAlert(
                    timestamp=t,
                    alert_type='HUMIDITY_ABNORMAL_CHANGE',
                    severity='LOW',
                    message=f'湿度变化率{humidity_rate[i]:.2f}%/min异常',
                    value=humidity_rate[i],
                    threshold=self.thresholds['humidity_rate'][1]
                ))

            if abs(oxygen_rate[i]) > self.thresholds['oxygen_rate'][1]:
                alerts.append(AnomalyAlert(
                    timestamp=t,
                    alert_type='OXYGEN_ABNORMAL_CHANGE',
                    severity='MEDIUM',
                    message=f'氧气浓度变化率{oxygen_rate[i]:.2f}%/min异常',
                    value=oxygen_rate[i],
                    threshold=self.thresholds['oxygen_rate'][1]
                ))

            if shrinkage_rate[i] < self.thresholds['shrinkage_rate'][0]:
                alerts.append(AnomalyAlert(
                    timestamp=t,
                    alert_type='SHRINKAGE_ABNORMAL',
                    severity='HIGH',
                    message=f'收缩率变化异常，可能存在坯体开裂风险',
                    value=shrinkage_rate[i],
                    threshold=self.thresholds['shrinkage_rate'][0]
                ))

        return alerts

    def detect_all_anomalies(self, results: Dict[str, np.ndarray],
                              reference: Optional[Dict[str, np.ndarray]] = None) -> List[AnomalyAlert]:
        self.alerts = []
        time = results['time']
        temp = results['temperature']

        ref_temp = reference['temperature'] if reference is not None else None
        self.alerts.extend(self.detect_temperature_anomalies(time, temp, ref_temp))

        self.alerts.extend(self.detect_parameter_anomalies(
            time, results['humidity'], results['oxygen'], results['shrinkage']
        ))

        self.alert_history.append(self.alerts.copy())
        return self.alerts

    def get_alert_summary(self) -> Dict[str, Any]:
        if not self.alerts:
            return {'total': 0, 'by_severity': {}, 'by_type': {}}

        by_severity = {}
        by_type = {}
        for alert in self.alerts:
            by_severity[alert.severity] = by_severity.get(alert.severity, 0) + 1
            by_type[alert.alert_type] = by_type.get(alert.alert_type, 0) + 1

        return {
            'total': len(self.alerts),
            'by_severity': by_severity,
            'by_type': by_type,
            'first_alert_time': min(a.timestamp for a in self.alerts) if self.alerts else None,
            'has_high_severity': any(a.severity == 'HIGH' for a in self.alerts)
        }


class SimulationComparator:
    def __init__(self, time_interpolation: bool = True):
        self.time_interpolation = time_interpolation
        self.comparison_results: Dict[str, Any] = {}

    def _align_time_series(self, sim_time: np.ndarray, sim_data: np.ndarray,
                            real_time: np.ndarray, real_data: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        if not self.time_interpolation:
            min_len = min(len(sim_data), len(real_data))
            return sim_data[:min_len], real_data[:min_len]

        common_time = np.union1d(sim_time, real_time)
        from scipy.interpolate import interp1d

        sim_interp = interp1d(sim_time, sim_data, kind='linear', fill_value='extrapolate')
        real_interp = interp1d(real_time, real_data, kind='linear', fill_value='extrapolate')

        return sim_interp(common_time), real_interp(common_time)

    def calculate_metrics(self, sim_data: np.ndarray, real_data: np.ndarray) -> ComparisonMetrics:
        mae = np.mean(np.abs(sim_data - real_data))
        rmse = np.sqrt(np.mean((sim_data - real_data) ** 2))
        max_error = np.max(np.abs(sim_data - real_data))
        mean_bias = np.mean(sim_data - real_data)

        if np.std(sim_data) > 1e-6 and np.std(real_data) > 1e-6:
            correlation = np.corrcoef(sim_data, real_data)[0, 1]
        else:
            correlation = 1.0 if np.allclose(sim_data, real_data) else 0.0

        norm_sim = (sim_data - np.mean(sim_data)) / (np.std(sim_data) + 1e-6)
        norm_real = (real_data - np.mean(real_data)) / (np.std(real_data) + 1e-6)
        similarity = 1.0 / (1.0 + np.mean((norm_sim - norm_real) ** 2))

        return ComparisonMetrics(
            mae=mae,
            rmse=rmse,
            max_error=max_error,
            correlation=correlation,
            mean_bias=mean_bias,
            profile_similarity=similarity
        )

    def compare_profiles(self, simulation_results: Dict[str, np.ndarray],
                          real_data: Dict[str, np.ndarray]) -> Dict[str, ComparisonMetrics]:
        sim_time = simulation_results['time']
        real_time = real_data.get('time', sim_time)

        all_metrics = {}
        for key in ['temperature', 'humidity', 'oxygen', 'shrinkage']:
            if key in simulation_results and key in real_data:
                sim_aligned, real_aligned = self._align_time_series(
                    sim_time, simulation_results[key],
                    real_time, real_data[key]
                )
                all_metrics[key] = self.calculate_metrics(sim_aligned, real_aligned)

        self.comparison_results = all_metrics
        return all_metrics

    def generate_comparison_report(self) -> str:
        if not self.comparison_results:
            return "No comparison results available."

        report = ["=" * 60, "仿真与实际数据对比分析报告", "=" * 60, ""]

        for param, metrics in self.comparison_results.items():
            report.append(f"【{param.upper()}】")
            report.append(f"  平均绝对误差 (MAE): {metrics.mae:.4f}")
            report.append(f"  均方根误差 (RMSE): {metrics.rmse:.4f}")
            report.append(f"  最大误差: {metrics.max_error:.4f}")
            report.append(f"  相关系数: {metrics.correlation:.4f}")
            report.append(f"  平均偏差: {metrics.mean_bias:.4f}")
            report.append(f"  曲线相似度: {metrics.profile_similarity:.4f}")

            quality = "优秀" if metrics.profile_similarity > 0.9 else \
                      "良好" if metrics.profile_similarity > 0.7 else \
                      "一般" if metrics.profile_similarity > 0.5 else "较差"
            report.append(f"  拟合质量: {quality}")
            report.append("")

        report.append("=" * 60)
        overall_similarity = np.mean([m.profile_similarity for m in self.comparison_results.values()])
        report.append(f"整体拟合度: {overall_similarity:.4f}")
        report.append("=" * 60)

        return "\n".join(report)

    def suggest_corrections(self) -> List[str]:
        suggestions = []
        if 'temperature' in self.comparison_results:
            temp_metrics = self.comparison_results['temperature']
            if temp_metrics.mean_bias > 10.0:
                suggestions.append(f"建议降低升温速率 {temp_metrics.mean_bias / 10:.1f}%，仿真温度普遍偏高")
            elif temp_metrics.mean_bias < -10.0:
                suggestions.append(f"建议提高升温速率 {abs(temp_metrics.mean_bias) / 10:.1f}%，仿真温度普遍偏低")

        if 'shrinkage' in self.comparison_results:
            shrink_metrics = self.comparison_results['shrinkage']
            if abs(shrink_metrics.mean_bias) > 1.0:
                suggestions.append(f"建议调整烧结温度和保温时间，收缩率偏差 {shrink_metrics.mean_bias:.2f}%")

        if not suggestions:
            suggestions.append("仿真与实际数据吻合度良好，无需重大调整")

        return suggestions


class FastNumericalCalculator:
    def __init__(self, use_cache: bool = True, max_cache_size: int = 1000):
        self.use_cache = use_cache
        self._cache: OrderedDict = OrderedDict()
        self._max_cache_size = max_cache_size
        self._hit_count = 0
        self._miss_count = 0

    def _get_cache_key(self, name: str, *args, **kwargs) -> int:
        key_parts = [name]
        for arg in args:
            if isinstance(arg, np.ndarray):
                key_parts.append(hash(arg.tobytes()))
            else:
                key_parts.append(arg)
        for k, v in sorted(kwargs.items()):
            key_parts.append((k, v))
        return hash(tuple(key_parts))

    def _cached_call(self, func: Callable, name: str, *args, **kwargs) -> Any:
        if not self.use_cache:
            return func(*args, **kwargs)

        key = self._get_cache_key(name, *args, **kwargs)

        if key in self._cache:
            self._hit_count += 1
            self._cache.move_to_end(key)
            return self._cache[key]

        self._miss_count += 1
        result = func(*args, **kwargs)
        self._cache[key] = result

        if len(self._cache) > self._max_cache_size:
            self._cache.popitem(last=False)

        return result

    def fast_heat_transfer_1d(self, T: np.ndarray, alpha: float, dx: float, dt: float,
                               steps: int = 1) -> np.ndarray:
        def _calc(T_in):
            T_out = T_in.copy()
            for _ in range(steps):
                T_out[1:-1] += alpha * dt / (dx ** 2) * (
                    T_out[2:] - 2 * T_out[1:-1] + T_out[:-2]
                )
            return T_out

        return self._cached_call(_calc, 'heat_transfer', T, alpha, dx, dt, steps)

    def fast_gradient_vectorized(self, arr: np.ndarray, x: Optional[np.ndarray] = None) -> np.ndarray:
        def _calc(a, x_arr):
            if x_arr is None:
                return np.gradient(a)
            return np.gradient(a, x_arr)

        return self._cached_call(_calc, 'gradient', arr, x)

    def fast_rolling_mean(self, arr: np.ndarray, window: int) -> np.ndarray:
        def _calc(a, w):
            result = np.zeros_like(a, dtype=np.float64)
            cumsum = np.cumsum(np.insert(a, 0, 0))
            result[w - 1:] = (cumsum[w:] - cumsum[:-w]) / w
            for i in range(w - 1):
                result[i] = np.mean(a[:i + 1])
            return result

        return self._cached_call(_calc, 'rolling_mean', arr, window)

    def batch_simulation_evaluate(self, configs: List[FiringConfig],
                                   parallel: bool = False) -> List[Dict[str, np.ndarray]]:
        if parallel:
            try:
                from concurrent.futures import ProcessPoolExecutor, as_completed

                def _run_sim(cfg):
                    sim = CeramicFiringSimulation(cfg)
                    return sim.run_simulation()

                results = []
                with ProcessPoolExecutor() as executor:
                    future_to_cfg = {executor.submit(_run_sim, cfg): i for i, cfg in enumerate(configs)}
                    results = [None] * len(configs)
                    for future in as_completed(future_to_cfg):
                        idx = future_to_cfg[future]
                        results[idx] = future.result()
                    return results
            except ImportError:
                pass

        results = []
        for cfg in configs:
            sim = CeramicFiringSimulation(cfg)
            results.append(sim.run_simulation())
        return results

    def get_cache_stats(self) -> Dict[str, Any]:
        total = self._hit_count + self._miss_count
        hit_rate = self._hit_count / total if total > 0 else 0.0
        return {
            'cache_size': len(self._cache),
            'max_cache_size': self._max_cache_size,
            'hit_count': self._hit_count,
            'miss_count': self._miss_count,
            'hit_rate': hit_rate,
            'performance_gain': hit_rate * 0.5
        }

    def clear_cache(self):
        self._cache.clear()
        self._hit_count = 0
        self._miss_count = 0

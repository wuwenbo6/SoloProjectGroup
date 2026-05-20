import numpy as np
import json
from typing import Dict, List, Optional, Tuple, Callable
from dataclasses import dataclass, field
from enum import Enum
from collections import deque


class AnomalyLevel(Enum):
    INFO = 0
    WARNING = 1
    CRITICAL = 2
    FATAL = 3


@dataclass
class AnomalyEvent:
    time: float
    parameter: str
    level: AnomalyLevel
    message: str
    actual_value: float
    expected_range: Tuple[float, float]
    kiln_id: Optional[str] = None
    resolved: bool = False
    resolution_time: Optional[float] = None

    def to_dict(self) -> Dict:
        return {
            'time': float(self.time),
            'parameter': self.parameter,
            'level': self.level.name,
            'level_value': self.level.value,
            'message': self.message,
            'actual_value': float(self.actual_value),
            'expected_range': [float(self.expected_range[0]), float(self.expected_range[1])],
            'kiln_id': self.kiln_id,
            'resolved': self.resolved,
            'resolution_time': self.resolution_time
        }


@dataclass
class AnomalyThreshold:
    parameter: str
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    max_rate: Optional[float] = None
    warning_factor: float = 0.8
    critical_factor: float = 1.0
    persistence: int = 3

    def check_value(self, value: float, prev_value: float = None,
                     dt: float = None) -> Tuple[Optional[AnomalyLevel], str]:
        messages = []
        max_level = None

        def update_level(new_level):
            nonlocal max_level
            if max_level is None or new_level.value > max_level.value:
                max_level = new_level

        if self.max_value is not None:
            if value > self.max_value * self.critical_factor:
                update_level(AnomalyLevel.CRITICAL)
                messages.append(f"{self.parameter}超过临界值: {value:.2f} > {self.max_value:.2f}")
            elif value > self.max_value * self.warning_factor:
                update_level(AnomalyLevel.WARNING)
                messages.append(f"{self.parameter}接近临界值: {value:.2f}")

        if self.min_value is not None:
            if value < self.min_value / self.critical_factor:
                update_level(AnomalyLevel.CRITICAL)
                messages.append(f"{self.parameter}低于临界值: {value:.2f} < {self.min_value:.2f}")
            elif value < self.min_value / self.warning_factor:
                update_level(AnomalyLevel.WARNING)
                messages.append(f"{self.parameter}接近下限: {value:.2f}")

        if self.max_rate is not None and prev_value is not None and dt is not None and dt > 0:
            rate = abs(value - prev_value) / dt
            if rate > self.max_rate * self.critical_factor:
                update_level(AnomalyLevel.CRITICAL)
                messages.append(f"{self.parameter}变化速率过快: {rate:.2f}/s")
            elif rate > self.max_rate * self.warning_factor:
                update_level(AnomalyLevel.WARNING)
                messages.append(f"{self.parameter}变化速率偏快: {rate:.2f}/s")

        return max_level, "; ".join(messages)


class AnomalyDetector:
    def __init__(self):
        self.thresholds: Dict[str, AnomalyThreshold] = {}
        self.anomalies: List[AnomalyEvent] = []
        self._prev_values: Dict[str, float] = {}
        self._persistence_counters: Dict[str, int] = {}
        self._setup_default_thresholds()

    def _setup_default_thresholds(self):
        self.add_threshold(AnomalyThreshold(
            parameter='kiln_temperature',
            min_value=273.15,
            max_value=1800.0,
            max_rate=5.0 / 60.0,
            persistence=3
        ))
        self.add_threshold(AnomalyThreshold(
            parameter='body_temperature',
            min_value=273.15,
            max_value=1700.0,
            max_rate=3.0 / 60.0,
            persistence=5
        ))
        self.add_threshold(AnomalyThreshold(
            parameter='humidity',
            min_value=0.0,
            max_value=100.0,
            max_rate=10.0 / 60.0,
            persistence=3
        ))
        self.add_threshold(AnomalyThreshold(
            parameter='oxygen_content',
            min_value=0.0,
            max_value=25.0,
            max_rate=2.0 / 60.0,
            persistence=4
        ))
        self.add_threshold(AnomalyThreshold(
            parameter='temperature_gradient',
            max_value=50.0,
            max_rate=10.0 / 60.0,
            persistence=3
        ))
        self.add_threshold(AnomalyThreshold(
            parameter='water_remaining',
            min_value=0.0,
            max_value=1.0,
            persistence=2
        ))

    def add_threshold(self, threshold: AnomalyThreshold):
        self.thresholds[threshold.parameter] = threshold

    def detect(self, time: float, values: Dict[str, float],
                dt: float = 60.0, kiln_id: Optional[str] = None) -> List[AnomalyEvent]:
        current_anomalies = []

        for param, value in values.items():
            if param not in self.thresholds:
                continue

            threshold = self.thresholds[param]
            prev_value = self._prev_values.get(f"{kiln_id}_{param}")

            level, message = threshold.check_value(value, prev_value, dt)

            if level is not None:
                counter_key = f"{kiln_id}_{param}_{level.name}"
                self._persistence_counters[counter_key] = \
                    self._persistence_counters.get(counter_key, 0) + 1

                if self._persistence_counters[counter_key] >= threshold.persistence:
                    expected_min = threshold.min_value or float('-inf')
                    expected_max = threshold.max_value or float('inf')

                    anomaly = AnomalyEvent(
                        time=time,
                        parameter=param,
                        level=level,
                        message=message,
                        actual_value=value,
                        expected_range=(expected_min, expected_max),
                        kiln_id=kiln_id
                    )
                    current_anomalies.append(anomaly)
                    self.anomalies.append(anomaly)
            else:
                for lvl in ['WARNING', 'CRITICAL']:
                    counter_key = f"{kiln_id}_{param}_{lvl}"
                    if counter_key in self._persistence_counters:
                        self._persistence_counters[counter_key] = max(
                            0, self._persistence_counters[counter_key] - 1
                        )

            self._prev_values[f"{kiln_id}_{param}"] = value

        return current_anomalies

    def detect_from_results(self, results: Dict,
                             kiln_id: Optional[str] = None) -> List[AnomalyEvent]:
        all_anomalies = []
        time_array = results.get('time', [])

        if len(time_array) < 2:
            return all_anomalies

        dt = time_array[1] - time_array[0]

        for i, t in enumerate(time_array):
            values = {}

            if 'kiln_temperature' in results:
                values['kiln_temperature'] = results['kiln_temperature'][i]

            if 'temperature' in results:
                temp_data = results['temperature']
                if temp_data.ndim == 2:
                    values['body_temperature'] = np.mean(temp_data[i, :])
                    values['temperature_gradient'] = np.max(temp_data[i, :]) - np.min(temp_data[i, :])

            if 'relative_humidity' in results:
                values['humidity'] = results['relative_humidity'][i]

            if 'oxygen_content' in results:
                values['oxygen_content'] = results['oxygen_content'][i] * 100

            if 'water_remaining' in results:
                values['water_remaining'] = results['water_remaining'][i]

            anomalies = self.detect(t, values, dt, kiln_id)
            all_anomalies.extend(anomalies)

        return all_anomalies

    def get_anomaly_summary(self) -> Dict:
        if not self.anomalies:
            return {'total': 0, 'by_level': {}, 'by_parameter': {}}

        by_level = {}
        by_parameter = {}
        by_kiln = {}

        for anomaly in self.anomalies:
            level_name = anomaly.level.name
            by_level[level_name] = by_level.get(level_name, 0) + 1

            by_parameter[anomaly.parameter] = by_parameter.get(anomaly.parameter, 0) + 1

            if anomaly.kiln_id:
                by_kiln[anomaly.kiln_id] = by_kiln.get(anomaly.kiln_id, 0) + 1

        return {
            'total': len(self.anomalies),
            'by_level': by_level,
            'by_parameter': by_parameter,
            'by_kiln': by_kiln,
            'critical_count': sum(1 for a in self.anomalies if a.level.value >= 2),
            'warning_count': sum(1 for a in self.anomalies if a.level.value == 1)
        }

    def export_anomalies(self, filepath: str):
        export_data = {
            'anomalies': [a.to_dict() for a in self.anomalies],
            'summary': self.get_anomaly_summary()
        }
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, indent=2, ensure_ascii=False)

    def clear(self):
        self.anomalies.clear()
        self._prev_values.clear()
        self._persistence_counters.clear()


class RealTimeMonitor:
    def __init__(self, window_size: int = 50):
        self.detector = AnomalyDetector()
        self.window_size = window_size
        self.data_window: Dict[str, deque] = {
            'time': deque(maxlen=window_size),
            'temperature': deque(maxlen=window_size),
            'humidity': deque(maxlen=window_size)
        }
        self.callbacks: List[Callable[[AnomalyEvent], None]] = []

    def add_callback(self, callback: Callable[[AnomalyEvent], None]):
        self.callbacks.append(callback)

    def update(self, time: float, data: Dict[str, float],
                dt: float = 60.0, kiln_id: Optional[str] = None) -> List[AnomalyEvent]:
        for key, value in data.items():
            if key in self.data_window:
                self.data_window[key].append(value)

        anomalies = self.detector.detect(time, data, dt, kiln_id)

        for anomaly in anomalies:
            for callback in self.callbacks:
                callback(anomaly)

        return anomalies

    def get_statistics(self) -> Dict:
        stats = {}
        for key, window in self.data_window.items():
            if window and key != 'time':
                arr = np.array(window)
                stats[key] = {
                    'mean': float(np.mean(arr)),
                    'std': float(np.std(arr)),
                    'min': float(np.min(arr)),
                    'max': float(np.max(arr)),
                    'current': float(arr[-1]) if len(arr) > 0 else None
                }
        stats.update(self.detector.get_anomaly_summary())
        return stats


class PatternDetector:
    def __init__(self):
        self.patterns: Dict[str, Dict] = {}
        self._register_standard_patterns()

    def _register_standard_patterns(self):
        self.patterns['thermal_shock_risk'] = {
            'description': '热冲击风险 - 温度变化过快',
            'threshold': 10.0 / 60.0,
            'window': 5
        }
        self.patterns['drying_inefficiency'] = {
            'description': '干燥效率低下 - 水分排出过慢',
            'threshold': 0.001,
            'window': 60
        }
        self.patterns['soaking_irregularity'] = {
            'description': '保温阶段温度波动过大',
            'threshold': 5.0,
            'window': 30
        }

    def detect_patterns(self, time: np.ndarray, temperature: np.ndarray,
                         water: Optional[np.ndarray] = None) -> List[Dict]:
        detected = []

        if len(temperature) >= 5:
            rate = np.abs(np.gradient(temperature, time))
            if np.mean(rate[-5:]) > self.patterns['thermal_shock_risk']['threshold']:
                detected.append({
                    'pattern': 'thermal_shock_risk',
                    'description': self.patterns['thermal_shock_risk']['description'],
                    'severity': 'high',
                    'time': float(time[-1])
                })

        if water is not None and len(water) >= 60:
            recent_water = water[-60:]
            if len(recent_water) > 1:
                drainage_rate = (recent_water[0] - recent_water[-1]) / (time[-1] - time[-60])
                if drainage_rate < self.patterns['drying_inefficiency']['threshold']:
                    detected.append({
                        'pattern': 'drying_inefficiency',
                        'description': self.patterns['drying_inefficiency']['description'],
                        'severity': 'medium',
                        'time': float(time[-1])
                    })

        return detected

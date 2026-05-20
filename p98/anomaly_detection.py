import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from enum import Enum


class AlertLevel(Enum):
    INFO = 1
    WARNING = 2
    CRITICAL = 3


@dataclass
class AnomalyAlert:
    timestamp: float
    alert_type: str
    level: AlertLevel
    message: str
    value: float
    threshold: float
    recommendation: str


class FermentationAnomalyDetector:
    def __init__(self):
        self.thresholds = {
            'temp_rate_max': 2.0,
            'temp_min': 20,
            'temp_max': 40,
            'hum_min': 0.4,
            'hum_max': 0.95,
            'biomass_drop_rate': 0.1,
            'substrate_rate_max': 50,
            'co2_spike_threshold': 2.0,
            'product_rate_drop': 0.5
        }
        
        self.alerts: List[AnomalyAlert] = []
        self.baseline_stats: Dict = {}

    def set_baseline(self, historical_data: Dict) -> None:
        for key in ['temperature', 'humidity', 'biomass', 'substrate', 'product', 'co2']:
            if key in historical_data:
                data = np.array(historical_data[key])
                self.baseline_stats[key] = {
                    'mean': np.mean(data),
                    'std': np.std(data),
                    'min': np.min(data),
                    'max': np.max(data)
                }

    def _calculate_derivative(self, time: np.ndarray, data: np.ndarray) -> np.ndarray:
        dt = np.diff(time)
        dy = np.diff(data)
        rates = np.zeros_like(data)
        rates[1:] = dy / dt
        rates[0] = rates[1]
        return rates

    def _detect_temperature_anomalies(self, time: np.ndarray, temp: np.ndarray) -> List[AnomalyAlert]:
        alerts = []
        temp_rate = self._calculate_derivative(time, temp)
        
        for i in range(len(time)):
            if abs(temp_rate[i]) > self.thresholds['temp_rate_max']:
                level = AlertLevel.CRITICAL if abs(temp_rate[i]) > 3 else AlertLevel.WARNING
                alerts.append(AnomalyAlert(
                    timestamp=time[i],
                    alert_type='TEMPERATURE_RATE',
                    level=level,
                    message=f'温度变化速率异常: {temp_rate[i]:.2f} °C/h',
                    value=temp_rate[i],
                    threshold=self.thresholds['temp_rate_max'],
                    recommendation='检查温控系统，调整冷却/加热功率'
                ))
            
            if temp[i] < self.thresholds['temp_min']:
                alerts.append(AnomalyAlert(
                    timestamp=time[i],
                    alert_type='TEMPERATURE_LOW',
                    level=AlertLevel.WARNING,
                    message=f'温度过低: {temp[i]:.1f} °C',
                    value=temp[i],
                    threshold=self.thresholds['temp_min'],
                    recommendation='提高环境温度或检查加热系统'
                ))
            
            if temp[i] > self.thresholds['temp_max']:
                alerts.append(AnomalyAlert(
                    timestamp=time[i],
                    alert_type='TEMPERATURE_HIGH',
                    level=AlertLevel.CRITICAL,
                    message=f'温度过高: {temp[i]:.1f} °C',
                    value=temp[i],
                    threshold=self.thresholds['temp_max'],
                    recommendation='立即启动冷却系统，检查是否有过热风险'
                ))
        
        return alerts

    def _detect_humidity_anomalies(self, time: np.ndarray, hum: np.ndarray) -> List[AnomalyAlert]:
        alerts = []
        
        for i in range(len(time)):
            if hum[i] < self.thresholds['hum_min']:
                alerts.append(AnomalyAlert(
                    timestamp=time[i],
                    alert_type='HUMIDITY_LOW',
                    level=AlertLevel.WARNING,
                    message=f'湿度过低: {hum[i]:.2f}',
                    value=hum[i],
                    threshold=self.thresholds['hum_min'],
                    recommendation='增加喷雾或降低通风速率'
                ))
            
            if hum[i] > self.thresholds['hum_max']:
                alerts.append(AnomalyAlert(
                    timestamp=time[i],
                    alert_type='HUMIDITY_HIGH',
                    level=AlertLevel.WARNING,
                    message=f'湿度过高: {hum[i]:.2f}',
                    value=hum[i],
                    threshold=self.thresholds['hum_max'],
                    recommendation='增加通风，检查冷凝水排放'
                ))
        
        return alerts

    def _detect_microbial_anomalies(self, time: np.ndarray, biomass: np.ndarray) -> List[AnomalyAlert]:
        alerts = []
        biomass_rate = self._calculate_derivative(time, biomass)
        
        for i in range(1, len(time)):
            if biomass[i] < biomass[i-1] * (1 - self.thresholds['biomass_drop_rate']):
                drop_pct = (1 - biomass[i] / biomass[i-1]) * 100
                alerts.append(AnomalyAlert(
                    timestamp=time[i],
                    alert_type='BIOMASS_DROP',
                    level=AlertLevel.CRITICAL,
                    message=f'微生物浓度骤降: {drop_pct:.1f}%',
                    value=drop_pct,
                    threshold=self.thresholds['biomass_drop_rate'] * 100,
                    recommendation='检查是否有污染或温度冲击，考虑接种新菌株'
                ))
            
            if biomass_rate[i] < -5 and i > 0:
                alerts.append(AnomalyAlert(
                    timestamp=time[i],
                    alert_type='BIOMASS_DEATH',
                    level=AlertLevel.CRITICAL,
                    message=f'微生物死亡速率异常: {biomass_rate[i]:.2f}',
                    value=biomass_rate[i],
                    threshold=-5,
                    recommendation='立即检测pH值和有毒物质浓度'
                ))
        
        return alerts

    def _detect_substrate_anomalies(self, time: np.ndarray, substrate: np.ndarray) -> List[AnomalyAlert]:
        alerts = []
        substrate_rate = self._calculate_derivative(time, substrate)
        
        for i in range(len(time)):
            if abs(substrate_rate[i]) > self.thresholds['substrate_rate_max']:
                alerts.append(AnomalyAlert(
                    timestamp=time[i],
                    alert_type='SUBSTRATE_RATE',
                    level=AlertLevel.WARNING,
                    message=f'底物消耗速率异常: {substrate_rate[i]:.2f}',
                    value=abs(substrate_rate[i]),
                    threshold=self.thresholds['substrate_rate_max'],
                    recommendation='检查补料系统，验证底物浓度'
                ))
        
        return alerts

    def _detect_co2_anomalies(self, time: np.ndarray, co2: np.ndarray) -> List[AnomalyAlert]:
        alerts = []
        co2_rate = self._calculate_derivative(time, co2)
        
        baseline_rate = np.mean(co2_rate[:max(10, len(co2_rate)//4)]) if len(co2_rate) > 10 else 1
        
        for i in range(len(time)):
            if co2_rate[i] > baseline_rate * self.thresholds['co2_spike_threshold']:
                alerts.append(AnomalyAlert(
                    timestamp=time[i],
                    alert_type='CO2_SPIKE',
                    level=AlertLevel.WARNING,
                    message=f'CO2释放突增: {co2_rate[i]:.2f}',
                    value=co2_rate[i],
                    threshold=baseline_rate * self.thresholds['co2_spike_threshold'],
                    recommendation='检查是否有杂菌污染或代谢异常'
                ))
        
        return alerts

    def detect_all_anomalies(self, results: Dict) -> List[AnomalyAlert]:
        self.alerts = []
        
        time = np.array(results['time'])
        temp = np.array(results['temperature'])
        hum = np.array(results['humidity'])
        biomass = np.array(results.get('total_biomass', results.get('biomass', np.zeros_like(time))))
        substrate = np.array(results['substrate'])
        product = np.array(results['product'])
        co2 = np.array(results['co2'])
        
        self.alerts.extend(self._detect_temperature_anomalies(time, temp))
        self.alerts.extend(self._detect_humidity_anomalies(time, hum))
        self.alerts.extend(self._detect_microbial_anomalies(time, biomass))
        self.alerts.extend(self._detect_substrate_anomalies(time, substrate))
        self.alerts.extend(self._detect_co2_anomalies(time, co2))
        
        self.alerts.sort(key=lambda x: (x.level.value, x.timestamp))
        
        return self.alerts

    def get_alert_summary(self) -> Dict:
        summary = {
            'total_alerts': len(self.alerts),
            'critical_count': sum(1 for a in self.alerts if a.level == AlertLevel.CRITICAL),
            'warning_count': sum(1 for a in self.alerts if a.level == AlertLevel.WARNING),
            'info_count': sum(1 for a in self.alerts if a.level == AlertLevel.INFO),
            'by_type': {},
            'critical_alerts': [a for a in self.alerts if a.level == AlertLevel.CRITICAL][:5]
        }
        
        for alert in self.alerts:
            if alert.alert_type not in summary['by_type']:
                summary['by_type'][alert.alert_type] = 0
            summary['by_type'][alert.alert_type] += 1
        
        return summary

    def generate_report(self) -> str:
        summary = self.get_alert_summary()
        
        report = []
        report.append("=" * 60)
        report.append("发酵过程异常检测报告")
        report.append("=" * 60)
        report.append(f"总预警数: {summary['total_alerts']}")
        report.append(f"  - 严重预警: {summary['critical_count']}")
        report.append(f"  - 警告: {summary['warning_count']}")
        report.append(f"  - 信息: {summary['info_count']}")
        report.append("")
        
        if summary['critical_count'] > 0:
            report.append("关键预警:")
            report.append("-" * 60)
            for alert in summary['critical_alerts']:
                report.append(f"[{alert.timestamp:.1f}h] {alert.message}")
                report.append(f"    建议: {alert.recommendation}")
            report.append("")
        
        report.append("预警分类统计:")
        for alert_type, count in summary['by_type'].items():
            report.append(f"  {alert_type}: {count} 次")
        
        return "\n".join(report)


class RealTimeMonitor:
    def __init__(self, detector: FermentationAnomalyDetector):
        self.detector = detector
        self.buffer_size = 100
        self.data_buffer: Dict[str, List[float]] = {}

    def update(self, new_data: Dict[str, float]) -> List[AnomalyAlert]:
        for key, value in new_data.items():
            if key not in self.data_buffer:
                self.data_buffer[key] = []
            self.data_buffer[key].append(value)
            
            if len(self.data_buffer[key]) > self.buffer_size:
                self.data_buffer[key].pop(0)
        
        if len(self.data_buffer.get('time', [])) >= 5:
            buffer_dict = {k: np.array(v) for k, v in self.data_buffer.items()}
            return self.detector.detect_all_anomalies(buffer_dict)
        
        return []

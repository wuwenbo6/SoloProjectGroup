import numpy as np
from typing import List, Dict, Optional, Callable, Tuple
from enum import Enum
from dataclasses import dataclass
from datetime import datetime


class AlertLevel(Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class AlertType(Enum):
    TEMPERATURE_HIGH = "temperature_high"
    TEMPERATURE_LOW = "temperature_low"
    TEMPERATURE_GRADIENT = "temperature_gradient"
    MOISTURE_GRADIENT = "moisture_gradient"
    DRYING_RATE_FAST = "drying_rate_fast"
    DRYING_RATE_SLOW = "drying_rate_slow"
    HUMIDITY_ABNORMAL = "humidity_abnormal"
    SURFACE_DRYING_FAST = "surface_drying_fast"
    LAYER_DIFFERENCE_LARGE = "layer_difference_large"


@dataclass
class DryingAlert:
    timestamp: float
    alert_level: AlertLevel
    alert_type: AlertType
    message: str
    value: float
    threshold: float
    position: Optional[float] = None
    layer_id: Optional[int] = None

    def to_dict(self) -> Dict:
        return {
            'timestamp_hours': self.timestamp / 3600,
            'alert_level': self.alert_level.value,
            'alert_type': self.alert_type.value,
            'message': self.message,
            'value': self.value,
            'threshold': self.threshold,
            'position_mm': self.position * 1000 if self.position is not None else None,
            'layer_id': self.layer_id
        }


class DryingThresholds:
    def __init__(self):
        self.temp_max = 45.0
        self.temp_min = 15.0
        self.max_temp_gradient = 5.0

        self.max_moisture_gradient = 0.05

        self.max_drying_rate_change = 2.0
        self.min_drying_rate = 0.0001

        self.humidity_min = 30.0
        self.humidity_max = 85.0

        self.max_surface_core_diff = 0.15

        self.max_layer_moisture_diff = 0.10


class DryingMonitor:
    def __init__(self, thresholds: Optional[DryingThresholds] = None):
        self.thresholds = thresholds or DryingThresholds()
        self.alerts: List[DryingAlert] = []
        self.alert_callbacks: List[Callable[[DryingAlert], None]] = []
        self.history_stats = []

    def add_alert_callback(self, callback: Callable[[DryingAlert], None]):
        self.alert_callbacks.append(callback)

    def _trigger_alert(self, alert: DryingAlert):
        self.alerts.append(alert)
        for callback in self.alert_callbacks:
            callback(alert)

    def monitor_single_layer(
        self,
        time: float,
        moisture_profile: np.ndarray,
        temp_profile: np.ndarray,
        x_coords: np.ndarray,
        previous_moisture: Optional[np.ndarray] = None,
        dt: Optional[float] = None
    ):
        avg_temp = np.mean(temp_profile)
        if avg_temp > self.thresholds.temp_max:
            self._trigger_alert(DryingAlert(
                timestamp=time,
                alert_level=AlertLevel.WARNING,
                alert_type=AlertType.TEMPERATURE_HIGH,
                message=f"温度过高: {avg_temp:.1f}°C",
                value=avg_temp,
                threshold=self.thresholds.temp_max
            ))
        elif avg_temp < self.thresholds.temp_min:
            self._trigger_alert(DryingAlert(
                timestamp=time,
                alert_level=AlertLevel.WARNING,
                alert_type=AlertType.TEMPERATURE_LOW,
                message=f"温度过低: {avg_temp:.1f}°C",
                value=avg_temp,
                threshold=self.thresholds.temp_min
            ))

        max_temp_diff = np.max(temp_profile) - np.min(temp_profile)
        if max_temp_diff > self.thresholds.max_temp_gradient:
            self._trigger_alert(DryingAlert(
                timestamp=time,
                alert_level=AlertLevel.WARNING,
                alert_type=AlertType.TEMPERATURE_GRADIENT,
                message=f"温度梯度过大: {max_temp_diff:.2f}°C/mm",
                value=max_temp_diff,
                threshold=self.thresholds.max_temp_gradient
            ))

        moisture_gradient = np.max(np.abs(np.gradient(moisture_profile, x_coords)))
        if moisture_gradient > self.thresholds.max_moisture_gradient:
            self._trigger_alert(DryingAlert(
                timestamp=time,
                alert_level=AlertLevel.WARNING,
                alert_type=AlertType.MOISTURE_GRADIENT,
                message=f"含水率梯度过大: {moisture_gradient:.4f}",
                value=moisture_gradient,
                threshold=self.thresholds.max_moisture_gradient
            ))

        if previous_moisture is not None and dt is not None and dt > 0:
            avg_moisture = np.mean(moisture_profile)
            prev_avg_moisture = np.mean(previous_moisture)

            drying_rate = (prev_avg_moisture - avg_moisture) / dt

            if drying_rate > self.thresholds.max_drying_rate_change / 3600:
                self._trigger_alert(DryingAlert(
                    timestamp=time,
                    alert_level=AlertLevel.CRITICAL,
                    alert_type=AlertType.DRYING_RATE_FAST,
                    message=f"干燥速率过快: {drying_rate * 3600:.4f} 1/h",
                    value=drying_rate * 3600,
                    threshold=self.thresholds.max_drying_rate_change
                ))

            elif drying_rate < self.thresholds.min_drying_rate:
                self._trigger_alert(DryingAlert(
                    timestamp=time,
                    alert_level=AlertLevel.WARNING,
                    alert_type=AlertType.DRYING_RATE_SLOW,
                    message=f"干燥速率过慢: {drying_rate * 3600:.6f} 1/h",
                    value=drying_rate * 3600,
                    threshold=self.thresholds.min_drying_rate
                ))

        surface_moisture = moisture_profile[0]
        core_moisture = moisture_profile[len(moisture_profile) // 2]
        surface_core_diff = abs(surface_moisture - core_moisture)

        if surface_core_diff > self.thresholds.max_surface_core_diff:
            self._trigger_alert(DryingAlert(
                timestamp=time,
                alert_level=AlertLevel.CRITICAL,
                alert_type=AlertType.SURFACE_DRYING_FAST,
                message=f"表芯含水率差异过大: {surface_core_diff * 100:.2f}%",
                value=surface_core_diff * 100,
                threshold=self.thresholds.max_surface_core_diff * 100
            ))

    def monitor_multi_layer(
        self,
        time: float,
        moisture_history: np.ndarray,
        temp_history: np.ndarray,
        x_global: np.ndarray,
        layer_info: List[Dict],
        nx_per_layer: int,
        previous_moisture: Optional[np.ndarray] = None,
        dt: Optional[float] = None
    ):
        for layer in layer_info:
            layer_id = layer['layer_id']
            start_idx = layer_id * nx_per_layer
            end_idx = start_idx + nx_per_layer

            layer_moisture = moisture_history[start_idx:end_idx]
            layer_temp = temp_history[start_idx:end_idx]
            layer_x = x_global[start_idx:end_idx]

            prev_layer_moisture = None
            if previous_moisture is not None:
                prev_layer_moisture = previous_moisture[start_idx:end_idx]

            self.monitor_single_layer(
                time, layer_moisture, layer_temp, layer_x,
                prev_layer_moisture, dt
            )

        for i in range(len(layer_info) - 1):
            layer1_end = (i + 1) * nx_per_layer - 1
            layer2_start = layer1_end + 1

            layer1_moisture = moisture_history[layer1_end]
            layer2_moisture = moisture_history[layer2_start]
            layer_diff = abs(layer1_moisture - layer2_moisture)

            if layer_diff > self.thresholds.max_layer_moisture_diff:
                self._trigger_alert(DryingAlert(
                    timestamp=time,
                    alert_level=AlertLevel.WARNING,
                    alert_type=AlertType.LAYER_DIFFERENCE_LARGE,
                    message=f"层间含水率差异过大: {layer_diff * 100:.2f}% (层 {i} 和 {i+1})",
                    value=layer_diff * 100,
                    threshold=self.thresholds.max_layer_moisture_diff * 100,
                    position=x_global[layer1_end],
                    layer_id=i
                ))

    def monitor_environment(self, time: float, humidity: float, ambient_temp: float):
        if humidity < self.thresholds.humidity_min or humidity > self.thresholds.humidity_max:
            level = AlertLevel.WARNING
            if humidity < 20 or humidity > 90:
                level = AlertLevel.CRITICAL

            self._trigger_alert(DryingAlert(
                timestamp=time,
                alert_level=level,
                alert_type=AlertType.HUMIDITY_ABNORMAL,
                message=f"环境湿度异常: {humidity:.1f}%",
                value=humidity,
                threshold=self.thresholds.humidity_min if humidity < 50 else self.thresholds.humidity_max
            ))

    def get_alerts_by_level(self, level: AlertLevel) -> List[DryingAlert]:
        return [a for a in self.alerts if a.alert_level == level]

    def get_alerts_by_type(self, alert_type: AlertType) -> List[DryingAlert]:
        return [a for a in self.alerts if a.alert_type == alert_type]

    def generate_report(self) -> Dict:
        critical_count = len(self.get_alerts_by_level(AlertLevel.CRITICAL))
        warning_count = len(self.get_alerts_by_level(AlertLevel.WARNING))

        alert_type_counts = {}
        for alert in self.alerts:
            alert_type = alert.alert_type.value
            alert_type_counts[alert_type] = alert_type_counts.get(alert_type, 0) + 1

        return {
            'summary': {
                'total_alerts': len(self.alerts),
                'critical_count': critical_count,
                'warning_count': warning_count,
                'info_count': len(self.get_alerts_by_level(AlertLevel.INFO))
            },
            'alerts_by_type': alert_type_counts,
            'recommendations': self._generate_recommendations(),
            'alerts': [a.to_dict() for a in self.alerts]
        }

    def _generate_recommendations(self) -> List[str]:
        recommendations = []

        critical_alerts = self.get_alerts_by_level(AlertLevel.CRITICAL)
        if critical_alerts:
            recommendations.append("【重要】检测到严重异常，请立即检查干燥工艺参数")

            drying_rate_alerts = [a for a in critical_alerts if a.alert_type == AlertType.DRYING_RATE_FAST]
            if drying_rate_alerts:
                recommendations.append("- 建议降低环境温度或增加湿度，减缓干燥速率")

            surface_alerts = [a for a in critical_alerts if a.alert_type == AlertType.SURFACE_DRYING_FAST]
            if surface_alerts:
                recommendations.append("- 表芯差异过大，建议增加湿度或采用梯度干燥工艺")

        warning_alerts = self.get_alerts_by_level(AlertLevel.WARNING)
        if warning_alerts:
            temp_high = [a for a in warning_alerts if a.alert_type == AlertType.TEMPERATURE_HIGH]
            if temp_high:
                recommendations.append("- 温度偏高，建议适当降低环境温度")

            temp_low = [a for a in warning_alerts if a.alert_type == AlertType.TEMPERATURE_LOW]
            if temp_low:
                recommendations.append("- 温度偏低，建议适当提高环境温度以加快干燥")

            gradient_alerts = [a for a in warning_alerts if a.alert_type == AlertType.MOISTURE_GRADIENT]
            if gradient_alerts:
                recommendations.append("- 含水率梯度较大，建议优化温湿度控制策略")

            layer_diff_alerts = [a for a in warning_alerts if a.alert_type == AlertType.LAYER_DIFFERENCE_LARGE]
            if layer_diff_alerts:
                recommendations.append("- 层间含水率差异较大，建议考虑不同层的材料匹配性")

        if not recommendations:
            recommendations.append("干燥过程正常，建议继续监控")

        return recommendations

    def save_report(self, filepath: str):
        import json
        report = self.generate_report()
        report['generated_time'] = datetime.now().isoformat()

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)

        print(f"监控报告已保存至: {filepath}")

    def reset(self):
        self.alerts = []
        self.history_stats = []

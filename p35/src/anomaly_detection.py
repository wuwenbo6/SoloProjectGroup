import numpy as np
from typing import Dict, List, Tuple, Optional, Callable
from dataclasses import dataclass, field
from enum import Enum
from collections import deque


class AnomalySeverity(Enum):
    """异常严重程度"""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class AnomalyType(Enum):
    """异常类型"""
    TEMPERATURE_ANOMALY = "temperature_anomaly"
    PH_ANOMALY = "ph_anomaly"
    MICROBIAL_CONTAMINATION = "microbial_contamination"
    SUBSTRATE_EXHAUSTION = "substrate_exhaustion"
    PRODUCT_INHIBITION = "product_inhibition"
    GROWTH_STAGNATION = "growth_stagnation"
    ABNORMAL_FERMENTATION_RATE = "abnormal_fermentation_rate"


@dataclass
class AnomalyEvent:
    """异常事件记录"""
    timestamp: float
    anomaly_type: AnomalyType
    severity: AnomalySeverity
    description: str
    current_value: float
    expected_range: Tuple[float, float]
    recommended_action: str


@dataclass
class ThresholdConfig:
    """阈值配置"""
    temp_min: float = 20.0
    temp_max: float = 38.0
    temp_rate_max: float = 2.0
    ph_min: float = 3.0
    ph_max: float = 6.5
    ph_rate_max: float = 0.2
    substrate_critical: float = 5.0
    product_inhibition_threshold: float = 60.0
    growth_stagnation_threshold: float = 0.01
    contamination_ratio_threshold: float = 0.5


class AnomalyDetector:
    """发酵过程异常检测器"""

    def __init__(self, threshold_config: Optional[ThresholdConfig] = None):
        self.thresholds = threshold_config or ThresholdConfig()
        self.anomaly_history: List[AnomalyEvent] = []
        self.temp_window = deque(maxlen=10)
        self.ph_window = deque(maxlen=10)
        self.growth_window = deque(maxlen=20)

    def reset(self):
        """重置检测器状态"""
        self.anomaly_history.clear()
        self.temp_window.clear()
        self.ph_window.clear()
        self.growth_window.clear()

    def _detect_temperature_anomalies(self, t: float, T: float, T_prev: float) -> List[AnomalyEvent]:
        """检测温度相关异常"""
        anomalies = []

        if T < self.thresholds.temp_min:
            anomalies.append(AnomalyEvent(
                timestamp=t,
                anomaly_type=AnomalyType.TEMPERATURE_ANOMALY,
                severity=AnomalySeverity.WARNING,
                description=f"温度过低: {T:.1f}℃",
                current_value=T,
                expected_range=(self.thresholds.temp_min, self.thresholds.temp_max),
                recommended_action="升高发酵温度，检查加热系统"
            ))
        elif T > self.thresholds.temp_max:
            anomalies.append(AnomalyEvent(
                timestamp=t,
                anomaly_type=AnomalyType.TEMPERATURE_ANOMALY,
                severity=AnomalySeverity.CRITICAL,
                description=f"温度过高: {T:.1f}℃",
                current_value=T,
                expected_range=(self.thresholds.temp_min, self.thresholds.temp_max),
                recommended_action="立即降温，检查冷却系统，防止微生物失活"
            ))

        temp_rate = abs(T - T_prev) if T_prev is not None else 0.0
        if temp_rate > self.thresholds.temp_rate_max:
            anomalies.append(AnomalyEvent(
                timestamp=t,
                anomaly_type=AnomalyType.TEMPERATURE_ANOMALY,
                severity=AnomalySeverity.WARNING,
                description=f"温度变化过快: {temp_rate:.2f}℃/步",
                current_value=temp_rate,
                expected_range=(0, self.thresholds.temp_rate_max),
                recommended_action="检查温控系统稳定性"
            ))

        return anomalies

    def _detect_ph_anomalies(self, t: float, ph: float, ph_prev: float) -> List[AnomalyEvent]:
        """检测pH相关异常"""
        anomalies = []

        if ph < self.thresholds.ph_min:
            anomalies.append(AnomalyEvent(
                timestamp=t,
                anomaly_type=AnomalyType.PH_ANOMALY,
                severity=AnomalySeverity.CRITICAL,
                description=f"pH过低: {ph:.2f}",
                current_value=ph,
                expected_range=(self.thresholds.ph_min, self.thresholds.ph_max),
                recommended_action="添加缓冲剂，检查是否杂菌污染"
            ))
        elif ph > self.thresholds.ph_max:
            anomalies.append(AnomalyEvent(
                timestamp=t,
                anomaly_type=AnomalyType.PH_ANOMALY,
                severity=AnomalySeverity.WARNING,
                description=f"pH过高: {ph:.2f}",
                current_value=ph,
                expected_range=(self.thresholds.ph_min, self.thresholds.ph_max),
                recommended_action="检查是否发酵启动延迟"
            ))

        ph_rate = abs(ph - ph_prev) if ph_prev is not None else 0.0
        if ph_rate > self.thresholds.ph_rate_max:
            anomalies.append(AnomalyEvent(
                timestamp=t,
                anomaly_type=AnomalyType.PH_ANOMALY,
                severity=AnomalySeverity.WARNING,
                description=f"pH变化过快: {ph_rate:.3f}/步",
                current_value=ph_rate,
                expected_range=(0, self.thresholds.ph_rate_max),
                recommended_action="检查是否杂菌污染或异常发酵"
            ))

        return anomalies

    def _detect_substrate_anomalies(self, t: float, S: float, S_prev: float) -> List[AnomalyEvent]:
        """检测底物相关异常"""
        anomalies = []

        if S < self.thresholds.substrate_critical:
            anomalies.append(AnomalyEvent(
                timestamp=t,
                anomaly_type=AnomalyType.SUBSTRATE_EXHAUSTION,
                severity=AnomalySeverity.WARNING,
                description=f"底物即将耗尽: {S:.2f} g/L",
                current_value=S,
                expected_range=(self.thresholds.substrate_critical, float('inf')),
                recommended_action="考虑补料或终止发酵"
            ))

        if S_prev is not None and S_prev > 0:
            consumption_rate = (S_prev - S) / S_prev
            if consumption_rate < 0.001:
                anomalies.append(AnomalyEvent(
                    timestamp=t,
                    anomaly_type=AnomalyType.GROWTH_STAGNATION,
                    severity=AnomalySeverity.WARNING,
                    description=f"底物消耗停滞，消耗率: {consumption_rate:.4f}",
                    current_value=consumption_rate,
                    expected_range=(self.thresholds.growth_stagnation_threshold, float('inf')),
                    recommended_action="检查微生物活性或氧气供应"
                ))

        return anomalies

    def _detect_product_anomalies(self, t: float, P: float) -> List[AnomalyEvent]:
        """检测产物相关异常"""
        anomalies = []

        if P > self.thresholds.product_inhibition_threshold:
            anomalies.append(AnomalyEvent(
                timestamp=t,
                anomaly_type=AnomalyType.PRODUCT_INHIBITION,
                severity=AnomalySeverity.INFO,
                description=f"产物浓度可能抑制生长: {P:.2f} g/L",
                current_value=P,
                expected_range=(0, self.thresholds.product_inhibition_threshold),
                recommended_action="考虑产物分离或稀释发酵液"
            ))

        return anomalies

    def _detect_microbial_anomalies(self, t: float, X_main: float, X_contaminant: float) -> List[AnomalyEvent]:
        """检测微生物相关异常"""
        anomalies = []

        if X_main + X_contaminant > 0:
            contamination_ratio = X_contaminant / (X_main + X_contaminant)
            if contamination_ratio > self.thresholds.contamination_ratio_threshold:
                anomalies.append(AnomalyEvent(
                    timestamp=t,
                    anomaly_type=AnomalyType.MICROBIAL_CONTAMINATION,
                    severity=AnomalySeverity.CRITICAL,
                    description=f"杂菌比例过高: {contamination_ratio:.1%}",
                    current_value=contamination_ratio,
                    expected_range=(0, self.thresholds.contamination_ratio_threshold),
                    recommended_action="评估污染程度，严重时终止发酵"
                ))

        return anomalies

    def detect_step(self, t: float, states: Dict[str, float],
                    prev_states: Optional[Dict[str, float]] = None) -> List[AnomalyEvent]:
        """单步异常检测"""
        anomalies = []

        T = states.get("temperature", 30.0)
        ph = states.get("ph", 4.5)
        S = states.get("sugar", states.get("substrate", 100.0))
        P = states.get("alcohol", states.get("product", 0.0))
        X_main = states.get("yeast", 1e6)
        X_cont = states.get("bacteria", 1e3)

        T_prev = prev_states.get("temperature") if prev_states else None
        ph_prev = prev_states.get("ph") if prev_states else None
        S_prev = prev_states.get("sugar", prev_states.get("substrate")) if prev_states else None

        anomalies.extend(self._detect_temperature_anomalies(t, T, T_prev))
        anomalies.extend(self._detect_ph_anomalies(t, ph, ph_prev))
        anomalies.extend(self._detect_substrate_anomalies(t, S, S_prev))
        anomalies.extend(self._detect_product_anomalies(t, P))
        anomalies.extend(self._detect_microbial_anomalies(t, X_main, X_cont))

        self.anomaly_history.extend(anomalies)

        return anomalies

    def get_anomaly_summary(self) -> Dict:
        """获取异常汇总统计"""
        if not self.anomaly_history:
            return {"total_anomalies": 0, "by_severity": {}, "by_type": {}}

        severity_counts = {s: 0 for s in AnomalySeverity}
        type_counts = {t: 0 for t in AnomalyType}

        for event in self.anomaly_history:
            severity_counts[event.severity] += 1
            type_counts[event.anomaly_type] += 1

        return {
            "total_anomalies": len(self.anomaly_history),
            "by_severity": {k.value: v for k, v in severity_counts.items() if v > 0},
            "by_type": {k.value: v for k, v in type_counts.items() if v > 0},
            "first_anomaly_time": self.anomaly_history[0].timestamp,
            "last_anomaly_time": self.anomaly_history[-1].timestamp
        }

    def generate_report(self) -> str:
        """生成异常检测报告"""
        summary = self.get_anomaly_summary()
        if summary["total_anomalies"] == 0:
            return "✅ 发酵过程正常，未检测到异常"

        report = ["📊 发酵过程异常检测报告\n"]
        report.append(f"总计发现 {summary['total_anomalies']} 个异常事件\n")

        report.append("\n按严重程度分类:")
        for severity, count in summary["by_severity"].items():
            icon = "🔴" if severity == "critical" else "🟡" if severity == "warning" else "🔵"
            report.append(f"  {icon} {severity}: {count} 个")

        report.append("\n按异常类型分类:")
        for a_type, count in summary["by_type"].items():
            report.append(f"  - {a_type}: {count} 次")

        if self.anomaly_history:
            report.append("\n关键异常事件:")
            critical = [a for a in self.anomaly_history if a.severity == AnomalySeverity.CRITICAL]
            for event in critical[:5]:
                report.append(f"  [{event.timestamp:.1f}h] {event.description}")
                report.append(f"      建议: {event.recommended_action}")

        return "\n".join(report)


class RealTimeMonitor:
    """实时监控器"""

    def __init__(self, detector: AnomalyDetector, callback: Optional[Callable] = None):
        self.detector = detector
        self.callback = callback
        self.state_history = []

    def update(self, t: float, states: Dict[str, float]) -> List[AnomalyEvent]:
        """更新监控状态"""
        prev_states = self.state_history[-1] if self.state_history else None

        anomalies = self.detector.detect_step(t, states, prev_states)

        if anomalies and self.callback:
            for anomaly in anomalies:
                self.callback(anomaly)

        self.state_history.append(states.copy())

        return anomalies

    def get_monitoring_summary(self) -> Dict:
        """获取监控摘要"""
        anomaly_summary = self.detector.get_anomaly_summary()

        return {
            "monitoring_duration": self.state_history[-1].get("time", 0) if self.state_history else 0,
            "data_points": len(self.state_history),
            "anomaly_summary": anomaly_summary
        }

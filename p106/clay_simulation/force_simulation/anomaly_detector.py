import numpy as np
from typing import Dict, List, Tuple, Optional, Callable
from dataclasses import dataclass
from enum import Enum
import warnings


class AnomalySeverity(Enum):
    INFO = 1
    WARNING = 2
    ERROR = 3
    CRITICAL = 4


class AnomalyType(Enum):
    STRESS_EXCEED = "stress_exceed"
    DEFORMATION_EXCEED = "deformation_exceed"
    SAFETY_FACTOR_LOW = "safety_factor_low"
    STRAIN_RATE_HIGH = "strain_rate_high"
    CONTACT_FAILURE = "contact_failure"
    MOISTURE_VIOLATION = "moisture_violation"
    PLASTICITY_VIOLATION = "plasticity_violation"
    UNSTABLE_DEFORMATION = "unstable_deformation"


@dataclass
class Anomaly:
    type: AnomalyType
    severity: AnomalySeverity
    message: str
    location: Optional[Tuple[float, float]] = None
    value: Optional[float] = None
    threshold: Optional[float] = None
    timestamp: Optional[float] = None
    region_id: Optional[str] = None


@dataclass
class DetectionThresholds:
    max_stress: float = 8e4
    max_deformation: float = 0.1
    min_safety_factor: float = 1.2
    max_strain_rate: float = 0.01
    contact_stress_limit: float = 5e4
    moisture_range: Tuple[float, float] = (0.15, 0.35)
    plasticity_range: Tuple[float, float] = (10.0, 30.0)
    deformation_rate_threshold: float = 0.005


class AnomalyDetector:
    def __init__(self, thresholds: Optional[DetectionThresholds] = None):
        self.thresholds = thresholds or DetectionThresholds()
        self.anomalies: List[Anomaly] = []
        self.anomaly_history: List[List[Anomaly]] = []
        self._warning_count = 0
        self._error_count = 0

    def reset(self) -> None:
        self.anomalies = []
        self.anomaly_history = []
        self._warning_count = 0
        self._error_count = 0

    def detect_static_anomalies(self, stress: np.ndarray, displacement: np.ndarray,
                                 yield_strength: float,
                                 region_masks: Optional[np.ndarray] = None,
                                 clay_params: Optional[Dict[int, Dict]] = None) -> List[Anomaly]:
        anomalies = []

        von_mises = stress
        max_stress = np.max(von_mises)

        if max_stress > self.thresholds.max_stress:
            max_loc = np.unravel_index(np.argmax(von_mises), von_mises.shape)
            ny, nx = von_mises.shape
            anomalies.append(Anomaly(
                type=AnomalyType.STRESS_EXCEED,
                severity=AnomalySeverity.ERROR if max_stress > 2 * self.thresholds.max_stress else AnomalySeverity.WARNING,
                message=f"最大应力 {max_stress:.2e} Pa 超过阈值 {self.thresholds.max_stress:.2e} Pa",
                location=(max_loc[1] / nx, max_loc[0] / ny),
                value=float(max_stress),
                threshold=self.thresholds.max_stress
            ))

        disp_magnitude = np.sqrt(displacement[0] ** 2 + displacement[1] ** 2)
        max_disp = np.max(disp_magnitude)

        if max_disp > self.thresholds.max_deformation:
            max_loc = np.unravel_index(np.argmax(disp_magnitude), disp_magnitude.shape)
            ny, nx = disp_magnitude.shape
            anomalies.append(Anomaly(
                type=AnomalyType.DEFORMATION_EXCEED,
                severity=AnomalySeverity.WARNING,
                message=f"最大变形 {max_disp:.4f} 超过阈值 {self.thresholds.max_deformation:.4f}",
                location=(max_loc[1] / nx, max_loc[0] / ny),
                value=float(max_disp),
                threshold=self.thresholds.max_deformation
            ))

        safety_factor = yield_strength / max_stress
        if safety_factor < self.thresholds.min_safety_factor:
            anomalies.append(Anomaly(
                type=AnomalyType.SAFETY_FACTOR_LOW,
                severity=AnomalySeverity.CRITICAL if safety_factor < 0.8 else AnomalySeverity.ERROR,
                message=f"安全系数 {safety_factor:.2f} 低于最小阈值 {self.thresholds.min_safety_factor}",
                value=float(safety_factor),
                threshold=self.thresholds.min_safety_factor
            ))

        if region_masks is not None and clay_params is not None:
            region_anomalies = self._detect_region_anomalies(
                von_mises, disp_magnitude, region_masks, clay_params
            )
            anomalies.extend(region_anomalies)

        self.anomalies.extend(anomalies)
        self._update_counts(anomalies)

        return anomalies

    def _detect_region_anomalies(self, stress: np.ndarray, displacement: np.ndarray,
                                  region_masks: np.ndarray,
                                  clay_params: Dict[int, Dict]) -> List[Anomaly]:
        anomalies = []

        unique_regions = np.unique(region_masks)
        for region_id in unique_regions:
            if region_id == 0:
                continue

            mask = region_masks == region_id
            region_stress = stress[mask]
            region_disp = displacement[mask]

            region_max_stress = np.max(region_stress)
            region_param = clay_params.get(region_id, {})
            region_yield = region_param.get('yield_strength', 5e4)
            region_safety = region_yield / region_max_stress

            if region_safety < self.thresholds.min_safety_factor:
                anomalies.append(Anomaly(
                    type=AnomalyType.SAFETY_FACTOR_LOW,
                    severity=AnomalySeverity.ERROR,
                    message=f"区域 {region_id} 安全系数 {region_safety:.2f} 过低",
                    value=float(region_safety),
                    threshold=self.thresholds.min_safety_factor,
                    region_id=f"region_{region_id}"
                ))

            moisture = region_param.get('moisture_content', 0.25)
            if not (self.thresholds.moisture_range[0] <= moisture <= self.thresholds.moisture_range[1]):
                anomalies.append(Anomaly(
                    type=AnomalyType.MOISTURE_VIOLATION,
                    severity=AnomalySeverity.WARNING,
                    message=f"区域 {region_id} 含水量 {moisture:.2f} 超出合理范围",
                    value=float(moisture),
                    region_id=f"region_{region_id}"
                ))

        return anomalies

    def detect_dynamic_anomalies(self, deformation_history: np.ndarray,
                                  dt: float, yield_strength: np.ndarray) -> List[Anomaly]:
        anomalies = []
        n_steps = deformation_history.shape[0]

        self.anomaly_history = [[] for _ in range(n_steps)]

        for step in range(1, n_steps):
            step_anomalies = []

            disp_prev = np.sqrt(deformation_history[step - 1, 0] ** 2 + deformation_history[step - 1, 1] ** 2)
            disp_curr = np.sqrt(deformation_history[step, 0] ** 2 + deformation_history[step, 1] ** 2)

            deformation_rate = (disp_curr - disp_prev) / dt
            max_rate = np.max(deformation_rate)

            if max_rate > self.thresholds.deformation_rate_threshold:
                location = np.unravel_index(np.argmax(deformation_rate), deformation_rate.shape)
                ny, nx = deformation_rate.shape
                step_anomalies.append(Anomaly(
                    type=AnomalyType.UNSTABLE_DEFORMATION,
                    severity=AnomalySeverity.WARNING,
                    message=f"时间步 {step}: 变形速率 {max_rate:.4f}/s 过快",
                    location=(location[1] / nx, location[0] / ny),
                    value=float(max_rate),
                    threshold=self.thresholds.deformation_rate_threshold,
                    timestamp=step * dt
                ))

            ex_prev, ey_prev, exy_prev = np.gradient(deformation_history[step - 1, 0]), \
                np.gradient(deformation_history[step - 1, 1], axis=0), \
                0.5 * (np.gradient(deformation_history[step - 1, 0], axis=0) + np.gradient(deformation_history[step - 1, 1], axis=1))

            ex_curr, ey_curr, exy_curr = np.gradient(deformation_history[step, 0]), \
                np.gradient(deformation_history[step, 1], axis=0), \
                0.5 * (np.gradient(deformation_history[step, 0], axis=0) + np.gradient(deformation_history[step, 1], axis=1))

            strain_rate = np.sqrt((ex_curr - ex_prev) ** 2 + (ey_curr - ey_prev) ** 2 + 2 * (exy_curr - exy_prev) ** 2) / dt
            max_strain_rate = np.max(strain_rate)

            if max_strain_rate > self.thresholds.max_strain_rate:
                step_anomalies.append(Anomaly(
                    type=AnomalyType.STRAIN_RATE_HIGH,
                    severity=AnomalySeverity.ERROR,
                    message=f"时间步 {step}: 应变率 {max_strain_rate:.4f}/s 过高",
                    value=float(max_strain_rate),
                    threshold=self.thresholds.max_strain_rate,
                    timestamp=step * dt
                ))

            self.anomaly_history[step] = step_anomalies
            anomalies.extend(step_anomalies)

        self.anomalies.extend(anomalies)
        self._update_counts(anomalies)

        return anomalies

    def detect_contact_anomalies(self, contact_forces: Dict[str, np.ndarray],
                                  contact_conditions: List) -> List[Anomaly]:
        anomalies = []

        for contact_name, forces in contact_forces.items():
            max_contact_force = np.max(forces) if len(forces) > 0 else 0

            if max_contact_force > self.thresholds.contact_stress_limit:
                anomalies.append(Anomaly(
                    type=AnomalyType.CONTACT_FAILURE,
                    severity=AnomalySeverity.ERROR,
                    message=f"接触面 {contact_name} 应力 {max_contact_force:.2e} Pa 超过粘结强度",
                    value=float(max_contact_force),
                    threshold=self.thresholds.contact_stress_limit,
                    region_id=contact_name
                ))

        self.anomalies.extend(anomalies)
        self._update_counts(anomalies)

        return anomalies

    def _update_counts(self, anomalies: List[Anomaly]) -> None:
        for anomaly in anomalies:
            if anomaly.severity in [AnomalySeverity.WARNING]:
                self._warning_count += 1
            elif anomaly.severity in [AnomalySeverity.ERROR, AnomalySeverity.CRITICAL]:
                self._error_count += 1

    def get_anomaly_summary(self) -> Dict:
        severity_counts = {
            'INFO': 0,
            'WARNING': self._warning_count,
            'ERROR': self._error_count,
            'CRITICAL': sum(1 for a in self.anomalies if a.severity == AnomalySeverity.CRITICAL)
        }

        type_counts = {}
        for anomaly in self.anomalies:
            type_name = anomaly.type.value
            type_counts[type_name] = type_counts.get(type_name, 0) + 1

        critical_regions = set(a.region_id for a in self.anomalies
                                 if a.severity in [AnomalySeverity.ERROR, AnomalySeverity.CRITICAL])

        return {
            'total_anomalies': len(self.anomalies),
            'severity_distribution': severity_counts,
            'type_distribution': type_counts,
            'critical_regions': list(critical_regions),
            'has_critical_issues': severity_counts['CRITICAL'] > 0,
            'has_errors': severity_counts['ERROR'] > 0,
            'has_warnings': severity_counts['WARNING'] > 0,
            'overall_risk': self._calculate_overall_risk()
        }

    def _calculate_overall_risk(self) -> str:
        critical_count = sum(1 for a in self.anomalies if a.severity == AnomalySeverity.CRITICAL)
        error_count = sum(1 for a in self.anomalies if a.severity == AnomalySeverity.ERROR)
        warning_count = sum(1 for a in self.anomalies if a.severity == AnomalySeverity.WARNING)

        if critical_count > 0:
            return "HIGH"
        elif error_count > 2:
            return "MEDIUM"
        elif warning_count > 5:
            return "LOW"
        else:
            return "NONE"

    def filter_anomalies_by_severity(self, min_severity: AnomalySeverity) -> List[Anomaly]:
        return [a for a in self.anomalies if a.severity.value >= min_severity.value]

    def filter_anomalies_by_type(self, anomaly_type: AnomalyType) -> List[Anomaly]:
        return [a for a in self.anomalies if a.type == anomaly_type]

    def generate_warning_report(self) -> str:
        summary = self.get_anomaly_summary()

        report = [
            "=" * 60,
            "受力过程异常预警报告",
            "=" * 60,
            f"总异常数: {summary['total_anomalies']}",
            f"  严重: {summary['severity_distribution']['CRITICAL']}",
            f"  错误: {summary['severity_distribution']['ERROR']}",
            f"  警告: {summary['severity_distribution']['WARNING']}",
            f"整体风险等级: {summary['overall_risk']}",
            "",
            "异常详情:"
        ]

        for anomaly in sorted(self.anomalies, key=lambda x: x.severity.value, reverse=True):
            report.append(f"  [{anomaly.severity.name}] {anomaly.type.value}:")
            report.append(f"    {anomaly.message}")
            if anomaly.location:
                report.append(f"    位置: ({anomaly.location[0]:.2f}, {anomaly.location[1]:.2f})")

        report.append("=" * 60)

        return "\n".join(report)

    def plot_anomaly_locations(self, stress_field: np.ndarray, save_path: Optional[str] = None) -> None:
        try:
            import matplotlib.pyplot as plt

            fig, ax = plt.subplots(figsize=(10, 8))

            im = ax.imshow(stress_field, cmap='jet', alpha=0.7)
            plt.colorbar(im, ax=ax, label='Stress (Pa)')

            critical_anomalies = self.filter_anomalies_by_severity(AnomalySeverity.ERROR)
            for anomaly in critical_anomalies:
                if anomaly.location:
                    ny, nx = stress_field.shape
                    x_pix = int(anomaly.location[0] * nx)
                    y_pix = int(anomaly.location[1] * ny)

                    marker = 'x' if anomaly.severity == AnomalySeverity.CRITICAL else 'o'
                    color = 'red' if anomaly.severity == AnomalySeverity.CRITICAL else 'orange'

                    ax.plot(x_pix, y_pix, marker, markersize=12, markeredgecolor='black',
                            markerfacecolor=color, markeredgewidth=2)

            ax.set_title('应力场异常位置标记')
            ax.set_xlabel('X')
            ax.set_ylabel('Y')

            if save_path:
                plt.savefig(save_path, dpi=300, bbox_inches='tight')
                plt.close()
            else:
                plt.show()

        except ImportError:
            warnings.warn("Matplotlib not available for plotting anomaly locations")

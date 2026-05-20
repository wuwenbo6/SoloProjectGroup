from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime
from enum import Enum


class AlertSeverity(Enum):
    INFO = "info"
    WARNING = "warning"
    DANGER = "danger"
    CRITICAL = "critical"


class AlertType(Enum):
    STRESS_EXCEEDANCE = "stress_exceedance"
    SAFETY_FACTOR_LOW = "safety_factor_low"
    FAILURE_PROBABILITY_HIGH = "failure_probability_high"
    BONDING_RISK = "bonding_risk"
    BUCKLING_RISK = "buckling_risk"


@dataclass
class AlertThreshold:
    safety_factor_warning: float = 2.5
    safety_factor_danger: float = 1.5
    failure_probability_warning: float = 0.1
    failure_probability_danger: float = 0.3
    stress_ratio_warning: float = 0.6
    stress_ratio_danger: float = 0.8


class StressAlertGenerator:

    def __init__(self, thresholds: Optional[AlertThreshold] = None):
        self.thresholds = thresholds or AlertThreshold()

    def generate_alerts(
        self,
        stress_analysis: Dict[str, Any],
        wood_properties: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        alerts = []

        max_stress = abs(stress_analysis.get("max_stress", 0))
        tensile_strength = wood_properties.get("tensile_strength", 80)
        compressive_strength = wood_properties.get("compressive_strength", 40)
        reference_strength = max(tensile_strength, compressive_strength)

        stress_ratio = max_stress / reference_strength if reference_strength > 0 else 0

        if stress_ratio >= self.thresholds.stress_ratio_danger:
            alerts.append({
                "type": AlertType.STRESS_EXCEEDANCE.value,
                "severity": AlertSeverity.CRITICAL.value,
                "message": f"应力严重超标！最大应力 {max_stress:.2f} MPa 已达到木材强度的 {stress_ratio:.1%}",
                "stress_ratio": stress_ratio,
                "recommendation": "立即降低载荷，重新设计接头尺寸，考虑使用更高强度的木材"
            })
        elif stress_ratio >= self.thresholds.stress_ratio_warning:
            alerts.append({
                "type": AlertType.STRESS_EXCEEDANCE.value,
                "severity": AlertSeverity.DANGER.value,
                "message": f"应力接近极限！最大应力 {max_stress:.2f} MPa 达到木材强度的 {stress_ratio:.1%}",
                "stress_ratio": stress_ratio,
                "recommendation": "建议降低工作载荷，增加接头安全余量"
            })

        safety_factor = stress_analysis.get("safety_factor", 10)
        if safety_factor <= self.thresholds.safety_factor_danger:
            alerts.append({
                "type": AlertType.SAFETY_FACTOR_LOW.value,
                "severity": AlertSeverity.CRITICAL.value,
                "message": f"安全系数严重不足！当前安全系数为 {safety_factor:.2f}",
                "safety_factor": safety_factor,
                "recommendation": "必须重新设计！增加榫头尺寸，优化配合间隙，降低设计载荷"
            })
        elif safety_factor <= self.thresholds.safety_factor_warning:
            alerts.append({
                "type": AlertType.SAFETY_FACTOR_LOW.value,
                "severity": AlertSeverity.WARNING.value,
                "message": f"安全系数偏低！当前安全系数为 {safety_factor:.2f}",
                "safety_factor": safety_factor,
                "recommendation": "建议优化设计，适当增加安全余量"
            })

        failure_prob = stress_analysis.get("failure_probability", 0)
        if failure_prob >= self.thresholds.failure_probability_danger:
            alerts.append({
                "type": AlertType.FAILURE_PROBABILITY_HIGH.value,
                "severity": AlertSeverity.CRITICAL.value,
                "message": f"失效风险极高！预估失效概率达 {failure_prob:.1%}",
                "failure_probability": failure_prob,
                "recommendation": "停止使用此设计方案，全面重新评估结构安全性"
            })
        elif failure_prob >= self.thresholds.failure_probability_warning:
            alerts.append({
                "type": AlertType.FAILURE_PROBABILITY_HIGH.value,
                "severity": AlertSeverity.WARNING.value,
                "message": f"存在失效风险！预估失效概率为 {failure_prob:.1%}",
                "failure_probability": failure_prob,
                "recommendation": "建议进行物理试验验证，考虑加强设计"
            })

        critical_points = stress_analysis.get("critical_points", [])
        for point in critical_points:
            point_stress = abs(point.get("stress", 0))
            point_stress_ratio = point_stress / reference_strength if reference_strength > 0 else 0
            if point_stress_ratio >= 0.9:
                location = point.get("location", "unknown")
                alerts.append({
                    "type": AlertType.BONDING_RISK.value,
                    "severity": AlertSeverity.DANGER.value,
                    "message": f"临界点应力集中！位置 {location} 应力 {point_stress:.2f} MPa",
                    "location": location,
                    "point_stress": point_stress,
                    "recommendation": "优化该位置几何形状，增加过渡圆角，降低应力集中"
                })

        stress_dist = stress_analysis.get("stress_distribution", {})
        buckling_sensitivity = stress_dist.get("buckling_sensitivity", 0)
        if buckling_sensitivity > 0.5:
            alerts.append({
                "type": AlertType.BUCKLING_RISK.value,
                "severity": AlertSeverity.WARNING.value,
                "message": f"存在屈曲风险！屈曲敏感度系数为 {buckling_sensitivity:.2f}",
                "buckling_sensitivity": buckling_sensitivity,
                "recommendation": "检查长细比，考虑增加侧向支撑，优化构件截面尺寸"
            })

        return alerts

    def get_overall_risk_level(self, alerts: List[Dict[str, Any]]) -> str:
        if not alerts:
            return "SAFE"

        severities = [a["severity"] for a in alerts]
        if AlertSeverity.CRITICAL.value in severities:
            return "CRITICAL"
        if AlertSeverity.DANGER.value in severities:
            return "DANGER"
        if AlertSeverity.WARNING.value in severities:
            return "WARNING"
        return "SAFE"


def check_structure_safety(
    structure_id: int,
    stress_results: List[Dict[str, Any]],
    wood_properties: Dict[str, Any]
) -> Dict[str, Any]:
    generator = StressAlertGenerator()

    all_alerts = []
    max_risk = "SAFE"

    for stress_result in stress_results:
        alerts = generator.generate_alerts(stress_result, wood_properties)
        for alert in alerts:
            alert["analysis_id"] = stress_result.get("id")
            alert["force_direction"] = stress_result.get("force_direction")
            alert["timestamp"] = datetime.utcnow().isoformat()
        all_alerts.extend(alerts)

        risk_level = generator.get_overall_risk_level(alerts)
        if risk_level == "CRITICAL":
            max_risk = "CRITICAL"
        elif risk_level == "DANGER" and max_risk != "CRITICAL":
            max_risk = "DANGER"
        elif risk_level == "WARNING" and max_risk not in ["CRITICAL", "DANGER"]:
            max_risk = "WARNING"

    critical_count = sum(1 for a in all_alerts if a["severity"] == AlertSeverity.CRITICAL.value)
    danger_count = sum(1 for a in all_alerts if a["severity"] == AlertSeverity.DANGER.value)
    warning_count = sum(1 for a in all_alerts if a["severity"] == AlertSeverity.WARNING.value)

    return {
        "structure_id": structure_id,
        "overall_risk_level": max_risk,
        "alert_count": {
            "critical": critical_count,
            "danger": danger_count,
            "warning": warning_count,
            "total": len(all_alerts)
        },
        "alerts": all_alerts,
        "recommendations": _aggregate_recommendations(all_alerts),
        "assessment_timestamp": datetime.utcnow().isoformat()
    }


def _aggregate_recommendations(alerts: List[Dict[str, Any]]) -> List[str]:
    recommendations = set()
    for alert in alerts:
        if "recommendation" in alert:
            recommendations.add(alert["recommendation"])
    return list(recommendations)

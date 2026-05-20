import numpy as np
import open3d as o3d
from typing import Dict, List, Tuple, Optional
from enum import Enum
from datetime import datetime


class SafetyLevel(Enum):
    SAFE = "安全"
    WARNING = "警告"
    DANGER = "危险"
    CRITICAL = "严重"


class SafetyEvaluator:
    def __init__(self, nominal_thickness: Optional[float] = None):
        self.nominal_thickness = nominal_thickness
        self.thresholds = {
            'warning': 0.7,
            'danger': 0.5,
            'critical': 0.3
        }
        self.thickness_values = None
        self.wear_values = None
        self.thickness_stats = None
        self.wear_stats = None

    def set_thresholds(self, warning: float = 0.7, danger: float = 0.5, critical: float = 0.3) -> None:
        self.thresholds = {
            'warning': warning,
            'danger': danger,
            'critical': critical
        }

    def set_nominal_thickness(self, thickness: float) -> None:
        self.nominal_thickness = thickness

    def evaluate_thickness(self, thickness_values: np.ndarray) -> Dict:
        self.thickness_values = thickness_values
        valid_thickness = thickness_values[~np.isnan(thickness_values)]

        if self.nominal_thickness is None:
            self.nominal_thickness = np.median(valid_thickness)

        normalized_thickness = valid_thickness / self.nominal_thickness

        safe_mask = normalized_thickness >= self.thresholds['warning']
        warning_mask = (normalized_thickness >= self.thresholds['danger']) & (normalized_thickness < self.thresholds['warning'])
        danger_mask = (normalized_thickness >= self.thresholds['critical']) & (normalized_thickness < self.thresholds['danger'])
        critical_mask = normalized_thickness < self.thresholds['critical']

        result = {
            'nominal_thickness': self.nominal_thickness,
            'safety_level': self._determine_safety_level(np.mean(normalized_thickness)),
            'mean_normalized_thickness': float(np.mean(normalized_thickness)),
            'min_normalized_thickness': float(np.min(normalized_thickness)),
            'safe_percentage': float(np.sum(safe_mask) / len(valid_thickness) * 100),
            'warning_percentage': float(np.sum(warning_mask) / len(valid_thickness) * 100),
            'danger_percentage': float(np.sum(danger_mask) / len(valid_thickness) * 100),
            'critical_percentage': float(np.sum(critical_mask) / len(valid_thickness) * 100),
            'recommendations': self._generate_thickness_recommendations(normalized_thickness)
        }

        self.thickness_stats = result
        return result

    def evaluate_wear(self, wear_values: np.ndarray, wear_mask: np.ndarray) -> Dict:
        self.wear_values = wear_values
        self.wear_mask = wear_mask

        wear_amount = wear_values[wear_mask]
        total_points = len(wear_values)
        wear_points = np.sum(wear_mask)

        wear_percentage = wear_points / total_points * 100 if total_points > 0 else 0

        if wear_percentage < 5:
            safety_level = SafetyLevel.SAFE
        elif wear_percentage < 15:
            safety_level = SafetyLevel.WARNING
        elif wear_percentage < 30:
            safety_level = SafetyLevel.DANGER
        else:
            safety_level = SafetyLevel.CRITICAL

        result = {
            'safety_level': safety_level,
            'wear_percentage': float(wear_percentage),
            'max_wear_depth': float(np.max(wear_amount)) if len(wear_amount) > 0 else 0,
            'mean_wear_depth': float(np.mean(wear_amount)) if len(wear_amount) > 0 else 0,
            'total_worn_area_points': int(wear_points),
            'recommendations': self._generate_wear_recommendations(wear_percentage, wear_amount)
        }

        self.wear_stats = result
        return result

    def comprehensive_evaluation(self, thickness_values: np.ndarray,
                                 wear_values: np.ndarray, wear_mask: np.ndarray) -> Dict:
        thickness_result = self.evaluate_thickness(thickness_values)
        wear_result = self.evaluate_wear(wear_values, wear_mask)

        overall_score = (
            thickness_result['safe_percentage'] * 1.0 +
            thickness_result['warning_percentage'] * 0.7 +
            thickness_result['danger_percentage'] * 0.4 +
            thickness_result['critical_percentage'] * 0.1
        ) / 100

        overall_score *= (1 - wear_result['wear_percentage'] / 200)

        if overall_score >= 0.8:
            overall_level = SafetyLevel.SAFE
        elif overall_score >= 0.6:
            overall_level = SafetyLevel.WARNING
        elif overall_score >= 0.4:
            overall_level = SafetyLevel.DANGER
        else:
            overall_level = SafetyLevel.CRITICAL

        return {
            'evaluation_date': datetime.now().isoformat(),
            'overall_safety_level': overall_level,
            'overall_score': float(overall_score),
            'thickness_evaluation': thickness_result,
            'wear_evaluation': wear_result,
            'final_recommendations': self._generate_final_recommendations(overall_level)
        }

    def _determine_safety_level(self, mean_normalized_thickness: float) -> SafetyLevel:
        if mean_normalized_thickness >= self.thresholds['warning']:
            return SafetyLevel.SAFE
        elif mean_normalized_thickness >= self.thresholds['danger']:
            return SafetyLevel.WARNING
        elif mean_normalized_thickness >= self.thresholds['critical']:
            return SafetyLevel.DANGER
        else:
            return SafetyLevel.CRITICAL

    def _generate_thickness_recommendations(self, normalized_thickness: np.ndarray) -> List[str]:
        recommendations = []
        min_thickness = np.min(normalized_thickness)
        mean_thickness = np.mean(normalized_thickness)

        if min_thickness < self.thresholds['critical']:
            recommendations.append("存在严重厚度不足区域，建议立即停用并修复")
        elif min_thickness < self.thresholds['danger']:
            recommendations.append("存在危险厚度区域，建议安排维修计划")
        elif min_thickness < self.thresholds['warning']:
            recommendations.append("存在厚度警告区域，建议加强监测频率")

        if mean_thickness < 0.8:
            recommendations.append("整体平均厚度偏低，建议评估整体磨损情况")

        if not recommendations:
            recommendations.append("厚度状况良好，可继续正常使用")

        return recommendations

    def _generate_wear_recommendations(self, wear_percentage: float, wear_amount: np.ndarray) -> List[str]:
        recommendations = []

        if wear_percentage > 30:
            recommendations.append("磨损面积较大，建议进行全面检修")
        elif wear_percentage > 15:
            recommendations.append("存在明显磨损区域，建议安排局部修复")
        elif wear_percentage > 5:
            recommendations.append("存在轻微磨损，建议定期检查")

        if len(wear_amount) > 0 and np.max(wear_amount) > 0.01:
            recommendations.append("存在较深磨损坑，建议重点关注该区域")

        if not recommendations:
            recommendations.append("磨损状况良好，无明显磨损区域")

        return recommendations

    def _generate_final_recommendations(self, overall_level: SafetyLevel) -> List[str]:
        recommendations = []

        if overall_level == SafetyLevel.SAFE:
            recommendations.append("整体状况安全，可继续正常使用")
            recommendations.append("建议按正常周期进行维护保养")
        elif overall_level == SafetyLevel.WARNING:
            recommendations.append("整体状况存在警告，建议缩短检查周期")
            recommendations.append("重点关注磨损和厚度异常区域")
        elif overall_level == SafetyLevel.DANGER:
            recommendations.append("整体状况危险，建议立即安排维修")
            recommendations.append("限制设备使用，直至修复完成")
        else:
            recommendations.append("整体状况严重，必须立即停用")
            recommendations.append("进行全面检测和大修后才能使用")

        return recommendations

    def calculate_remaining_life(self, current_thickness: float, wear_rate: float = 0.001) -> float:
        if self.nominal_thickness is None:
            raise ValueError("请先设置标称厚度")

        min_allowable_thickness = self.nominal_thickness * self.thresholds['critical']

        if current_thickness <= min_allowable_thickness:
            return 0.0

        remaining_thickness = current_thickness - min_allowable_thickness
        remaining_life = remaining_thickness / wear_rate

        return max(0.0, remaining_life)

    def get_risk_zones(self, thickness_values: np.ndarray, points: np.ndarray) -> Dict[str, List[np.ndarray]]:
        if self.nominal_thickness is None:
            self.nominal_thickness = np.nanmedian(thickness_values)

        normalized = thickness_values / self.nominal_thickness

        zones = {
            'safe': points[normalized >= self.thresholds['warning']],
            'warning': points[(normalized >= self.thresholds['danger']) & (normalized < self.thresholds['warning'])],
            'danger': points[(normalized >= self.thresholds['critical']) & (normalized < self.thresholds['danger'])],
            'critical': points[normalized < self.thresholds['critical']]
        }

        return zones

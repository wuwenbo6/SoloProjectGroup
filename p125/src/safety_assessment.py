import numpy as np
from typing import Dict, List, Optional, Tuple
from enum import Enum


class SafetyLevel(Enum):
    SAFE = "SAFE"
    CAUTION = "CAUTION"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"
    UNSAFE = "UNSAFE"


class RiskCategory(Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    EXTREME = "EXTREME"


class SafetyAssessor:
    def __init__(self):
        self.thresholds = {
            'min_thickness': 0.005,
            'critical_thickness_ratio': 0.3,
            'max_wear_depth': 0.02,
            'max_wear_area_ratio': 0.15,
            'wear_rate_threshold': 0.001
        }
        self.weights = {
            'thickness': 0.4,
            'wear_depth': 0.25,
            'wear_area': 0.2,
            'wear_rate': 0.15
        }

    def set_thresholds(self, **kwargs):
        for key, value in kwargs.items():
            if key in self.thresholds:
                self.thresholds[key] = value

    def set_weights(self, **kwargs):
        for key, value in kwargs.items():
            if key in self.weights:
                self.weights[key] = value
        total = sum(self.weights.values())
        for key in self.weights:
            self.weights[key] /= total

    def assess_thickness_safety(self, thickness_stats: Dict,
                                original_thickness: Optional[float] = None) -> Dict:
        min_thick = thickness_stats.get('min_thickness', 0)
        mean_thick = thickness_stats.get('mean_thickness', 0)
        
        assessment = {
            'min_thickness': min_thick,
            'mean_thickness': mean_thick,
            'min_threshold': self.thresholds['min_thickness'],
            'meets_min_thickness': min_thick >= self.thresholds['min_thickness']
        }

        if original_thickness is not None:
            critical_thickness = original_thickness * self.thresholds['critical_thickness_ratio']
            ratio = mean_thick / original_thickness if original_thickness > 0 else 0
            
            assessment.update({
                'original_thickness': original_thickness,
                'critical_thickness': critical_thickness,
                'thickness_ratio': ratio,
                'above_critical': mean_thick >= critical_thickness
            })

            if mean_thick < critical_thickness:
                assessment['level'] = SafetyLevel.CRITICAL
            elif mean_thick < 1.5 * critical_thickness:
                assessment['level'] = SafetyLevel.WARNING
            elif mean_thick < 2 * critical_thickness:
                assessment['level'] = SafetyLevel.CAUTION
            else:
                assessment['level'] = SafetyLevel.SAFE
        else:
            if min_thick < self.thresholds['min_thickness']:
                assessment['level'] = SafetyLevel.CRITICAL
            elif min_thick < 2 * self.thresholds['min_thickness']:
                assessment['level'] = SafetyLevel.WARNING
            else:
                assessment['level'] = SafetyLevel.SAFE

        assessment['score'] = self._calculate_thickness_score(assessment)
        return assessment

    def _calculate_thickness_score(self, assessment: Dict) -> float:
        ratio = assessment.get('thickness_ratio', 1.0)
        
        if ratio >= 0.8:
            return 100
        elif ratio >= 0.6:
            return 80
        elif ratio >= 0.4:
            return 60
        elif ratio >= self.thresholds['critical_thickness_ratio']:
            return 40
        else:
            return 20

    def assess_wear_safety(self, wear_metrics: Dict) -> Dict:
        max_depth = abs(wear_metrics.get('max_wear_depth', 0))
        wear_ratio = wear_metrics.get('wear_ratio', 0)
        num_regions = wear_metrics.get('num_wear_regions', 0)
        
        assessment = {
            'max_wear_depth': max_depth,
            'wear_ratio': wear_ratio,
            'num_wear_regions': num_regions,
            'depth_threshold': self.thresholds['max_wear_depth'],
            'area_threshold': self.thresholds['max_wear_area_ratio']
        }

        depth_risk = self._assess_wear_depth_risk(max_depth)
        area_risk = self._assess_wear_area_risk(wear_ratio)

        assessment['depth_risk'] = depth_risk
        assessment['area_risk'] = area_risk

        risk_levels = [depth_risk, area_risk]
        if RiskCategory.EXTREME in risk_levels:
            overall_risk = RiskCategory.EXTREME
        elif RiskCategory.HIGH in risk_levels:
            overall_risk = RiskCategory.HIGH
        elif RiskCategory.MEDIUM in risk_levels:
            overall_risk = RiskCategory.MEDIUM
        else:
            overall_risk = RiskCategory.LOW

        assessment['overall_risk'] = overall_risk
        assessment['score'] = self._calculate_wear_score(max_depth, wear_ratio)

        return assessment

    def _assess_wear_depth_risk(self, depth: float) -> RiskCategory:
        threshold = self.thresholds['max_wear_depth']
        if depth >= 2 * threshold:
            return RiskCategory.EXTREME
        elif depth >= 1.5 * threshold:
            return RiskCategory.HIGH
        elif depth >= threshold:
            return RiskCategory.MEDIUM
        else:
            return RiskCategory.LOW

    def _assess_wear_area_risk(self, ratio: float) -> RiskCategory:
        threshold = self.thresholds['max_wear_area_ratio']
        if ratio >= 2 * threshold:
            return RiskCategory.EXTREME
        elif ratio >= 1.5 * threshold:
            return RiskCategory.HIGH
        elif ratio >= threshold:
            return RiskCategory.MEDIUM
        else:
            return RiskCategory.LOW

    def _calculate_wear_score(self, depth: float, ratio: float) -> float:
        depth_score = 100 * (1 - min(depth / (2 * self.thresholds['max_wear_depth']), 1))
        area_score = 100 * (1 - min(ratio / (2 * self.thresholds['max_wear_area_ratio']), 1))
        return 0.6 * depth_score + 0.4 * area_score

    def assess_overall_safety(self, thickness_assessment: Dict,
                              wear_assessment: Dict) -> Dict:
        thickness_score = thickness_assessment.get('score', 50)
        wear_score = wear_assessment.get('score', 50)

        overall_score = (self.weights['thickness'] * thickness_score +
                         self.weights['wear_depth'] * wear_score)

        if overall_score >= 80:
            overall_level = SafetyLevel.SAFE
        elif overall_score >= 60:
            overall_level = SafetyLevel.CAUTION
        elif overall_score >= 40:
            overall_level = SafetyLevel.WARNING
        elif overall_score >= 20:
            overall_level = SafetyLevel.CRITICAL
        else:
            overall_level = SafetyLevel.UNSAFE

        recommendations = self._generate_recommendations(
            thickness_assessment, wear_assessment, overall_level
        )

        assessment = {
            'overall_score': overall_score,
            'overall_level': overall_level,
            'thickness_score': thickness_score,
            'wear_score': wear_score,
            'recommendations': recommendations,
            'needs_inspection': overall_level in [SafetyLevel.WARNING, SafetyLevel.CRITICAL, SafetyLevel.UNSAFE],
            'needs_immediate_action': overall_level in [SafetyLevel.CRITICAL, SafetyLevel.UNSAFE]
        }

        return assessment

    def _generate_recommendations(self, thickness_assessment: Dict,
                                  wear_assessment: Dict,
                                  overall_level: SafetyLevel) -> List[str]:
        recommendations = []

        if not thickness_assessment.get('meets_min_thickness', True):
            recommendations.append("Minimum thickness requirement not met - immediate replacement required")

        if thickness_assessment.get('level') == SafetyLevel.CRITICAL:
            recommendations.append("Thickness at critical level - schedule immediate replacement")
        elif thickness_assessment.get('level') == SafetyLevel.WARNING:
            recommendations.append("Thickness approaching critical level - increase inspection frequency")

        wear_risk = wear_assessment.get('overall_risk', RiskCategory.LOW)
        if wear_risk == RiskCategory.EXTREME:
            recommendations.append("Extreme wear detected - component replacement recommended")
        elif wear_risk == RiskCategory.HIGH:
            recommendations.append("High wear detected - consider component replacement soon")
        elif wear_risk == RiskCategory.MEDIUM:
            recommendations.append("Moderate wear detected - monitor closely")

        if overall_level == SafetyLevel.SAFE:
            recommendations.append("Component in good condition - continue regular inspections")
        elif overall_level == SafetyLevel.CAUTION:
            recommendations.append("Component showing signs of wear - increase monitoring frequency")

        return recommendations

    def assess_fatigue_life(self, thickness_values: np.ndarray,
                            load_cycles: int,
                            material_fatigue_coefficient: float = 1.0,
                            stress_concentration_factor: float = 1.5) -> Dict:
        mean_thickness = np.mean(thickness_values[thickness_values > 0])
        
        estimated_stress = stress_concentration_factor * load_cycles / (mean_thickness * material_fatigue_coefficient)
        
        fatigue_damage_ratio = min(estimated_stress / 1000, 1.0)
        
        remaining_cycles = load_cycles * (1 - fatigue_damage_ratio) / (fatigue_damage_ratio + 1e-8)

        if fatigue_damage_ratio < 0.3:
            fatigue_level = SafetyLevel.SAFE
        elif fatigue_damage_ratio < 0.5:
            fatigue_level = SafetyLevel.CAUTION
        elif fatigue_damage_ratio < 0.7:
            fatigue_level = SafetyLevel.WARNING
        else:
            fatigue_level = SafetyLevel.CRITICAL

        assessment = {
            'mean_thickness': mean_thickness,
            'load_cycles': load_cycles,
            'fatigue_damage_ratio': fatigue_damage_ratio,
            'estimated_remaining_cycles': remaining_cycles,
            'fatigue_level': fatigue_level,
            'material_factor': material_fatigue_coefficient,
            'stress_factor': stress_concentration_factor
        }

        return assessment

    def generate_safety_summary(self, all_assessments: Dict) -> Dict:
        overall = all_assessments.get('overall', {})
        thickness = all_assessments.get('thickness', {})
        wear = all_assessments.get('wear', {})

        summary = {
            'safety_score': overall.get('overall_score', 0),
            'safety_level': overall.get('overall_level', SafetyLevel.UNSAFE),
            'is_safe': overall.get('overall_level') == SafetyLevel.SAFE,
            'needs_inspection': overall.get('needs_inspection', True),
            'needs_immediate_action': overall.get('needs_immediate_action', False),
            'key_findings': []
        }

        if thickness.get('level') == SafetyLevel.CRITICAL:
            summary['key_findings'].append("Critical thickness condition detected")
        if wear.get('overall_risk') in [RiskCategory.HIGH, RiskCategory.EXTREME]:
            summary['key_findings'].append("High wear risk detected")

        summary['recommendations'] = overall.get('recommendations', [])

        return summary

    def calculate_risk_priority(self, safety_summary: Dict) -> int:
        level = safety_summary.get('safety_level', SafetyLevel.UNSAFE)
        
        priority_map = {
            SafetyLevel.SAFE: 4,
            SafetyLevel.CAUTION: 3,
            SafetyLevel.WARNING: 2,
            SafetyLevel.CRITICAL: 1,
            SafetyLevel.UNSAFE: 0
        }

        return priority_map.get(level, 0)


__all__ = ['SafetyAssessor', 'SafetyLevel', 'RiskCategory']

import numpy as np
from typing import Dict, List, Tuple, Optional
from enum import Enum
from dataclasses import dataclass


class PaperGrade(Enum):
    ARCHIVAL = "archival"
    HIGH_QUALITY = "high_quality"
    STANDARD = "standard"
    LOW_QUALITY = "low_quality"
    DETERIORATED = "deteriorated"


class StrengthCondition(Enum):
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"
    CRITICAL = "critical"


@dataclass
class StrengthMetrics:
    tensile_strength: float
    tear_resistance: float
    burst_strength: float
    folding_endurance: int
    stiffness: float
    cohesion_strength: float
    fiber_integrity: float
    ph_level: float
    brittleness_index: float


class PaperStrengthEstimator:
    def __init__(self):
        self.grade_models = {
            PaperGrade.ARCHIVAL: {
                'tensile_base': 8000,
                'tear_base': 150,
                'burst_base': 400,
                'folding_base': 5000,
                'stiffness_base': 100,
                'degradation_rate': 0.02
            },
            PaperGrade.HIGH_QUALITY: {
                'tensile_base': 6000,
                'tear_base': 120,
                'burst_base': 350,
                'folding_base': 3000,
                'stiffness_base': 80,
                'degradation_rate': 0.03
            },
            PaperGrade.STANDARD: {
                'tensile_base': 4500,
                'tear_base': 90,
                'burst_base': 280,
                'folding_base': 1500,
                'stiffness_base': 60,
                'degradation_rate': 0.05
            },
            PaperGrade.LOW_QUALITY: {
                'tensile_base': 3000,
                'tear_base': 60,
                'burst_base': 200,
                'folding_base': 500,
                'stiffness_base': 40,
                'degradation_rate': 0.08
            },
            PaperGrade.DETERIORATED: {
                'tensile_base': 1500,
                'tear_base': 30,
                'burst_base': 100,
                'folding_base': 100,
                'stiffness_base': 20,
                'degradation_rate': 0.12
            }
        }
        
        self.damage_factors = {
            'tear_density': 1.0,
            'hole_count': 0.8,
            'crease_severity': 0.6,
            'stain_impact': 0.5,
            'surface_roughness': 0.4,
            'edge_wear': 0.7
        }
        
        self.environmental_factors = {
            'temperature_high': 1.3,
            'humidity_high': 1.4,
            'light_exposure': 1.2,
            'pollution_level': 1.15,
            'handling_frequency': 1.25
        }

    def estimate_strength(self, point_cloud_data: np.ndarray,
                          paper_grade: PaperGrade = PaperGrade.STANDARD,
                          age_years: float = 0,
                          damage_analysis: Optional[Dict] = None,
                          environmental_history: Optional[Dict] = None) -> Dict:
        if damage_analysis is None:
            damage_analysis = self._analyze_damage_from_pointcloud(point_cloud_data)
        
        if environmental_history is None:
            environmental_history = {
                'temperature_high': False,
                'humidity_high': False,
                'light_exposure': False,
                'pollution_level': 'low',
                'handling_frequency': 'low'
            }
        
        surface_metrics = self._analyze_surface_properties(point_cloud_data)
        
        grade_params = self.grade_models[paper_grade]
        
        age_degradation = 1.0 - min(age_years * grade_params['degradation_rate'] / 100, 0.95)
        
        env_factor = self._calculate_environmental_factor(environmental_history)
        
        damage_factor = self._calculate_damage_factor(damage_analysis)
        
        surface_factor = self._calculate_surface_factor(surface_metrics)
        
        total_degradation = age_degradation * env_factor * damage_factor * surface_factor
        
        tensile_strength = grade_params['tensile_base'] * total_degradation
        tear_resistance = grade_params['tear_base'] * total_degradation
        burst_strength = grade_params['burst_base'] * total_degradation
        folding_endurance = int(grade_params['folding_base'] * total_degradation)
        stiffness = grade_params['stiffness_base'] * total_degradation
        
        cohesion_strength = self._calculate_cohesion_strength(
            tensile_strength, tear_resistance, surface_metrics
        )
        
        fiber_integrity = self._calculate_fiber_integrity(
            surface_metrics, age_degradation, damage_factor
        )
        
        ph_level = self._estimate_ph_level(age_years, environmental_history)
        
        brittleness_index = self._calculate_brittleness_index(
            tensile_strength, stiffness, folding_endurance
        )
        
        metrics = StrengthMetrics(
            tensile_strength=tensile_strength,
            tear_resistance=tear_resistance,
            burst_strength=burst_strength,
            folding_endurance=folding_endurance,
            stiffness=stiffness,
            cohesion_strength=cohesion_strength,
            fiber_integrity=fiber_integrity,
            ph_level=ph_level,
            brittleness_index=brittleness_index
        )
        
        overall_score = self._calculate_overall_strength_score(metrics)
        
        condition = self._determine_strength_condition(overall_score)
        
        remaining_life = self._estimate_remaining_life(
            metrics, overall_score, age_years, environmental_history
        )
        
        critical_weak_points = self._identify_critical_weak_points(
            point_cloud_data, damage_analysis, metrics
        )
        
        return {
            'paper_grade': paper_grade.value,
            'age_years': age_years,
            'strength_metrics': metrics.__dict__,
            'overall_strength_score': overall_score,
            'condition': condition.value,
            'remaining_life_estimate': remaining_life,
            'degradation_factors': {
                'age_degradation': age_degradation,
                'environmental_factor': env_factor,
                'damage_factor': damage_factor,
                'surface_factor': surface_factor,
                'total_degradation': total_degradation
            },
            'surface_analysis': surface_metrics,
            'damage_analysis': damage_analysis,
            'critical_weak_points': critical_weak_points,
            'recommendations': self._generate_strength_recommendations(
                condition, metrics, remaining_life
            )
        }

    def _analyze_damage_from_pointcloud(self, points: np.ndarray) -> Dict:
        if len(points) < 100:
            return {
                'tear_density': 0.0,
                'hole_count': 0,
                'crease_severity': 0.0,
                'stain_impact': 0.0,
                'surface_roughness': 0.1,
                'edge_wear': 0.0
            }
        
        heights = points[:, 2]
        mean_height = np.mean(heights)
        std_height = np.std(heights)
        
        roughness = std_height / max(abs(mean_height), 1e-6)
        
        deep_dents = np.sum(heights < mean_height - 3 * std_height)
        tear_density = deep_dents / len(points)
        
        gradient = np.gradient(heights)
        sharp_changes = np.sum(np.abs(gradient) > 2 * std_height)
        crease_severity = sharp_changes / len(points)
        
        hole_count = int(tear_density * 100) if tear_density > 0.01 else 0
        
        stain_impact = min(roughness * 2, 1.0)
        
        edge_wear = min(crease_severity * 5, 1.0)
        
        return {
            'tear_density': float(tear_density),
            'hole_count': int(hole_count),
            'crease_severity': float(crease_severity),
            'stain_impact': float(stain_impact),
            'surface_roughness': float(roughness),
            'edge_wear': float(edge_wear)
        }

    def _analyze_surface_properties(self, points: np.ndarray) -> Dict:
        if len(points) < 10:
            return {
                'roughness_ra': 0.1,
                'roughness_rms': 0.15,
                'peak_to_valley': 0.2,
                'skewness': 0.0,
                'kurtosis': 3.0,
                'surface_uniformity': 0.9
            }
        
        heights = points[:, 2]
        mean_height = np.mean(heights)
        centered = heights - mean_height
        
        ra = np.mean(np.abs(centered))
        rms = np.sqrt(np.mean(centered**2))
        peak_to_valley = np.max(heights) - np.min(heights)
        
        skewness = np.mean(centered**3) / (rms**3) if rms > 0 else 0
        kurtosis = np.mean(centered**4) / (rms**4) if rms > 0 else 3
        
        uniformity = 1.0 - min(ra * 10, 0.9)
        
        return {
            'roughness_ra': float(ra),
            'roughness_rms': float(rms),
            'peak_to_valley': float(peak_to_valley),
            'skewness': float(skewness),
            'kurtosis': float(kurtosis),
            'surface_uniformity': float(uniformity)
        }

    def _calculate_environmental_factor(self, env_history: Dict) -> float:
        factor = 1.0
        
        if env_history.get('temperature_high', False):
            factor *= self.environmental_factors['temperature_high']
        
        if env_history.get('humidity_high', False):
            factor *= self.environmental_factors['humidity_high']
        
        if env_history.get('light_exposure', False):
            factor *= self.environmental_factors['light_exposure']
        
        pollution = env_history.get('pollution_level', 'low')
        if pollution == 'medium':
            factor *= 1.05
        elif pollution == 'high':
            factor *= self.environmental_factors['pollution_level']
        
        handling = env_history.get('handling_frequency', 'low')
        if handling == 'medium':
            factor *= 1.1
        elif handling == 'high':
            factor *= self.environmental_factors['handling_frequency']
        
        return 1.0 / factor

    def _calculate_damage_factor(self, damage: Dict) -> float:
        total_impact = 0.0
        total_weight = 0.0
        
        for factor, weight in self.damage_factors.items():
            value = damage.get(factor, 0.0)
            if factor == 'hole_count':
                value = min(value / 10, 1.0)
            
            impact = 1.0 - min(value * weight, 0.9)
            total_impact += impact * weight
            total_weight += weight
        
        return total_impact / total_weight if total_weight > 0 else 1.0

    def _calculate_surface_factor(self, surface: Dict) -> float:
        uniformity = surface.get('surface_uniformity', 0.5)
        roughness = surface.get('roughness_ra', 0.1)
        
        roughness_factor = max(1.0 - roughness * 5, 0.3)
        
        return (uniformity + roughness_factor) / 2

    def _calculate_cohesion_strength(self, tensile: float, tear: float,
                                      surface: Dict) -> float:
        uniformity = surface.get('surface_uniformity', 0.5)
        fiber_bond = (tensile / 100 + tear) / 2
        cohesion = fiber_bond * uniformity
        return min(cohesion, 100.0)

    def _calculate_fiber_integrity(self, surface: Dict, age_degradation: float,
                                    damage_factor: float) -> float:
        uniformity = surface.get('surface_uniformity', 0.5)
        kurtosis = surface.get('kurtosis', 3.0)
        
        kurtosis_factor = 1.0 - min(abs(kurtosis - 3.0) / 5, 0.5)
        
        integrity = uniformity * kurtosis_factor * age_degradation * damage_factor
        return min(integrity * 100, 100.0)

    def _estimate_ph_level(self, age_years: float, env_history: Dict) -> float:
        base_ph = 7.0
        
        acidification = age_years * 0.03
        
        if env_history.get('humidity_high', False):
            acidification *= 1.5
        
        if env_history.get('pollution_level', 'low') == 'high':
            acidification *= 1.3
        
        estimated_ph = max(4.0, base_ph - acidification)
        
        return estimated_ph

    def _calculate_brittleness_index(self, tensile: float, stiffness: float,
                                       folding: int) -> float:
        normalized_tensile = min(tensile / 8000, 1.0)
        normalized_stiffness = min(stiffness / 100, 1.0)
        normalized_folding = min(folding / 5000, 1.0)
        
        ductility = (normalized_tensile + normalized_folding) / 2
        brittleness = (1.0 - ductility) * normalized_stiffness * 100
        
        return min(brittleness, 100.0)

    def _calculate_overall_strength_score(self, metrics: StrengthMetrics) -> float:
        weights = {
            'tensile_strength': 0.25,
            'tear_resistance': 0.20,
            'burst_strength': 0.15,
            'folding_endurance': 0.15,
            'stiffness': 0.10,
            'cohesion_strength': 0.10,
            'fiber_integrity': 0.05
        }
        
        normalized_values = {
            'tensile_strength': min(metrics.tensile_strength / 8000, 1.0) * 100,
            'tear_resistance': min(metrics.tear_resistance / 150, 1.0) * 100,
            'burst_strength': min(metrics.burst_strength / 400, 1.0) * 100,
            'folding_endurance': min(metrics.folding_endurance / 5000, 1.0) * 100,
            'stiffness': min(metrics.stiffness / 100, 1.0) * 100,
            'cohesion_strength': metrics.cohesion_strength,
            'fiber_integrity': metrics.fiber_integrity
        }
        
        score = sum(normalized_values[key] * weights[key] for key in weights)
        
        return score

    def _determine_strength_condition(self, score: float) -> StrengthCondition:
        if score >= 80:
            return StrengthCondition.EXCELLENT
        elif score >= 65:
            return StrengthCondition.GOOD
        elif score >= 45:
            return StrengthCondition.FAIR
        elif score >= 25:
            return StrengthCondition.POOR
        else:
            return StrengthCondition.CRITICAL

    def _estimate_remaining_life(self, metrics: StrengthMetrics, score: float,
                                   current_age: float, env_history: Dict) -> Dict:
        base_life_expectancy = {
            PaperGrade.ARCHIVAL: 500,
            PaperGrade.HIGH_QUALITY: 200,
            PaperGrade.STANDARD: 100,
            PaperGrade.LOW_QUALITY: 50,
            PaperGrade.DETERIORATED: 20
        }
        
        env_multiplier = self._calculate_environmental_factor(env_history)
        score_factor = score / 100
        
        grade = PaperGrade.STANDARD
        if score >= 80:
            grade = PaperGrade.ARCHIVAL
        elif score >= 65:
            grade = PaperGrade.HIGH_QUALITY
        elif score >= 45:
            grade = PaperGrade.STANDARD
        elif score >= 25:
            grade = PaperGrade.LOW_QUALITY
        
        max_life = base_life_expectancy[grade]
        remaining = max(0, (max_life - current_age) * score_factor * env_multiplier)
        
        life_stages = {
            'immediate_critical': remaining < 5,
            'attention_needed': remaining < 20,
            'monitoring_required': remaining < 50,
            'stable': remaining >= 50
        }
        
        return {
            'estimated_years_remaining': float(remaining),
            'life_stages': life_stages,
            'confidence': 'medium' if score > 50 else 'low',
            'max_potential_lifespan': float(max_life)
        }

    def _identify_critical_weak_points(self, points: np.ndarray, damage: Dict,
                                        metrics: StrengthMetrics) -> List[Dict]:
        weak_points = []
        
        if damage.get('tear_density', 0) > 0.05 or damage.get('hole_count', 0) > 0:
            weak_points.append({
                'type': 'structural_damage',
                'severity': 'high' if damage.get('tear_density', 0) > 0.1 else 'medium',
                'location': 'edge_regions',
                'impact_on_strength': 0.3,
                'recommendation': 'repair_tears'
            })
        
        if metrics.brittleness_index > 60:
            weak_points.append({
                'type': 'high_brittleness',
                'severity': 'high' if metrics.brittleness_index > 80 else 'medium',
                'location': 'entire_surface',
                'impact_on_strength': 0.4,
                'recommendation': 'reduce_handling'
            })
        
        if metrics.ph_level < 5.0:
            weak_points.append({
                'type': 'acidic_deterioration',
                'severity': 'high' if metrics.ph_level < 4.5 else 'medium',
                'location': 'fiber_matrix',
                'impact_on_strength': 0.35,
                'recommendation': 'deacidification'
            })
        
        if metrics.fiber_integrity < 50:
            weak_points.append({
                'type': 'fiber_degradation',
                'severity': 'high' if metrics.fiber_integrity < 30 else 'medium',
                'location': 'fiber_structure',
                'impact_on_strength': 0.45,
                'recommendation': 'consolidation_treatment'
            })
        
        return weak_points

    def _generate_strength_recommendations(self, condition: StrengthCondition,
                                            metrics: StrengthMetrics,
                                            life_estimate: Dict) -> List[str]:
        recommendations = []
        
        condition_advice = {
            StrengthCondition.EXCELLENT: "纸张状态极佳，继续常规保存即可",
            StrengthCondition.GOOD: "纸张状态良好，建议维持当前保存条件",
            StrengthCondition.FAIR: "纸张强度中等，建议改善保存环境",
            StrengthCondition.POOR: "纸张强度较差，需要采取保护措施",
            StrengthCondition.CRITICAL: "纸张强度临界，急需专业修复处理"
        }
        recommendations.append(condition_advice[condition])
        
        if metrics.ph_level < 5.5:
            recommendations.append("建议进行脱酸处理以阻止进一步酸化")
        
        if metrics.brittleness_index > 50:
            recommendations.append("纸张脆性较高，应减少翻页和操作频率")
        
        if metrics.fiber_integrity < 60:
            recommendations.append("纤维完整性下降，考虑使用加固衬纸")
        
        remaining = life_estimate.get('estimated_years_remaining', 0)
        if remaining < 10:
            recommendations.append("剩余寿命较短，建议制作数字化副本")
        elif remaining < 30:
            recommendations.append("建议制定中期保护计划")
        
        if condition in [StrengthCondition.POOR, StrengthCondition.CRITICAL]:
            recommendations.append("强烈建议咨询专业纸质文物保护人员")
        
        return recommendations

    def batch_estimate_strength(self, point_clouds: List[np.ndarray],
                                 paper_grades: Optional[List[PaperGrade]] = None,
                                 ages: Optional[List[float]] = None) -> List[Dict]:
        if paper_grades is None:
            paper_grades = [PaperGrade.STANDARD] * len(point_clouds)
        if ages is None:
            ages = [0.0] * len(point_clouds)
        
        results = []
        for pc, grade, age in zip(point_clouds, paper_grades, ages):
            result = self.estimate_strength(pc, grade, age)
            results.append(result)
        
        return results

    def compare_strength_profiles(self, results: List[Dict]) -> Dict:
        if len(results) < 2:
            return {'comparison': 'insufficient_data'}
        
        scores = [r['overall_strength_score'] for r in results]
        conditions = [r['condition'] for r in results]
        remaining_lives = [r['remaining_life_estimate']['estimated_years_remaining'] for r in results]
        
        comparison = {
            'num_samples': len(results),
            'average_score': float(np.mean(scores)),
            'min_score': float(np.min(scores)),
            'max_score': float(np.max(scores)),
            'score_std': float(np.std(scores)),
            'condition_distribution': {},
            'average_remaining_life': float(np.mean(remaining_lives)),
            'trend': self._assess_collection_trend(scores)
        }
        
        for cond in conditions:
            comparison['condition_distribution'][cond] = conditions.count(cond) / len(conditions)
        
        return comparison

    def _assess_collection_trend(self, scores: List[float]) -> str:
        if len(scores) < 3:
            return 'insufficient_data_for_trend'
        
        sorted_scores = sorted(scores)
        lowest_25p = sorted_scores[:max(1, len(scores) // 4)]
        
        if np.mean(lowest_25p) < 40:
            return 'needs_attention'
        elif np.mean(scores) > 70:
            return 'generally_healthy'
        else:
            return 'mixed_condition'


__all__ = ['PaperStrengthEstimator', 'PaperGrade', 'StrengthCondition', 'StrengthMetrics']

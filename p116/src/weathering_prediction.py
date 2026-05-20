import numpy as np
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import warnings


class MaterialType(Enum):
    """材料类型枚举"""
    CONCRETE = "concrete"
    STEEL = "steel"
    STONE = "stone"
    BRICK = "brick"
    WOOD = "wood"
    COMPOSITE = "composite"


class WeatheringGrade(Enum):
    """风化等级枚举"""
    GRADE_0 = "无风化"
    GRADE_1 = "轻微风化"
    GRADE_2 = "中度风化"
    GRADE_3 = "严重风化"
    GRADE_4 = "极端风化"


@dataclass
class WeatheringPrediction:
    """风化预测结果数据类"""
    point_index: int
    current_grade: WeatheringGrade
    predicted_grade: WeatheringGrade
    years_to_critical: float
    weathering_rate: float
    confidence: float
    risk_level: str


@dataclass
class TimeSeriesPrediction:
    """时间序列预测结果"""
    year: int
    average_grade: float
    critical_area_ratio: float
    maintenance_urgency: float


class WeatheringPredictor:
    """
    风化预测类
    
    基于点云几何特征、厚度数据和缺损信息，结合材料特性，
    预测未来风化发展趋势
    """
    
    # 材料风化系数 (每年)
    MATERIAL_WEATHERING_COEFFICIENTS = {
        MaterialType.CONCRETE: 0.05,
        MaterialType.STEEL: 0.08,
        MaterialType.STONE: 0.02,
        MaterialType.BRICK: 0.06,
        MaterialType.WOOD: 0.10,
        MaterialType.COMPOSITE: 0.04
    }
    
    # 环境影响系数
    ENVIRONMENT_FACTORS = {
        'normal': 1.0,
        'coastal': 1.5,
        'industrial': 2.0,
        'desert': 1.3,
        'tropical': 1.8
    }
    
    def __init__(self,
                 material_type: MaterialType = MaterialType.CONCRETE,
                 environment: str = 'normal',
                 design_life: float = 50.0):
        """
        初始化风化预测器
        
        Args:
            material_type: 材料类型
            environment: 环境类型
            design_life: 设计使用年限
        """
        self.material_type = material_type
        self.environment = environment
        self.design_life = design_life
        self.predictions: List[WeatheringPrediction] = []
        self.time_series: List[TimeSeriesPrediction] = []
        
    def assess_current_weathering(self,
                                   points: np.ndarray,
                                   thickness_values: np.ndarray,
                                   defect_labels: np.ndarray,
                                   normals: Optional[np.ndarray] = None) -> np.ndarray:
        """
        评估当前风化程度
        
        Args:
            points: 点云坐标
            thickness_values: 厚度值数组
            defect_labels: 缺损标签数组
            normals: 法向量数组
            
        Returns:
            当前风化分数数组
        """
        n_points = len(points)
        weathering_scores = np.zeros(n_points)
        
        valid_mask = thickness_values > 0
        mean_thickness = np.mean(thickness_values[valid_mask]) if np.any(valid_mask) else 1.0
        
        for i in range(n_points):
            score = 0.0
            
            if thickness_values[i] > 0:
                thickness_ratio = thickness_values[i] / mean_thickness
                thickness_score = max(0, 1 - thickness_ratio) * 30
                score += thickness_score
            
            if defect_labels[i] > 0:
                score += 40
            
            if normals is not None:
                surface_roughness = self._estimate_local_roughness(points, i, normals)
                score += surface_roughness * 30
            
            weathering_scores[i] = min(100, score)
        
        return weathering_scores
    
    def _estimate_local_roughness(self,
                                   points: np.ndarray,
                                   idx: int,
                                   normals: np.ndarray,
                                   k: int = 20) -> float:
        """
        估计局部粗糙度
        
        Args:
            points: 点云坐标
            idx: 点索引
            normals: 法向量
            k: 邻域点数
            
        Returns:
            粗糙度值 (0-1)
        """
        try:
            from scipy.spatial import KDTree
            tree = KDTree(points)
            distances, indices = tree.query(points[idx], k=k)
            
            neighbor_normals = normals[indices]
            normal_var = np.var(neighbor_normals, axis=0)
            roughness = np.sum(normal_var)
            
            return min(1.0, roughness * 5)
        except:
            return 0.5
    
    def predict_weathering(self,
                           points: np.ndarray,
                           thickness_values: np.ndarray,
                           defect_labels: np.ndarray,
                           normals: Optional[np.ndarray] = None,
                           prediction_years: int = 20) -> Tuple[List[WeatheringPrediction], np.ndarray]:
        """
        预测风化发展
        
        Args:
            points: 点云坐标
            thickness_values: 厚度值数组
            defect_labels: 缺损标签数组
            normals: 法向量数组
            prediction_years: 预测年数
            
        Returns:
            (预测列表, 预测分数数组)
        """
        n_points = len(points)
        current_scores = self.assess_current_weathering(
            points, thickness_values, defect_labels, normals
        )
        
        base_rate = self.MATERIAL_WEATHERING_COEFFICIENTS[self.material_type]
        env_factor = self.ENVIRONMENT_FACTORS.get(self.environment, 1.0)
        
        predicted_scores = np.zeros(n_points)
        predictions = []
        
        for i in range(n_points):
            current_score = current_scores[i]
            
            local_factor = 1.0
            if defect_labels[i] > 0:
                local_factor = 1.5
            if thickness_values[i] > 0:
                thickness_factor = max(0.5, 1 - thickness_values[i] / (np.max(thickness_values) + 1e-6))
                local_factor *= (1 + thickness_factor)
            
            weathering_rate = base_rate * env_factor * local_factor
            
            predicted_score = current_score + (weathering_rate * prediction_years * 5)
            predicted_score = min(100, predicted_score)
            predicted_scores[i] = predicted_score
            
            current_grade = self._score_to_grade(current_score)
            predicted_grade = self._score_to_grade(predicted_score)
            
            if predicted_score >= 70:
                years_to_critical = (70 - current_score) / (weathering_rate * 5) if weathering_rate > 0 else float('inf')
            else:
                years_to_critical = (70 - current_score) / (weathering_rate * 5) if weathering_rate > 0 else float('inf')
            years_to_critical = max(0, years_to_critical)
            
            confidence = min(0.95, 0.5 + (1 - abs(weathering_rate - base_rate) / base_rate) * 0.5)
            
            risk_level = self._calculate_risk_level(predicted_score, years_to_critical)
            
            predictions.append(WeatheringPrediction(
                point_index=i,
                current_grade=current_grade,
                predicted_grade=predicted_grade,
                years_to_critical=years_to_critical,
                weathering_rate=weathering_rate,
                confidence=confidence,
                risk_level=risk_level
            ))
        
        self.predictions = predictions
        self._generate_time_series(current_scores, base_rate * env_factor, prediction_years)
        
        return predictions, predicted_scores
    
    def _score_to_grade(self, score: float) -> WeatheringGrade:
        """将分数转换为风化等级"""
        if score < 15:
            return WeatheringGrade.GRADE_0
        elif score < 35:
            return WeatheringGrade.GRADE_1
        elif score < 55:
            return WeatheringGrade.GRADE_2
        elif score < 75:
            return WeatheringGrade.GRADE_3
        else:
            return WeatheringGrade.GRADE_4
    
    def _calculate_risk_level(self, predicted_score: float, years_to_critical: float) -> str:
        """计算风险等级"""
        if predicted_score >= 70:
            return "critical"
        elif predicted_score >= 50 and years_to_critical < 10:
            return "high"
        elif predicted_score >= 30:
            return "medium"
        else:
            return "low"
    
    def _generate_time_series(self, current_scores: np.ndarray, base_rate: float, max_years: int):
        """生成时间序列预测"""
        self.time_series = []
        
        for year in range(0, max_years + 1, 2):
            degradation_factor = 1 + (base_rate * year * 0.5)
            
            avg_score = np.mean(current_scores) * degradation_factor
            avg_score = min(100, avg_score)
            
            critical_count = np.sum(current_scores * degradation_factor >= 70)
            critical_ratio = critical_count / len(current_scores)
            
            if critical_ratio > 0.3:
                urgency = 1.0
            elif critical_ratio > 0.1:
                urgency = critical_ratio * 3
            else:
                urgency = max_years / (max_years + 1)
            
            self.time_series.append(TimeSeriesPrediction(
                year=year,
                average_grade=avg_score / 25,
                critical_area_ratio=critical_ratio,
                maintenance_urgency=urgency
            ))
    
    def get_weathering_summary(self) -> Dict:
        """获取风化预测摘要"""
        if not self.predictions:
            return {}
        
        n_points = len(self.predictions)
        
        current_grade_counts = {}
        predicted_grade_counts = {}
        risk_counts = {}
        
        total_rate = 0.0
        critical_years = []
        
        for pred in self.predictions:
            current_grade = pred.current_grade.value
            predicted_grade = pred.predicted_grade.value
            risk = pred.risk_level
            
            current_grade_counts[current_grade] = current_grade_counts.get(current_grade, 0) + 1
            predicted_grade_counts[predicted_grade] = predicted_grade_counts.get(predicted_grade, 0) + 1
            risk_counts[risk] = risk_counts.get(risk, 0) + 1
            
            total_rate += pred.weathering_rate
            if pred.years_to_critical < float('inf'):
                critical_years.append(pred.years_to_critical)
        
        return {
            'material_type': self.material_type.value,
            'environment': self.environment,
            'design_life': self.design_life,
            'current_grades': {k: v/n_points for k, v in current_grade_counts.items()},
            'predicted_grades': {k: v/n_points for k, v in predicted_grade_counts.items()},
            'risk_distribution': {k: v/n_points for k, v in risk_counts.items()},
            'average_weathering_rate': total_rate / n_points,
            'average_years_to_critical': np.mean(critical_years) if critical_years else float('inf'),
            'high_risk_percentage': risk_counts.get('high', 0) / n_points + risk_counts.get('critical', 0) / n_points
        }
    
    def get_recommendations(self) -> List[Dict]:
        """获取基于风化预测的维护建议"""
        summary = self.get_weathering_summary()
        recommendations = []
        
        high_risk = summary.get('high_risk_percentage', 0)
        avg_rate = summary.get('average_weathering_rate', 0)
        
        if high_risk > 0.3:
            recommendations.append({
                'priority': 'critical',
                'category': '紧急维护',
                'action': '立即进行全面检查和修复',
                'description': f'{high_risk*100:.1f}%的区域为高风险，需要紧急处理',
                'timeframe': '1个月内'
            })
        elif high_risk > 0.1:
            recommendations.append({
                'priority': 'high',
                'category': '计划维护',
                'action': '6个月内安排全面维护',
                'description': f'{high_risk*100:.1f}%的区域为高风险，建议尽快处理',
                'timeframe': '6个月内'
            })
        
        if avg_rate > 0.06:
            recommendations.append({
                'priority': 'high',
                'category': '防护措施',
                'action': '增加额外防护层',
                'description': f'风化速率较高({avg_rate:.3f}/年)，建议增加表面防护',
                'timeframe': '12个月内'
            })
        
        recommendations.append({
            'priority': 'medium',
            'category': '监测计划',
            'action': '定期监测',
            'description': f'建议每年进行一次完整检测，跟踪风化发展趋势',
            'timeframe': '每年'
        })
        
        return recommendations

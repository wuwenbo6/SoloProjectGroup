import numpy as np
from typing import List, Dict, Optional
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime


class SafetyLevel(Enum):
    """安全等级枚举"""
    SAFE = "safe"
    CAUTION = "caution"
    WARNING = "warning"
    CRITICAL = "critical"
    DANGEROUS = "dangerous"


@dataclass
class SafetyCriterion:
    """安全评估标准数据类"""
    name: str
    weight: float = 1.0
    threshold_good: float = 0.0
    threshold_caution: float = 0.0
    threshold_warning: float = 0.0
    threshold_critical: float = 0.0
    actual_value: float = 0.0
    score: float = 0.0
    status: str = "unknown"


@dataclass
class SafetyRecommendation:
    """安全建议数据类"""
    priority: str
    category: str
    message: str
    action_required: str


@dataclass
class SafetyReport:
    """安全评估报告数据类"""
    report_id: str
    assessment_time: str
    overall_safety_level: SafetyLevel
    overall_score: float
    criteria: List[SafetyCriterion] = field(default_factory=list)
    recommendations: List[SafetyRecommendation] = field(default_factory=list)
    defect_summary: Dict = field(default_factory=dict)
    thickness_summary: Dict = field(default_factory=dict)
    metadata: Dict = field(default_factory=dict)


class SafetyAssessor:
    """安全评估类"""
    
    def __init__(self):
        self.report: Optional[SafetyReport] = None
        self.defect_data: Optional[Dict] = None
        self.thickness_data: Optional[Dict] = None
        
    def set_defect_data(self, defect_summary: Dict):
        """设置缺损检测数据"""
        self.defect_data = defect_summary
        
    def set_thickness_data(self, thickness_summary: Dict):
        """设置厚度分析数据"""
        self.thickness_data = thickness_summary
        
    def assess_safety(self,
                      min_acceptable_thickness: float = 5.0,
                      max_defect_area: float = 100.0,
                      critical_defect_count: int = 3,
                      custom_criteria: Optional[List[SafetyCriterion]] = None) -> SafetyReport:
        """
        执行安全评估
        
        Args:
            min_acceptable_thickness: 最小可接受厚度
            max_defect_area: 最大允许缺损面积
            critical_defect_count: 关键缺损数量阈值
            custom_criteria: 自定义评估标准
            
        Returns:
            SafetyReport: 安全评估报告
        """
        report_id = f"SAFETY-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        
        criteria = []
        
        if self.thickness_data:
            criteria.extend(self._assess_thickness_criteria(min_acceptable_thickness))
            
        if self.defect_data:
            criteria.extend(self._assess_defect_criteria(max_defect_area, critical_defect_count))
            
        if custom_criteria:
            criteria.extend(custom_criteria)
            
        overall_score = self._calculate_overall_score(criteria)
        safety_level = self._determine_safety_level(overall_score)
        
        recommendations = self._generate_recommendations(
            criteria, safety_level, min_acceptable_thickness
        )
        
        self.report = SafetyReport(
            report_id=report_id,
            assessment_time=datetime.now().isoformat(),
            overall_safety_level=safety_level,
            overall_score=overall_score,
            criteria=criteria,
            recommendations=recommendations,
            defect_summary=self.defect_data or {},
            thickness_summary=self.thickness_data or {},
            metadata={
                'min_acceptable_thickness': min_acceptable_thickness,
                'max_defect_area': max_defect_area,
                'critical_defect_count': critical_defect_count
            }
        )
        
        return self.report
    
    def _assess_thickness_criteria(self, min_acceptable_thickness: float) -> List[SafetyCriterion]:
        """评估厚度相关标准"""
        criteria = []
        
        if not self.thickness_data:
            return criteria
            
        mean_thickness = self.thickness_data.get('mean', 0)
        median_thickness = self.thickness_data.get('median', 0)
        min_thickness = self.thickness_data.get('min', 0)
        std_thickness = self.thickness_data.get('std', 0)
        valid_ratio = self.thickness_data.get('valid_points', 0) / \
                      max(1, self.thickness_data.get('total_points', 1))
        
        criterion1 = SafetyCriterion(
            name="最小厚度评估",
            weight=1.5,
            threshold_good=min_acceptable_thickness * 1.5,
            threshold_caution=min_acceptable_thickness * 1.2,
            threshold_warning=min_acceptable_thickness,
            threshold_critical=min_acceptable_thickness * 0.7,
            actual_value=min_thickness
        )
        criterion1.score = self._score_thickness(
            min_thickness,
            min_acceptable_thickness,
            criterion1.threshold_good,
            criterion1.threshold_caution,
            criterion1.threshold_warning,
            criterion1.threshold_critical
        )
        criterion1.status = self._get_status_from_score(criterion1.score)
        criteria.append(criterion1)
        
        criterion2 = SafetyCriterion(
            name="平均厚度评估",
            weight=1.0,
            threshold_good=min_acceptable_thickness * 2.0,
            threshold_caution=min_acceptable_thickness * 1.5,
            threshold_warning=min_acceptable_thickness * 1.2,
            threshold_critical=min_acceptable_thickness,
            actual_value=mean_thickness
        )
        criterion2.score = self._score_thickness(
            mean_thickness,
            min_acceptable_thickness,
            criterion2.threshold_good,
            criterion2.threshold_caution,
            criterion2.threshold_warning,
            criterion2.threshold_critical
        )
        criterion2.status = self._get_status_from_score(criterion2.score)
        criteria.append(criterion2)
        
        criterion3 = SafetyCriterion(
            name="厚度均匀性评估",
            weight=0.8,
            threshold_good=std_thickness * 0.5,
            threshold_caution=std_thickness,
            threshold_warning=std_thickness * 1.5,
            threshold_critical=std_thickness * 2.0,
            actual_value=std_thickness
        )
        if mean_thickness > 0:
            cv = std_thickness / mean_thickness
            criterion3.score = max(0, 100 - cv * 200)
        else:
            criterion3.score = 50
        criterion3.status = self._get_status_from_score(criterion3.score)
        criteria.append(criterion3)
        
        criterion4 = SafetyCriterion(
            name="厚度检测覆盖率",
            weight=0.7,
            threshold_good=0.9,
            threshold_caution=0.7,
            threshold_warning=0.5,
            threshold_critical=0.3,
            actual_value=valid_ratio
        )
        criterion4.score = valid_ratio * 100
        criterion4.status = self._get_status_from_score(criterion4.score)
        criteria.append(criterion4)
        
        return criteria
    
    def _assess_defect_criteria(self, max_defect_area: float, critical_defect_count: int) -> List[SafetyCriterion]:
        """评估缺损相关标准"""
        criteria = []
        
        if not self.defect_data:
            return criteria
            
        total_defects = self.defect_data.get('total_defects', 0)
        total_area = self.defect_data.get('total_defect_area', 0)
        severity_dist = self.defect_data.get('severity_distribution', {})
        
        critical_count = severity_dist.get('critical', 0)
        high_count = severity_dist.get('high', 0)
        
        criterion1 = SafetyCriterion(
            name="缺损总数评估",
            weight=1.0,
            threshold_good=0,
            threshold_caution=5,
            threshold_warning=15,
            threshold_critical=30,
            actual_value=total_defects
        )
        criterion1.score = max(0, 100 - total_defects * 3)
        criterion1.status = self._get_status_from_score(criterion1.score)
        criteria.append(criterion1)
        
        criterion2 = SafetyCriterion(
            name="关键缺损评估",
            weight=2.0,
            threshold_good=0,
            threshold_caution=1,
            threshold_warning=critical_defect_count,
            threshold_critical=critical_defect_count * 2,
            actual_value=critical_count
        )
        criterion2.score = max(0, 100 - critical_count * 25)
        criterion2.status = self._get_status_from_score(criterion2.score)
        criteria.append(criterion2)
        
        criterion3 = SafetyCriterion(
            name="缺损总面积评估",
            weight=1.5,
            threshold_good=max_defect_area * 0.1,
            threshold_caution=max_defect_area * 0.3,
            threshold_warning=max_defect_area * 0.6,
            threshold_critical=max_defect_area,
            actual_value=total_area
        )
        if max_defect_area > 0:
            area_ratio = total_area / max_defect_area
            criterion3.score = max(0, 100 - area_ratio * 150)
        else:
            criterion3.score = 50
        criterion3.status = self._get_status_from_score(criterion3.score)
        criteria.append(criterion3)
        
        if total_defects > 0:
            high_severity_ratio = (critical_count + high_count) / total_defects
            criterion4 = SafetyCriterion(
                name="高严重度缺损比例",
                weight=1.2,
                threshold_good=0.1,
                threshold_caution=0.25,
                threshold_warning=0.5,
                threshold_critical=0.75,
                actual_value=high_severity_ratio
            )
            criterion4.score = max(0, 100 - high_severity_ratio * 100)
            criterion4.status = self._get_status_from_score(criterion4.score)
            criteria.append(criterion4)
        
        return criteria
    
    def _score_thickness(self, value: float, min_acceptable: float,
                         good: float, caution: float, warning: float, critical: float) -> float:
        """计算厚度评分"""
        if value >= good:
            return 100.0
        elif value >= caution:
            ratio = (value - caution) / (good - caution)
            return 80 + ratio * 20
        elif value >= warning:
            ratio = (value - warning) / (caution - warning)
            return 60 + ratio * 20
        elif value >= critical:
            ratio = (value - critical) / (warning - critical)
            return 30 + ratio * 30
        else:
            return max(0, 30 * (value / (critical + 1e-6)))
    
    def _calculate_overall_score(self, criteria: List[SafetyCriterion]) -> float:
        """计算综合评分"""
        if not criteria:
            return 50.0
            
        total_weight = sum(c.weight for c in criteria)
        if total_weight == 0:
            return 50.0
            
        weighted_sum = sum(c.score * c.weight for c in criteria)
        return weighted_sum / total_weight
    
    def _determine_safety_level(self, score: float) -> SafetyLevel:
        """根据评分确定安全等级"""
        if score >= 85:
            return SafetyLevel.SAFE
        elif score >= 70:
            return SafetyLevel.CAUTION
        elif score >= 50:
            return SafetyLevel.WARNING
        elif score >= 30:
            return SafetyLevel.CRITICAL
        else:
            return SafetyLevel.DANGEROUS
    
    def _get_status_from_score(self, score: float) -> str:
        """根据分数获取状态描述"""
        if score >= 80:
            return "good"
        elif score >= 60:
            return "caution"
        elif score >= 40:
            return "warning"
        else:
            return "critical"
    
    def _generate_recommendations(self,
                                   criteria: List[SafetyCriterion],
                                   safety_level: SafetyLevel,
                                   min_acceptable_thickness: float) -> List[SafetyRecommendation]:
        """生成安全建议"""
        recommendations = []
        
        if safety_level in [SafetyLevel.CRITICAL, SafetyLevel.DANGEROUS]:
            recommendations.append(SafetyRecommendation(
                priority="critical",
                category="紧急措施",
                message="检测到严重安全风险，建议立即停止使用并进行全面检查。",
                action_required="立即停用，安排紧急维修"
            ))
        elif safety_level == SafetyLevel.WARNING:
            recommendations.append(SafetyRecommendation(
                priority="high",
                category="维护建议",
                message="存在多项安全隐患，建议尽快安排维护。",
                action_required="计划近期维护"
            ))
        
        for criterion in criteria:
            if criterion.status == "critical":
                recommendations.append(SafetyRecommendation(
                    priority="critical",
                    category=criterion.name,
                    message=f"{criterion.name}严重不达标，当前值: {criterion.actual_value:.2f}",
                    action_required="立即修复"
                ))
            elif criterion.status == "warning":
                recommendations.append(SafetyRecommendation(
                    priority="high",
                    category=criterion.name,
                    message=f"{criterion.name}低于标准，当前值: {criterion.actual_value:.2f}",
                    action_required="重点关注并安排修复"
                ))
        
        if self.thickness_data:
            min_thickness = self.thickness_data.get('min', 0)
            if min_thickness < min_acceptable_thickness:
                recommendations.append(SafetyRecommendation(
                    priority="high",
                    category="厚度补强",
                    message=f"最小厚度({min_thickness:.2f})低于可接受标准({min_acceptable_thickness:.2f})",
                    action_required="进行厚度补强或更换部件"
                ))
        
        if self.defect_data:
            total_defects = self.defect_data.get('total_defects', 0)
            if total_defects > 0:
                severity_dist = self.defect_data.get('severity_distribution', {})
                critical_count = severity_dist.get('critical', 0)
                if critical_count > 0:
                    recommendations.append(SafetyRecommendation(
                        priority="critical",
                        category="缺损修复",
                        message=f"发现 {critical_count} 个关键缺损，必须立即修复",
                        action_required="修复关键缺损"
                    ))
        
        if safety_level == SafetyLevel.SAFE:
            recommendations.append(SafetyRecommendation(
                priority="low",
                category="常规维护",
                message="当前状态良好，建议继续定期检测维护。",
                action_required="按计划进行常规检测"
            ))
        
        return recommendations
    
    def get_safety_summary(self) -> Dict:
        """获取安全评估摘要"""
        if self.report is None:
            return {}
            
        return {
            'report_id': self.report.report_id,
            'assessment_time': self.report.assessment_time,
            'overall_safety_level': self.report.overall_safety_level.value,
            'overall_score': self.report.overall_score,
            'num_criteria': len(self.report.criteria),
            'num_recommendations': len(self.report.recommendations),
            'recommendation_priorities': {
                'critical': sum(1 for r in self.report.recommendations if r.priority == 'critical'),
                'high': sum(1 for r in self.report.recommendations if r.priority == 'high'),
                'medium': sum(1 for r in self.report.recommendations if r.priority == 'medium'),
                'low': sum(1 for r in self.report.recommendations if r.priority == 'low')
            }
        }
    
    def export_report_dict(self) -> Dict:
        """导出报告为字典格式"""
        if self.report is None:
            return {}
            
        return {
            'report_id': self.report.report_id,
            'assessment_time': self.report.assessment_time,
            'overall_safety_level': self.report.overall_safety_level.value,
            'overall_score': self.report.overall_score,
            'criteria': [
                {
                    'name': c.name,
                    'weight': c.weight,
                    'actual_value': c.actual_value,
                    'score': c.score,
                    'status': c.status
                }
                for c in self.report.criteria
            ],
            'recommendations': [
                {
                    'priority': r.priority,
                    'category': r.category,
                    'message': r.message,
                    'action_required': r.action_required
                }
                for r in self.report.recommendations
            ],
            'defect_summary': self.report.defect_summary,
            'thickness_summary': self.report.thickness_summary,
            'metadata': self.report.metadata
        }

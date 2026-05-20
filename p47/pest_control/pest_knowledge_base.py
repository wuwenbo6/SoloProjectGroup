"""
害虫知识库 - 包含各种害虫的防治信息和农药数据
"""

import numpy as np
from dataclasses import dataclass, field
from typing import List, Dict, Optional


@dataclass
class Pesticide:
    """农药信息"""
    name: str
    common_name: str
    active_ingredient: str
    concentration: float  # %有效成分
    recommended_dosage: float  # 推荐剂量 (ml/ha)
    max_dosage: float  # 最大剂量 (ml/ha)
    min_interval_days: int  # 最小施药间隔 (天)
    pre_harvest_interval: int  # 收获前安全期 (天)
    target_pests: List[str] = field(default_factory=list)
    weather_restrictions: Dict = field(default_factory=dict)
    toxicity: str = "moderate"  # low, moderate, high


@dataclass
class PestProfile:
    """害虫档案"""
    pest_type: str
    chinese_name: str
    scientific_name: str
    threat_level: str  # low, medium, high, critical
    typical_damage: str
    lifecycle_days: int
    optimal_temperature: tuple  # (min, max) °C
    optimal_humidity: tuple  # (min, max) %
    damage_threshold: float  # 开始造成损害的密度阈值
    control_threshold: float  # 需要防治的密度阈值
    economic_threshold: float  # 经济阈值
    recommended_pesticides: List[str] = field(default_factory=list)
    cultural_controls: List[str] = field(default_factory=list)
    biological_controls: List[str] = field(default_factory=list)


class PestKnowledgeBase:
    """害虫知识库"""
    
    def __init__(self):
        self._init_pesticides()
        self._init_pest_profiles()
    
    def _init_pesticides(self):
        """初始化农药数据库"""
        self.pesticides = {
            'chlorpyrifos': Pesticide(
                name='毒死蜱',
                common_name='Chlorpyrifos',
                active_ingredient='毒死蜱',
                concentration=40.0,
                recommended_dosage=1200,
                max_dosage=1800,
                min_interval_days=14,
                pre_harvest_interval=21,
                target_pests=['locust', 'cotton_bollworm', 'aphid'],
                weather_restrictions={'max_wind': 5, 'avoid_rain': True},
                toxicity='moderate'
            ),
            'imidacloprid': Pesticide(
                name='吡虫啉',
                common_name='Imidacloprid',
                active_ingredient='吡虫啉',
                concentration=70.0,
                recommended_dosage=150,
                max_dosage=300,
                min_interval_days=7,
                pre_harvest_interval=14,
                target_pests=['aphid', 'whitefly', 'locust'],
                weather_restrictions={'max_wind': 6, 'avoid_rain': True},
                toxicity='low'
            ),
            'lambda_cyhalothrin': Pesticide(
                name='高效氯氟氰菊酯',
                common_name='Lambda-cyhalothrin',
                active_ingredient='氯氟氰菊酯',
                concentration=25.0,
                recommended_dosage=400,
                max_dosage=600,
                min_interval_days=10,
                pre_harvest_interval=15,
                target_pests=['locust', 'cotton_bollworm', 'whitefly'],
                weather_restrictions={'max_wind': 5, 'avoid_rain': True},
                toxicity='moderate'
            ),
            'abamectin': Pesticide(
                name='阿维菌素',
                common_name='Abamectin',
                active_ingredient='阿维菌素',
                concentration=1.8,
                recommended_dosage=600,
                max_dosage=900,
                min_interval_days=7,
                pre_harvest_interval=20,
                target_pests=['cotton_bollworm', 'aphid', 'whitefly'],
                weather_restrictions={'max_wind': 4, 'avoid_rain': True, 'max_temp': 30},
                toxicity='moderate'
            ),
            'spinosad': Pesticide(
                name='多杀菌素',
                common_name='Spinosad',
                active_ingredient='多杀菌素',
                concentration=2.5,
                recommended_dosage=800,
                max_dosage=1200,
                min_interval_days=5,
                pre_harvest_interval=7,
                target_pests=['locust', 'cotton_bollworm'],
                weather_restrictions={'max_wind': 5, 'avoid_rain': True},
                toxicity='low'
            ),
            'acetamiprid': Pesticide(
                name='啶虫脒',
                common_name='Acetamiprid',
                active_ingredient='啶虫脒',
                concentration=20.0,
                recommended_dosage=300,
                max_dosage=450,
                min_interval_days=7,
                pre_harvest_interval=14,
                target_pests=['aphid', 'whitefly'],
                weather_restrictions={'max_wind': 6, 'avoid_rain': True},
                toxicity='low'
            )
        }
    
    def _init_pest_profiles(self):
        """初始化害虫档案"""
        self.pest_profiles = {
            'locust': PestProfile(
                pest_type='locust',
                chinese_name='蝗虫',
                scientific_name='Locusta migratoria',
                threat_level='critical',
                typical_damage='大量啃食农作物叶片，可造成绝收',
                lifecycle_days=90,
                optimal_temperature=(25, 35),
                optimal_humidity=(40, 70),
                damage_threshold=5.0,  # 5只/m²
                control_threshold=10.0,  # 10只/m²
                economic_threshold=20.0,  # 20只/m²
                recommended_pesticides=['chlorpyrifos', 'lambda_cyhalothrin', 'spinosad'],
                cultural_controls=['深耕翻土', '轮作倒茬', '种植抗虫品种'],
                biological_controls=['牧鸡治蝗', '粉红椋鸟', '蝗虫微孢子虫']
            ),
            'cotton_bollworm': PestProfile(
                pest_type='cotton_bollworm',
                chinese_name='棉铃虫',
                scientific_name='Helicoverpa armigera',
                threat_level='high',
                typical_damage='蛀食棉蕾、花、铃，造成脱落和烂铃',
                lifecycle_days=30,
                optimal_temperature=(22, 32),
                optimal_humidity=(60, 85),
                damage_threshold=0.5,  # 0.5头/百株
                control_threshold=1.0,  # 1头/百株
                economic_threshold=3.0,  # 3头/百株
                recommended_pesticides=['chlorpyrifos', 'abamectin', 'spinosad'],
                cultural_controls=['秋耕冬灌', '种植诱集作物', '灯光诱杀'],
                biological_controls=['赤眼蜂', '草蛉', '瓢虫']
            ),
            'aphid': PestProfile(
                pest_type='aphid',
                chinese_name='蚜虫',
                scientific_name='Aphidoidea',
                threat_level='medium',
                typical_damage='吸食汁液，传播病毒病，造成叶片卷曲',
                lifecycle_days=7,
                optimal_temperature=(15, 28),
                optimal_humidity=(50, 80),
                damage_threshold=50.0,  # 50头/株
                control_threshold=100.0,  # 100头/株
                economic_threshold=200.0,  # 200头/株
                recommended_pesticides=['imidacloprid', 'acetamiprid', 'abamectin'],
                cultural_controls=['清除杂草', '合理密植', '水肥管理'],
                biological_controls=['瓢虫', '草蛉', '食蚜蝇', '蚜茧蜂']
            ),
            'whitefly': PestProfile(
                pest_type='whitefly',
                chinese_name='粉虱',
                scientific_name='Bemisia tabaci',
                threat_level='medium',
                typical_damage='吸食汁液，分泌蜜露诱发煤污病，传播病毒',
                lifecycle_days=20,
                optimal_temperature=(20, 30),
                optimal_humidity=(50, 75),
                damage_threshold=30.0,  # 30头/株
                control_threshold=50.0,  # 50头/株
                economic_threshold=100.0,  # 100头/株
                recommended_pesticides=['imidacloprid', 'acetamiprid', 'abamectin'],
                cultural_controls=['清洁田园', '防虫网覆盖', '黄板诱杀'],
                biological_controls=['丽蚜小蜂', '桨角蚜小蜂', '草蛉']
            )
        }
    
    def get_pest_profile(self, pest_type: str) -> Optional[PestProfile]:
        """获取害虫档案"""
        return self.pest_profiles.get(pest_type)
    
    def get_pesticide(self, pesticide_id: str) -> Optional[Pesticide]:
        """获取农药信息"""
        return self.pesticides.get(pesticide_id)
    
    def get_recommended_pesticides(self, pest_type: str) -> List[Pesticide]:
        """获取针对某种害虫的推荐农药"""
        profile = self.get_pest_profile(pest_type)
        if not profile:
            return []
        
        return [
            self.pesticides[p] 
            for p in profile.recommended_pesticides 
            if p in self.pesticides
        ]
    
    def calculate_threshold_level(self, pest_type: str, density: float) -> str:
        """根据密度计算阈值等级"""
        profile = self.get_pest_profile(pest_type)
        if not profile:
            return 'unknown'
        
        if density >= profile.economic_threshold:
            return 'critical'
        elif density >= profile.control_threshold:
            return 'high'
        elif density >= profile.damage_threshold:
            return 'medium'
        else:
            return 'low'
    
    def get_control_measures(self, pest_type: str, severity: str = 'medium') -> Dict:
        """获取防治措施建议"""
        profile = self.get_pest_profile(pest_type)
        if not profile:
            return {}
        
        measures = {
            'pest_name': profile.chinese_name,
            'severity': severity,
            'cultural': [],
            'biological': [],
            'chemical': []
        }
        
        if severity in ['medium', 'high', 'critical']:
            measures['cultural'] = profile.cultural_controls
        
        if severity in ['medium', 'high']:
            measures['biological'] = profile.biological_controls
        
        if severity in ['high', 'critical']:
            pesticides = self.get_recommended_pesticides(pest_type)
            measures['chemical'] = [
                {
                    'name': p.name,
                    'dosage': p.recommended_dosage,
                    'max_dosage': p.max_dosage
                }
                for p in pesticides
            ]
        
        return measures

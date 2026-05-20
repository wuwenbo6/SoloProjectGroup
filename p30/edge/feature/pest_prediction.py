#!/usr/bin/env python3
"""
病虫害发生概率预测模块
建立气象-病虫害关联模型，实现多维度风险预测
"""

import time
import math
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict


class PestRiskLevel(Enum):
    """病虫害风险等级"""
    NONE = "none"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    SEVERE = "severe"
    CRITICAL = "critical"


@dataclass
class PestPredictionResult:
    """病虫害预测结果"""
    pest_type: str
    region_id: str
    prediction_time: float
    risk_level: PestRiskLevel
    occurrence_probability: float
    confidence: float
    
    temperature_risk: float = 0.0
    humidity_risk: float = 0.0
    rainfall_risk: float = 0.0
    leaf_wetness_risk: float = 0.0
    soil_risk: float = 0.0
    
    forecast_24h: float = 0.0
    forecast_48h: float = 0.0
    forecast_72h: float = 0.0
    
    contributing_factors: List[str] = field(default_factory=list)
    recommended_actions: List[str] = field(default_factory=list)


class PestWeatherModel:
    """病虫害-气象关联模型"""
    
    def __init__(self, pest_type: str):
        self.pest_type = pest_type
        self.temperature_optimal_range = (20, 30)
        self.temperature_dead_range = (0, 45)
        self.humidity_optimal_range = (60, 90)
        self.leaf_wetness_threshold = 4
        self.rainfall_threshold = 5
        self.development_threshold = 10
        self.thermal_constant = 120
        self.cumulative_degree_days = 0
        self.generation_count = 0
        self._risk_history = []
    
    def calculate_temperature_risk(self, temp: float) -> float:
        """计算温度风险"""
        if temp is None:
            return 0.5
        
        t_min, t_max = self.temperature_optimal_range
        d_min, d_max = self.temperature_dead_range
        
        if temp <= d_min or temp >= d_max:
            return 0.0
        
        if t_min <= temp <= t_max:
            return 1.0
        
        if temp < t_min:
            return (temp - d_min) / (t_min - d_min)
        else:
            return (d_max - temp) / (d_max - t_max)
    
    def calculate_humidity_risk(self, humidity: float) -> float:
        """计算湿度风险"""
        if humidity is None:
            return 0.5
        
        h_min, h_max = self.humidity_optimal_range
        
        if humidity >= h_max:
            return 1.0
        elif humidity >= h_min:
            return 0.5 + (humidity - h_min) / (h_max - h_min) * 0.5
        else:
            return max(0, humidity / h_min * 0.3)
    
    def calculate_rainfall_risk(self, rainfall: float, wind_speed: float = 0) -> float:
        """计算降雨风险"""
        if rainfall is None:
            return 0.3
        
        base_risk = min(1.0, rainfall / self.rainfall_threshold)
        
        wind_effect = min(0.3, wind_speed / 10) if wind_speed else 0
        
        return min(1.0, base_risk + wind_effect)
    
    def calculate_leaf_wetness_risk(self, leaf_wetness: float, duration_hours: float = 0) -> float:
        """计算叶面湿度风险"""
        if leaf_wetness is None:
            return 0.3
        
        base_risk = min(1.0, leaf_wetness / 50)
        duration_effect = min(0.5, duration_hours / self.leaf_wetness_threshold)
        
        return min(1.0, base_risk + duration_effect)
    
    def calculate_soil_risk(self, soil_temp: float, soil_moisture: float) -> float:
        """计算土壤环境风险"""
        temp_risk = 0.0
        if soil_temp is not None:
            if 15 <= soil_temp <= 28:
                temp_risk = 1.0
            elif 10 <= soil_temp <= 30:
                temp_risk = 0.6
        
        moisture_risk = 0.0
        if soil_moisture is not None:
            if 30 <= soil_moisture <= 70:
                moisture_risk = 0.8
            elif soil_moisture > 20:
                moisture_risk = 0.4
        
        return (temp_risk + moisture_risk) / 2
    
    def update_degree_days(self, avg_temp: float):
        """更新累积度日"""
        if avg_temp > self.development_threshold:
            self.cumulative_degree_days += (avg_temp - self.development_threshold)
            
            if self.cumulative_degree_days >= self.thermal_constant:
                self.generation_count += 1
                self.cumulative_degree_days -= self.thermal_constant
                return True
        
        return False


class AphidModel(PestWeatherModel):
    """蚜虫预测模型"""
    
    def __init__(self):
        super().__init__("aphid")
        self.temperature_optimal_range = (15, 25)
        self.temperature_dead_range = (-5, 38)
        self.humidity_optimal_range = (50, 80)
        self.thermal_constant = 100
        self.reproduction_rate = 2.5
    
    def calculate_specific_risk(self, weather_data: Dict) -> float:
        """蚜虫特有的风险计算"""
        temp = weather_data.get('temperature', 20)
        wind = weather_data.get('wind_speed', 0)
        
        wind_dispersal_risk = min(1.0, wind / 15) if wind < 25 else 0.3
        
        alate_trigger = 0.0
        if temp > 25:
            alate_trigger = 0.3
        
        return (wind_dispersal_risk + alate_trigger) / 2


class WhiteflyModel(PestWeatherModel):
    """粉虱预测模型"""
    
    def __init__(self):
        super().__init__("whitefly")
        self.temperature_optimal_range = (20, 32)
        self.temperature_dead_range = (0, 42)
        self.humidity_optimal_range = (55, 85)
        self.thermal_constant = 90


class ThripsModel(PestWeatherModel):
    """蓟马预测模型"""
    
    def __init__(self):
        super().__init__("thrips")
        self.temperature_optimal_range = (18, 35)
        self.temperature_dead_range = (5, 40)
        self.humidity_optimal_range = (40, 70)
        self.thermal_constant = 110
    
    def calculate_specific_risk(self, weather_data: Dict) -> float:
        """蓟马特有的风险计算"""
        solar = weather_data.get('solar_radiation', 0)
        return min(1.0, solar / 1000)


class SpiderMiteModel(PestWeatherModel):
    """叶螨预测模型"""
    
    def __init__(self):
        super().__init__("spider_mite")
        self.temperature_optimal_range = (25, 35)
        self.temperature_dead_range = (5, 43)
        self.humidity_optimal_range = (30, 60)
        self.thermal_constant = 80
    
    def calculate_humidity_risk(self, humidity: float) -> float:
        """叶螨偏好低湿度"""
        if humidity is None:
            return 0.5
        
        if humidity < 40:
            return 1.0
        elif humidity < 60:
            return 0.8
        elif humidity < 80:
            return 0.4
        else:
            return 0.1


class BollwormModel(PestWeatherModel):
    """棉铃虫预测模型"""
    
    def __init__(self):
        super().__init__("bollworm")
        self.temperature_optimal_range = (22, 32)
        self.temperature_dead_range = (0, 40)
        self.humidity_optimal_range = (60, 90)
        self.thermal_constant = 150


class PestPredictionEngine:
    """病虫害预测引擎"""
    
    def __init__(self):
        self.models: Dict[str, PestWeatherModel] = {
            'aphid': AphidModel(),
            'whitefly': WhiteflyModel(),
            'thrips': ThripsModel(),
            'spider_mite': SpiderMiteModel(),
            'bollworm': BollwormModel(),
        }
        
        self.weights = {
            'temperature': 0.30,
            'humidity': 0.25,
            'rainfall': 0.15,
            'leaf_wetness': 0.15,
            'soil': 0.10,
            'specific': 0.05,
        }
        
        self._prediction_history: Dict[str, List[PestPredictionResult]] = defaultdict(list)
        self._weather_history: Dict[str, List[Dict]] = defaultdict(list)
    
    def predict(self, pest_type: str, weather_data: Dict, 
                region_id: str = 'default') -> PestPredictionResult:
        """单种病虫害预测"""
        model = self.models.get(pest_type)
        if not model:
            model = PestWeatherModel(pest_type)
        
        temp_risk = model.calculate_temperature_risk(weather_data.get('temperature'))
        humid_risk = model.calculate_humidity_risk(weather_data.get('humidity'))
        rain_risk = model.calculate_rainfall_risk(
            weather_data.get('rainfall'),
            weather_data.get('wind_speed')
        )
        leaf_risk = model.calculate_leaf_wetness_risk(
            weather_data.get('leaf_wetness'),
            weather_data.get('wet_duration', 0)
        )
        soil_risk = model.calculate_soil_risk(
            weather_data.get('soil_temperature'),
            weather_data.get('soil_moisture')
        )
        
        specific_risk = 0.0
        if hasattr(model, 'calculate_specific_risk'):
            specific_risk = model.calculate_specific_risk(weather_data)
        
        total_prob = (
            temp_risk * self.weights['temperature'] +
            humid_risk * self.weights['humidity'] +
            rain_risk * self.weights['rainfall'] +
            leaf_risk * self.weights['leaf_wetness'] +
            soil_risk * self.weights['soil'] +
            specific_risk * self.weights['specific']
        )
        
        total_prob = max(0.0, min(1.0, total_prob))
        
        avg_temp = weather_data.get('temperature', 20)
        new_generation = model.update_degree_days(avg_temp)
        
        forecast_24h = self._extrapolate_risk(total_prob, weather_data, 24)
        forecast_48h = self._extrapolate_risk(total_prob, weather_data, 48)
        forecast_72h = self._extrapolate_risk(total_prob, weather_data, 72)
        
        risk_level = self._prob_to_level(total_prob)
        
        factors = self._identify_factors(
            temp_risk, humid_risk, rain_risk, leaf_risk, soil_risk
        )
        
        actions = self._generate_recommendations(risk_level, pest_type)
        
        result = PestPredictionResult(
            pest_type=pest_type,
            region_id=region_id,
            prediction_time=time.time(),
            risk_level=risk_level,
            occurrence_probability=total_prob,
            confidence=weather_data.get('confidence', 0.8),
            temperature_risk=temp_risk,
            humidity_risk=humid_risk,
            rainfall_risk=rain_risk,
            leaf_wetness_risk=leaf_risk,
            soil_risk=soil_risk,
            forecast_24h=forecast_24h,
            forecast_48h=forecast_48h,
            forecast_72h=forecast_72h,
            contributing_factors=factors,
            recommended_actions=actions
        )
        
        self._prediction_history[pest_type].append(result)
        
        if len(self._prediction_history[pest_type]) > 1000:
            self._prediction_history[pest_type] = self._prediction_history[pest_type][-500:]
        
        return result
    
    def predict_all(self, weather_data: Dict, region_id: str = 'default') -> List[PestPredictionResult]:
        """预测所有病虫害"""
        results = []
        for pest_type in self.models.keys():
            result = self.predict(pest_type, weather_data, region_id)
            results.append(result)
        return results
    
    def _extrapolate_risk(self, current_prob: float, weather_data: Dict, hours: int) -> float:
        """外推未来风险"""
        trend_factor = 1.0
        
        temp = weather_data.get('temperature', 20)
        humid = weather_data.get('humidity', 60)
        
        if 20 <= temp <= 30 and humid >= 60:
            trend_factor = 1.0 + (hours / 24) * 0.15
        elif temp > 35 or humid < 40:
            trend_factor = 1.0 - (hours / 24) * 0.1
        
        forecast = current_prob * trend_factor
        return max(0.0, min(1.0, forecast))
    
    def _prob_to_level(self, prob: float) -> PestRiskLevel:
        """概率转风险等级"""
        if prob >= 0.90:
            return PestRiskLevel.CRITICAL
        elif prob >= 0.75:
            return PestRiskLevel.SEVERE
        elif prob >= 0.60:
            return PestRiskLevel.HIGH
        elif prob >= 0.40:
            return PestRiskLevel.MEDIUM
        elif prob >= 0.20:
            return PestRiskLevel.LOW
        else:
            return PestRiskLevel.NONE
    
    def _identify_factors(self, temp_r: float, humid_r: float, rain_r: float,
                          leaf_r: float, soil_r: float) -> List[str]:
        """识别主要风险因素"""
        factors = []
        
        if temp_r > 0.7:
            factors.append("温度条件适宜")
        if humid_r > 0.7:
            factors.append("湿度条件适宜")
        if rain_r > 0.6:
            factors.append("降雨利于病害传播")
        if leaf_r > 0.6:
            factors.append("叶面湿度高")
        if soil_r > 0.6:
            factors.append("土壤条件适宜")
        
        return factors if factors else ["环境条件一般"]
    
    def _generate_recommendations(self, risk_level: PestRiskLevel, pest_type: str) -> List[str]:
        """生成防治建议"""
        recommendations = []
        
        if risk_level in [PestRiskLevel.HIGH, PestRiskLevel.SEVERE, PestRiskLevel.CRITICAL]:
            recommendations.append("立即开展田间调查，确认发生情况")
            recommendations.append("准备应急防治药剂和器械")
            recommendations.append("加强监测频次，每日观察")
        
        if risk_level in [PestRiskLevel.MEDIUM, PestRiskLevel.HIGH]:
            recommendations.append("布置诱虫灯/黄板监测种群动态")
            recommendations.append("检查天敌种群数量")
        
        if risk_level in [PestRiskLevel.LOW, PestRiskLevel.MEDIUM]:
            recommendations.append("做好预防性农业措施")
            recommendations.append("保持田间清洁，减少虫源基数")
        
        if risk_level == PestRiskLevel.NONE:
            recommendations.append("继续常规监测即可")
        
        return recommendations
    
    def get_prediction_trend(self, pest_type: str, hours: int = 72) -> List[PestPredictionResult]:
        """获取预测趋势历史"""
        cutoff = time.time() - hours * 3600
        return [
            r for r in self._prediction_history.get(pest_type, [])
            if r.prediction_time >= cutoff
        ]
    
    def get_region_risk_summary(self, region_id: str) -> Dict:
        """获取区域风险汇总"""
        region_results = []
        for results in self._prediction_history.values():
            region_results.extend([
                r for r in results if r.region_id == region_id
            ])
        
        if not region_results:
            return {}
        
        latest = {}
        for result in reversed(region_results):
            if result.pest_type not in latest:
                latest[result.pest_type] = result
        
        avg_prob = sum(r.occurrence_probability for r in latest.values()) / len(latest)
        max_risk = max(latest.values(), key=lambda x: x.occurrence_probability)
        
        return {
            'region_id': region_id,
            'total_pest_types': len(latest),
            'average_risk_probability': avg_prob,
            'highest_risk_pest': max_risk.pest_type,
            'highest_risk_probability': max_risk.occurrence_probability,
            'highest_risk_level': max_risk.risk_level.value,
            'pest_details': [
                {
                    'pest_type': pt,
                    'probability': r.occurrence_probability,
                    'level': r.risk_level.value,
                    'forecast_24h': r.forecast_24h,
                }
                for pt, r in latest.items()
            ],
            'update_time': time.time(),
        }

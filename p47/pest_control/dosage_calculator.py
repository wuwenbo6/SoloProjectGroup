"""
农药剂量计算引擎 - 根据害虫种类、密度、天气计算剂量
"""

import numpy as np
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
from datetime import datetime

from .pest_knowledge_base import PestKnowledgeBase, Pesticide, PestProfile
from .weather_integration import WeatherSummary, WeatherAnalyzer


@dataclass
class DosageRecommendation:
    """剂量推荐"""
    pesticide_id: str
    pesticide_name: str
    active_ingredient: str
    concentration: float
    recommended_dosage_ml_ha: float
    max_dosage_ml_ha: float
    adjusted_dosage_ml_ha: float
    adjustment_factors: Dict
    toxicity: str
    pre_harvest_interval: int
    warnings: List[str]


@dataclass
class SprayZone:
    """喷洒区域"""
    zone_id: str
    center: Tuple[float, float]
    radius_meters: float
    area_hectares: float
    pest_type: str
    pest_density: float
    severity_level: str
    total_pesticide_ml: float
    dosage_per_ha: float
    priority: int
    recommended_time_window: Optional[Dict] = None


class DosageCalculator:
    """农药剂量计算器"""
    
    def __init__(self):
        self.kb = PestKnowledgeBase()
    
    def calculate_dosage_adjustments(self, pest_type: str, density: float,
                                      weather: Optional[WeatherSummary] = None) -> Dict:
        """
        计算剂量调整因子
        
        Returns:
            Dict with adjustment factors
        """
        profile = self.kb.get_pest_profile(pest_type)
        
        if not profile:
            return {
                'density_factor': 1.0,
                'weather_factor': 1.0,
                'pest_factor': 1.0,
                'total_factor': 1.0
            }
        
        density_ratio = density / profile.control_threshold
        if density_ratio <= 0.5:
            density_factor = 0.7
        elif density_ratio <= 1.0:
            density_factor = 1.0
        elif density_ratio <= 2.0:
            density_factor = 1.2
        else:
            density_factor = 1.5
        
        weather_factor = 1.0
        weather_warnings = []
        
        if weather and weather.forecast_hours:
            next_24h = weather.forecast_hours[:24]
            
            avg_temp = np.mean([h.temperature for h in next_24h])
            if avg_temp < 15:
                weather_factor *= 0.9
                weather_warnings.append("温度较低，建议适当降低剂量")
            elif avg_temp > 30:
                weather_factor *= 0.85
                weather_warnings.append("高温天气，降低剂量避免药害")
            
            avg_humidity = np.mean([h.humidity for h in next_24h])
            if avg_humidity < 40:
                weather_factor *= 0.9
                weather_warnings.append("空气干燥，药液易挥发")
            
            max_wind = max([h.wind_speed for h in next_24h])
            if max_wind > 4:
                weather_factor *= 0.8
                weather_warnings.append("风力较大，降低剂量减少漂移")
            
            total_rain = sum([h.precipitation for h in next_24h])
            if total_rain > 5:
                weather_factor *= 0.5
                weather_warnings.append("预计有降雨，施药可能无效")
        
        pest_threat_factor = {
            'low': 0.8,
            'medium': 1.0,
            'high': 1.2,
            'critical': 1.4
        }.get(profile.threat_level, 1.0)
        
        total_factor = density_factor * weather_factor * pest_threat_factor
        total_factor = max(0.5, min(2.0, total_factor))
        
        return {
            'density_factor': density_factor,
            'weather_factor': weather_factor,
            'pest_factor': pest_threat_factor,
            'total_factor': total_factor,
            'weather_warnings': weather_warnings
        }
    
    def generate_dosage_recommendations(self, pest_type: str, density: float,
                                          area_ha: float = 1.0,
                                          weather: Optional[WeatherSummary] = None) -> List[DosageRecommendation]:
        """
        生成农药剂量推荐
        
        Args:
            pest_type: 害虫类型
            density: 害虫密度
            area_ha: 面积（公顷）
            weather: 天气预报
            
        Returns:
            剂量推荐列表
        """
        pesticides = self.kb.get_recommended_pesticides(pest_type)
        adjustments = self.calculate_dosage_adjustments(pest_type, density, weather)
        
        recommendations = []
        
        for pesticide in pesticides:
            base_dosage = pesticide.recommended_dosage
            adjusted_dosage = base_dosage * adjustments['total_factor']
            adjusted_dosage = min(adjusted_dosage, pesticide.max_dosage)
            
            warnings = []
            warnings.extend(adjustments.get('weather_warnings', []))
            
            if adjusted_dosage >= pesticide.max_dosage:
                warnings.append("剂量已达上限，注意观察药效")
            elif adjusted_dosage < base_dosage * 0.7:
                warnings.append("剂量较低，需加强监测")
            
            recommendation = DosageRecommendation(
                pesticide_id=pesticide.name.lower().replace(' ', '_'),
                pesticide_name=pesticide.name,
                active_ingredient=pesticide.active_ingredient,
                concentration=pesticide.concentration,
                recommended_dosage_ml_ha=base_dosage,
                max_dosage_ml_ha=pesticide.max_dosage,
                adjusted_dosage_ml_ha=round(adjusted_dosage, 1),
                adjustment_factors={
                    'density_factor': adjustments['density_factor'],
                    'weather_factor': adjustments['weather_factor'],
                    'pest_threat_factor': adjustments['pest_factor'],
                    'total_factor': adjustments['total_factor']
                },
                toxicity=pesticide.toxicity,
                pre_harvest_interval=pesticide.pre_harvest_interval,
                warnings=warnings
            )
            
            recommendations.append(recommendation)
        
        return recommendations


class SprayZoneGenerator:
    """喷洒区域生成器"""
    
    def __init__(self):
        self.kb = PestKnowledgeBase()
        self.dosage_calc = DosageCalculator()
    
    def calculate_spray_zone(self, pest_type: str, density: float,
                               center_lat: float, center_lng: float,
                               weather: Optional[WeatherSummary] = None) -> SprayZone:
        """
        计算单个喷洒区域
        
        Args:
            pest_type: 害虫类型
            density: 害虫密度
            center_lat: 中心纬度
            center_lng: 中心经度
            weather: 天气预报
            
        Returns:
            SprayZone对象
        """
        severity = self.kb.calculate_threshold_level(pest_type, density)
        
        radius_by_severity = {
            'low': 100,
            'medium': 200,
            'high': 350,
            'critical': 500
        }
        radius_meters = radius_by_severity.get(severity, 200)
        
        area_m2 = np.pi * radius_meters ** 2
        area_ha = area_m2 / 10000
        
        recommendations = self.dosage_calc.generate_dosage_recommendations(
            pest_type, density, area_ha, weather
        )
        
        if recommendations:
            best_recommendation = recommendations[0]
            dosage_per_ha = best_recommendation.adjusted_dosage_ml_ha
            total_pesticide = dosage_per_ha * area_ha
        else:
            dosage_per_ha = 0
            total_pesticide = 0
        
        priority_by_severity = {
            'low': 4,
            'medium': 3,
            'high': 2,
            'critical': 1
        }
        priority = priority_by_severity.get(severity, 3)
        
        time_window = None
        if weather:
            windows = WeatherAnalyzer.find_best_spray_windows(weather)
            if windows:
                time_window = windows[0]
        
        return SprayZone(
            zone_id=f"zone_{int(center_lat*1000)}_{int(center_lng*1000)}",
            center=(center_lat, center_lng),
            radius_meters=radius_meters,
            area_hectares=round(area_ha, 2),
            pest_type=pest_type,
            pest_density=density,
            severity_level=severity,
            total_pesticide_ml=round(total_pesticide, 1),
            dosage_per_ha=round(dosage_per_ha, 1),
            priority=priority,
            recommended_time_window=time_window
        )
    
    def generate_spray_zones_from_detections(self, detections: List[Dict],
                                              weather: Optional[WeatherSummary] = None,
                                              merge_distance_m: float = 300) -> List[SprayZone]:
        """
        根据检测结果生成多个喷洒区域，并合并相近区域
        
        Args:
            detections: 检测结果列表，每个包含lat, lng, pest_type, density
            weather: 天气预报
            merge_distance_m: 合并距离阈值
            
        Returns:
            喷洒区域列表
        """
        zones = []
        
        for det in detections:
            zone = self.calculate_spray_zone(
                det['pest_type'],
                det['density'],
                det['lat'],
                det['lng'],
                weather
            )
            zones.append(zone)
        
        zones = self._merge_overlapping_zones(zones, merge_distance_m)
        
        zones.sort(key=lambda z: z.priority)
        
        return zones
    
    def _merge_overlapping_zones(self, zones: List[SprayZone], merge_distance: float) -> List[SprayZone]:
        """合并重叠或相近的区域"""
        if len(zones) <= 1:
            return zones
        
        merged = []
        used_indices = set()
        
        for i, zone1 in enumerate(zones):
            if i in used_indices:
                continue
            
            to_merge = [zone1]
            
            for j, zone2 in enumerate(zones[i+1:], start=i+1):
                if j in used_indices:
                    continue
                
                distance = self._haversine_distance(
                    zone1.center[0], zone1.center[1],
                    zone2.center[0], zone2.center[1]
                )
                
                if (distance < merge_distance and 
                    zone1.pest_type == zone2.pest_type):
                    to_merge.append(zone2)
                    used_indices.add(j)
            
            if len(to_merge) == 1:
                merged.append(to_merge[0])
            else:
                merged_zone = self._merge_zone_list(to_merge)
                merged.append(merged_zone)
            
            used_indices.add(i)
        
        return merged
    
    def _haversine_distance(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        """计算两点之间的距离（米）"""
        R = 6371000
        
        lat1_rad = np.radians(lat1)
        lat2_rad = np.radians(lat2)
        delta_lat = np.radians(lat2 - lat1)
        delta_lng = np.radians(lng2 - lng1)
        
        a = (np.sin(delta_lat / 2) ** 2 +
             np.cos(lat1_rad) * np.cos(lat2_rad) * np.sin(delta_lng / 2) ** 2)
        c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))
        
        return R * c
    
    def _merge_zone_list(self, zones: List[SprayZone]) -> SprayZone:
        """合并多个区域"""
        if not zones:
            raise ValueError("Empty zone list")
        
        avg_lat = np.mean([z.center[0] for z in zones])
        avg_lng = np.mean([z.center[1] for z in zones])
        
        avg_density = np.mean([z.pest_density for z in zones])
        
        total_area = sum(z.area_hectares for z in zones)
        max_radius = max(z.radius_meters for z in zones)
        min_priority = min(z.priority for z in zones)
        
        severities = [z.severity_level for z in zones]
        severity_order = ['critical', 'high', 'medium', 'low']
        final_severity = min(severities, key=lambda s: severity_order.index(s))
        
        total_pesticide = sum(z.total_pesticide_ml for z in zones)
        avg_dosage = np.mean([z.dosage_per_ha for z in zones])
        
        return SprayZone(
            zone_id=f"merged_zone_{len(zones)}",
            center=(round(avg_lat, 6), round(avg_lng, 6)),
            radius_meters=max_radius,
            area_hectares=round(total_area, 2),
            pest_type=zones[0].pest_type,
            pest_density=round(avg_density, 2),
            severity_level=final_severity,
            total_pesticide_ml=round(total_pesticide, 1),
            dosage_per_ha=round(avg_dosage, 1),
            priority=min_priority
        )


class ControlRecommendationEngine:
    """防治建议引擎 - 整合所有功能"""
    
    def __init__(self):
        self.kb = PestKnowledgeBase()
        self.weather_api = None
        self.dosage_calc = DosageCalculator()
        self.zone_generator = SprayZoneGenerator()
    
    def initialize_weather_api(self, api_key: Optional[str] = None):
        """初始化天气API"""
        from .weather_integration import WeatherAPI
        self.weather_api = WeatherAPI(api_key)
    
    def generate_full_recommendation(self, pest_detections: List[Dict],
                                       center_lat: float, center_lng: float,
                                       area_ha: float = 10.0) -> Dict:
        """
        生成完整的防治建议
        
        Args:
            pest_detections: 害虫检测列表，每个包含pest_type, density, lat, lng
            center_lat: 监测区域中心纬度
            center_lng: 监测区域中心经度
            area_ha: 总面积（公顷）
            
        Returns:
            完整建议字典
        """
        weather = None
        if self.weather_api:
            try:
                weather = self.weather_api.get_weather_forecast(center_lat, center_lng)
            except Exception as e:
                print(f"Warning: Weather API failed: {e}")
        
        pest_summary = self._summarize_pest_detections(pest_detections)
        
        spray_zones = self.zone_generator.generate_spray_zones_from_detections(
            pest_detections, weather
        )
        
        all_recommendations = {}
        for pest_type in pest_summary['pest_types']:
            avg_density = pest_summary['avg_density_by_type'][pest_type]
            recommendations = self.dosage_calc.generate_dosage_recommendations(
                pest_type, avg_density, area_ha, weather
            )
            all_recommendations[pest_type] = [
                {
                    'name': rec.pesticide_name,
                    'active_ingredient': rec.active_ingredient,
                    'concentration': rec.concentration,
                    'dosage_per_ha_ml': rec.adjusted_dosage_ml_ha,
                    'max_dosage_ml_ha': rec.max_dosage_ml_ha,
                    'adjustment_factors': rec.adjustment_factors,
                    'toxicity': rec.toxicity,
                    'pre_harvest_interval_days': rec.pre_harvest_interval,
                    'warnings': rec.warnings
                }
                for rec in recommendations
            ]
        
        control_measures = {}
        for pest_type in pest_summary['pest_types']:
            avg_density = pest_summary['avg_density_by_type'][pest_type]
            severity = self.kb.calculate_threshold_level(pest_type, avg_density)
            control_measures[pest_type] = self.kb.get_control_measures(pest_type, severity)
        
        spray_windows = []
        if weather:
            spray_windows = WeatherAnalyzer.find_best_spray_windows(weather)
        
        weather_summary = None
        if weather:
            weather_summary = WeatherAnalyzer.get_weather_summary(weather)
        
        total_pesticide = sum(z.total_pesticide_ml for z in spray_zones)
        total_area = sum(z.area_hectares for z in spray_zones)
        
        return {
            'generated_at': datetime.now().isoformat(),
            'location': {
                'center': (center_lat, center_lng),
                'total_area_ha': area_ha,
                'spray_area_ha': total_area
            },
            'pest_summary': pest_summary,
            'recommended_pesticides': all_recommendations,
            'spray_zones': [
                {
                    'zone_id': z.zone_id,
                    'center': z.center,
                    'radius_meters': z.radius_meters,
                    'area_hectares': z.area_hectares,
                    'pest_type': z.pest_type,
                    'pest_density': z.pest_density,
                    'severity': z.severity_level,
                    'total_pesticide_ml': z.total_pesticide_ml,
                    'dosage_per_ha': z.dosage_per_ha,
                    'priority': z.priority,
                    'recommended_time': z.recommended_time_window
                }
                for z in spray_zones
            ],
            'control_measures': control_measures,
            'weather': weather_summary,
            'recommended_spray_windows': spray_windows[:5],
            'summary': {
                'total_zones': len(spray_zones),
                'total_pesticide_ml': round(total_pesticide, 1),
                'total_pesticide_liters': round(total_pesticide / 1000, 3),
                'critical_zones': sum(1 for z in spray_zones if z.severity_level == 'critical'),
                'high_zones': sum(1 for z in spray_zones if z.severity_level == 'high')
            }
        }
    
    def _summarize_pest_detections(self, detections: List[Dict]) -> Dict:
        """汇总害虫检测结果"""
        pest_types = set(d['pest_type'] for d in detections)
        
        density_by_type = {}
        for pest_type in pest_types:
            densities = [d['density'] for d in detections if d['pest_type'] == pest_type]
            density_by_type[pest_type] = {
                'count': len(densities),
                'min': min(densities),
                'max': max(densities),
                'avg': np.mean(densities)
            }
        
        avg_density_by_type = {pt: d['avg'] for pt, d in density_by_type.items()}
        
        return {
            'total_detections': len(detections),
            'pest_types': list(pest_types),
            'density_by_type': density_by_type,
            'avg_density_by_type': avg_density_by_type
        }

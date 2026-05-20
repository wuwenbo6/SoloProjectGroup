"""
Pest Control Engine - 智能虫害防治引擎

集成了天气分析、农药剂量计算和喷洒区域生成功能。
"""

from .pest_knowledge_base import (
    PestKnowledgeBase,
    Pesticide,
    PestProfile
)

from .weather_integration import (
    WeatherAPI,
    WeatherAnalyzer,
    WeatherSummary,
    WeatherHourly
)

from .dosage_calculator import (
    DosageCalculator,
    SprayZoneGenerator,
    ControlRecommendationEngine,
    DosageRecommendation,
    SprayZone
)

__version__ = "1.0.0"
__author__ = "Smart Pest Control Team"

__all__ = [
    'PestKnowledgeBase',
    'Pesticide',
    'PestProfile',
    'WeatherAPI',
    'WeatherAnalyzer',
    'WeatherSummary',
    'WeatherHourly',
    'DosageCalculator',
    'SprayZoneGenerator',
    'ControlRecommendationEngine',
    'DosageRecommendation',
    'SprayZone'
]

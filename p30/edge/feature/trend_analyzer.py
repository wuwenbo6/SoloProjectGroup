#!/usr/bin/env python3
"""
病虫害历史数据趋势分析模块
支持按区域、时间段查询病虫害发生规律，提供预测和预警功能
"""

import time
import math
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict
from datetime import datetime, timedelta
import statistics


class TrendDirection(Enum):
    """趋势方向"""
    INCREASING = "increasing"
    DECREASING = "decreasing"
    STABLE = "stable"
    FLUCTUATING = "fluctuating"


class AggregationLevel(Enum):
    """聚合级别"""
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    SEASONAL = "seasonal"


@dataclass
class PestRecord:
    """病虫害记录"""
    record_id: str
    pest_type: str
    region_id: str
    timestamp: float
    
    severity_level: int = 0
    affected_area: float = 0.0
    pest_count: int = 0
    confidence: float = 1.0
    
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    rainfall: Optional[float] = None
    
    source_device: Optional[str] = None
    notes: str = ""
    metadata: Dict = field(default_factory=dict)


@dataclass
class TrendResult:
    """趋势分析结果"""
    pest_type: str
    region_id: str
    time_span: str
    
    start_time: float
    end_time: float
    
    total_records: int
    average_severity: float
    max_severity: int
    min_severity: int
    
    total_affected_area: float
    average_affected_area: float
    
    trend_direction: TrendDirection
    trend_strength: float
    trend_slope: float
    
    seasonality_index: Dict[str, float]
    peak_periods: List[str]
    
    correlation_analysis: Dict[str, float]
    
    forecast_next_period: Optional[float] = None
    forecast_confidence: float = 0.0
    
    risk_level: str = "medium"
    recommendations: List[str] = field(default_factory=list)


@dataclass
class RegionalSummary:
    """区域汇总"""
    region_id: str
    total_records: int
    pest_types_count: int
    
    most_prevalent_pest: str
    highest_risk_period: str
    average_severity: float
    
    pest_distribution: Dict[str, int]
    severity_distribution: Dict[int, int]
    
    hotspots: List[Tuple[str, float]]


class TimeSeriesAnalyzer:
    """时间序列分析器"""
    
    def __init__(self):
        pass
    
    def calculate_moving_average(self, data: List[float], window: int = 7) -> List[float]:
        """计算移动平均"""
        if len(data) < window:
            return data
        
        result = []
        for i in range(len(data)):
            start = max(0, i - window + 1)
            window_data = data[start:i + 1]
            result.append(sum(window_data) / len(window_data))
        
        return result
    
    def calculate_trend_slope(self, data: List[float]) -> float:
        """计算趋势斜率"""
        if len(data) < 2:
            return 0.0
        
        n = len(data)
        x = list(range(n))
        
        x_mean = sum(x) / n
        y_mean = sum(data) / n
        
        numerator = sum((x[i] - x_mean) * (data[i] - y_mean) for i in range(n))
        denominator = sum((x[i] - x_mean) ** 2 for i in range(n))
        
        if denominator == 0:
            return 0.0
        
        return numerator / denominator
    
    def determine_trend_direction(self, slope: float, threshold: float = 0.1) -> TrendDirection:
        """判断趋势方向"""
        if abs(slope) < threshold:
            return TrendDirection.STABLE
        elif slope > 0:
            return TrendDirection.INCREASING
        else:
            return TrendDirection.DECREASING
    
    def calculate_seasonality(self, data: List[Tuple[float, float]], 
                              period: str = "month") -> Dict[str, float]:
        """计算季节性指数"""
        monthly_data = defaultdict(list)
        
        for timestamp, value in data:
            dt = datetime.fromtimestamp(timestamp)
            if period == "month":
                key = dt.strftime("%B")
            elif period == "season":
                month = dt.month
                if month in [3, 4, 5]:
                    key = "spring"
                elif month in [6, 7, 8]:
                    key = "summer"
                elif month in [9, 10, 11]:
                    key = "autumn"
                else:
                    key = "winter"
            else:
                key = str(dt.hour)
            
            monthly_data[key].append(value)
        
        seasonality = {}
        for key, values in monthly_data.items():
            if values:
                seasonality[key] = sum(values) / len(values)
        
        return seasonality
    
    def find_peak_periods(self, seasonality: Dict[str, float], top_n: int = 3) -> List[str]:
        """找出高峰期"""
        sorted_items = sorted(seasonality.items(), key=lambda x: x[1], reverse=True)
        return [item[0] for item in sorted_items[:top_n]]
    
    def simple_forecast(self, historical_data: List[float], periods: int = 1) -> List[float]:
        """简单预测"""
        if not historical_data:
            return [0.0] * periods
        
        recent_avg = sum(historical_data[-7:]) / min(7, len(historical_data))
        slope = self.calculate_trend_slope(historical_data[-14:])
        
        forecasts = []
        for i in range(periods):
            forecast = recent_avg + slope * (i + 1)
            forecasts.append(max(0.0, forecast))
        
        return forecasts


class CorrelationAnalyzer:
    """相关性分析器"""
    
    def calculate_pearson(self, x: List[float], y: List[float]) -> float:
        """计算皮尔逊相关系数"""
        if len(x) != len(y) or len(x) < 2:
            return 0.0
        
        n = len(x)
        x_mean = sum(x) / n
        y_mean = sum(y) / n
        
        numerator = sum((x[i] - x_mean) * (y[i] - y_mean) for i in range(n))
        denominator_x = math.sqrt(sum((x[i] - x_mean) ** 2 for i in range(n)))
        denominator_y = math.sqrt(sum((y[i] - y_mean) ** 2 for i in range(n)))
        
        if denominator_x == 0 or denominator_y == 0:
            return 0.0
        
        return numerator / (denominator_x * denominator_y)
    
    def analyze_environmental_correlation(self, records: List[PestRecord]) -> Dict[str, float]:
        """分析环境因素相关性"""
        severities = [r.severity_level for r in records if r.severity_level is not None]
        
        correlations = {}
        
        temps = [r.temperature for r in records if r.temperature is not None]
        if temps and len(temps) == len(severities):
            correlations['temperature'] = self.calculate_pearson(temps, severities)
        
        humids = [r.humidity for r in records if r.humidity is not None]
        if humids and len(humids) == len(severities):
            correlations['humidity'] = self.calculate_pearson(humids, severities)
        
        rainfalls = [r.rainfall for r in records if r.rainfall is not None]
        if rainfalls and len(rainfalls) == len(severities):
            correlations['rainfall'] = self.calculate_pearson(rainfalls, severities)
        
        return correlations


class TrendAnalyzer:
    """趋势分析主类"""
    
    def __init__(self, storage_path: Optional[str] = None):
        self._records: Dict[str, List[PestRecord]] = defaultdict(list)
        self._region_index: Dict[str, List[str]] = defaultdict(list)
        self._pest_index: Dict[str, List[str]] = defaultdict(list)
        self._record_map: Dict[str, PestRecord] = {}
        
        self.ts_analyzer = TimeSeriesAnalyzer()
        self.corr_analyzer = CorrelationAnalyzer()
        
        self._aggregated_cache: Dict[str, Any] = {}
        self._cache_timestamp = 0
    
    def add_record(self, record: PestRecord):
        """添加记录"""
        key = f"{record.region_id}_{record.pest_type}"
        self._records[key].append(record)
        
        self._region_index[record.region_id].append(record.record_id)
        self._pest_index[record.pest_type].append(record.record_id)
        self._record_map[record.record_id] = record
        
        self._invalidate_cache()
    
    def add_records_batch(self, records: List[PestRecord]):
        """批量添加记录"""
        for record in records:
            self.add_record(record)
    
    def query_records(self, region_id: Optional[str] = None,
                      pest_type: Optional[str] = None,
                      start_time: Optional[float] = None,
                      end_time: Optional[float] = None,
                      min_severity: Optional[int] = None) -> List[PestRecord]:
        """查询记录"""
        candidates = set(self._record_map.keys())
        
        if region_id:
            candidates &= set(self._region_index.get(region_id, []))
        
        if pest_type:
            candidates &= set(self._pest_index.get(pest_type, []))
        
        results = []
        for record_id in candidates:
            record = self._record_map[record_id]
            
            if start_time and record.timestamp < start_time:
                continue
            if end_time and record.timestamp > end_time:
                continue
            if min_severity is not None and record.severity_level < min_severity:
                continue
            
            results.append(record)
        
        return sorted(results, key=lambda r: r.timestamp)
    
    def aggregate_records(self, records: List[PestRecord], 
                          level: AggregationLevel) -> List[Dict]:
        """按时间聚合记录"""
        grouped = defaultdict(list)
        
        for record in records:
            dt = datetime.fromtimestamp(record.timestamp)
            
            if level == AggregationLevel.HOURLY:
                key = dt.strftime("%Y-%m-%d %H:00")
            elif level == AggregationLevel.DAILY:
                key = dt.strftime("%Y-%m-%d")
            elif level == AggregationLevel.WEEKLY:
                year, week, _ = dt.isocalendar()
                key = f"{year}-W{week:02d}"
            elif level == AggregationLevel.MONTHLY:
                key = dt.strftime("%Y-%m")
            else:
                month = dt.month
                if month in [3, 4, 5]:
                    season = "spring"
                elif month in [6, 7, 8]:
                    season = "summer"
                elif month in [9, 10, 11]:
                    season = "autumn"
                else:
                    season = "winter"
                key = f"{dt.year}-{season}"
            
            grouped[key].append(record)
        
        aggregated = []
        for key, group_records in grouped.items():
            avg_severity = sum(r.severity_level for r in group_records) / len(group_records)
            total_area = sum(r.affected_area for r in group_records)
            
            aggregated.append({
                'period': key,
                'record_count': len(group_records),
                'average_severity': avg_severity,
                'max_severity': max(r.severity_level for r in group_records),
                'total_affected_area': total_area,
                'pest_types': list(set(r.pest_type for r in group_records)),
                'timestamp': group_records[0].timestamp,
            })
        
        return sorted(aggregated, key=lambda x: x['timestamp'])
    
    def analyze_trend(self, region_id: str, pest_type: str,
                      start_time: Optional[float] = None,
                      end_time: Optional[float] = None) -> TrendResult:
        """分析趋势"""
        if end_time is None:
            end_time = time.time()
        if start_time is None:
            start_time = end_time - 90 * 24 * 3600
        
        records = self.query_records(
            region_id=region_id,
            pest_type=pest_type,
            start_time=start_time,
            end_time=end_time
        )
        
        if not records:
            return TrendResult(
                pest_type=pest_type,
                region_id=region_id,
                time_span=f"{int((end_time - start_time) / 86400)} days",
                start_time=start_time,
                end_time=end_time,
                total_records=0,
                average_severity=0,
                max_severity=0,
                min_severity=0,
                total_affected_area=0,
                average_affected_area=0,
                trend_direction=TrendDirection.STABLE,
                trend_strength=0,
                trend_slope=0,
                seasonality_index={},
                peak_periods=[],
                correlation_analysis={},
                risk_level="low",
                recommendations=["无历史数据，请持续监测"]
            )
        
        severities = [r.severity_level for r in records]
        areas = [r.affected_area for r in records]
        
        severity_data = [(r.timestamp, r.severity_level) for r in records]
        
        slope = self.ts_analyzer.calculate_trend_slope(severities)
        trend_direction = self.ts_analyzer.determine_trend_direction(slope)
        trend_strength = min(1.0, abs(slope))
        
        seasonality = self.ts_analyzer.calculate_seasonality(severity_data, "season")
        peak_periods = self.ts_analyzer.find_peak_periods(seasonality)
        
        correlations = self.corr_analyzer.analyze_environmental_correlation(records)
        
        forecast = self.ts_analyzer.simple_forecast(severities, periods=1)
        
        risk_level = self._determine_risk_level(
            sum(severities) / len(severities),
            trend_direction,
            forecast[0] if forecast else 0
        )
        
        recommendations = self._generate_recommendations(
            risk_level, trend_direction, peak_periods, correlations
        )
        
        return TrendResult(
            pest_type=pest_type,
            region_id=region_id,
            time_span=f"{int((end_time - start_time) / 86400)} days",
            start_time=start_time,
            end_time=end_time,
            total_records=len(records),
            average_severity=sum(severities) / len(severities),
            max_severity=max(severities),
            min_severity=min(severities),
            total_affected_area=sum(areas),
            average_affected_area=sum(areas) / len(areas) if areas else 0,
            trend_direction=trend_direction,
            trend_strength=trend_strength,
            trend_slope=slope,
            seasonality_index=seasonality,
            peak_periods=peak_periods,
            correlation_analysis=correlations,
            forecast_next_period=forecast[0] if forecast else None,
            forecast_confidence=0.7 if len(records) > 10 else 0.5,
            risk_level=risk_level,
            recommendations=recommendations,
        )
    
    def get_regional_summary(self, region_id: str, 
                             start_time: Optional[float] = None,
                             end_time: Optional[float] = None) -> RegionalSummary:
        """获取区域汇总"""
        records = self.query_records(
            region_id=region_id,
            start_time=start_time,
            end_time=end_time
        )
        
        if not records:
            return RegionalSummary(
                region_id=region_id,
                total_records=0,
                pest_types_count=0,
                most_prevalent_pest="none",
                highest_risk_period="unknown",
                average_severity=0,
                pest_distribution={},
                severity_distribution={},
                hotspots=[]
            )
        
        pest_counts = defaultdict(int)
        severity_counts = defaultdict(int)
        
        for record in records:
            pest_counts[record.pest_type] += 1
            severity_counts[record.severity_level] += 1
        
        most_prevalent = max(pest_counts.items(), key=lambda x: x[1])[0] if pest_counts else "none"
        
        avg_severity = sum(r.severity_level for r in records) / len(records)
        
        seasonal_data = [(r.timestamp, r.severity_level) for r in records]
        seasonality = self.ts_analyzer.calculate_seasonality(seasonal_data, "season")
        highest_risk = max(seasonality.items(), key=lambda x: x[1])[0] if seasonality else "unknown"
        
        hotspots = self._find_hotspots(records)
        
        return RegionalSummary(
            region_id=region_id,
            total_records=len(records),
            pest_types_count=len(pest_counts),
            most_prevalent_pest=most_prevalent,
            highest_risk_period=highest_risk,
            average_severity=avg_severity,
            pest_distribution=dict(pest_counts),
            severity_distribution=dict(severity_counts),
            hotspots=hotspots
        )
    
    def compare_regions(self, region_ids: List[str], pest_type: Optional[str] = None,
                        start_time: Optional[float] = None,
                        end_time: Optional[float] = None) -> Dict[str, Dict]:
        """多区域对比分析"""
        results = {}
        
        for region_id in region_ids:
            records = self.query_records(
                region_id=region_id,
                pest_type=pest_type,
                start_time=start_time,
                end_time=end_time
            )
            
            if records:
                severities = [r.severity_level for r in records]
                areas = [r.affected_area for r in records]
                
                results[region_id] = {
                    'record_count': len(records),
                    'avg_severity': sum(severities) / len(severities),
                    'max_severity': max(severities),
                    'total_area': sum(areas),
                    'pest_types': len(set(r.pest_type for r in records)),
                }
            else:
                results[region_id] = {
                    'record_count': 0,
                    'avg_severity': 0,
                    'max_severity': 0,
                    'total_area': 0,
                    'pest_types': 0,
                }
        
        return results
    
    def _determine_risk_level(self, avg_severity: float, trend: TrendDirection,
                              forecast: float) -> str:
        """确定风险等级"""
        base_score = avg_severity
        
        if trend == TrendDirection.INCREASING:
            base_score += 1
        elif trend == TrendDirection.DECREASING:
            base_score -= 0.5
        
        if forecast > avg_severity * 1.2:
            base_score += 0.5
        
        if base_score >= 4:
            return "critical"
        elif base_score >= 3:
            return "high"
        elif base_score >= 2:
            return "medium"
        else:
            return "low"
    
    def _generate_recommendations(self, risk_level: str, trend: TrendDirection,
                                   peak_periods: List[str], correlations: Dict) -> List[str]:
        """生成建议"""
        recommendations = []
        
        if risk_level in ["critical", "high"]:
            recommendations.append("建议立即开展防治工作")
            recommendations.append("增加监测频次，每日上报数据")
        
        if trend == TrendDirection.INCREASING:
            recommendations.append("病虫害呈上升趋势，建议提前准备防治物资")
        elif trend == TrendDirection.DECREASING:
            recommendations.append("病虫害呈下降趋势，建议巩固防治成果")
        
        if peak_periods:
            recommendations.append(f"历史高发期为：{', '.join(peak_periods)}，建议提前防控")
        
        if correlations.get('temperature', 0) > 0.5:
            recommendations.append("温度与发生程度正相关，高温期加强监测")
        if correlations.get('humidity', 0) > 0.5:
            recommendations.append("湿度与发生程度正相关，高湿期注意防控")
        
        if risk_level == "low":
            recommendations.append("当前风险较低，维持常规监测即可")
        
        return recommendations
    
    def _find_hotspots(self, records: List[PestRecord], top_n: int = 5) -> List[Tuple[str, float]]:
        """找出热点区域（简化版）"""
        severity_by_date = defaultdict(list)
        
        for record in records:
            dt = datetime.fromtimestamp(record.timestamp).strftime("%Y-%m-%d")
            severity_by_date[dt].append(record.severity_level)
        
        hotspots = []
        for date, severities in severity_by_date.items():
            avg_sev = sum(severities) / len(severities)
            if avg_sev >= 3:
                hotspots.append((date, avg_sev))
        
        return sorted(hotspots, key=lambda x: x[1], reverse=True)[:top_n]
    
    def _invalidate_cache(self):
        """使缓存失效"""
        self._aggregated_cache = {}
        self._cache_timestamp = 0
    
    def get_statistics(self) -> Dict:
        """获取统计信息"""
        return {
            'total_records': len(self._record_map),
            'total_regions': len(self._region_index),
            'total_pest_types': len(self._pest_index),
            'records_by_region': {k: len(v) for k, v in self._region_index.items()},
            'records_by_pest': {k: len(v) for k, v in self._pest_index.items()},
        }

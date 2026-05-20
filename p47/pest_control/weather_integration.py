"""
天气API集成模块 - 获取72小时天气预报
"""

import requests
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass


@dataclass
class WeatherHourly:
    """小时天气数据"""
    time: datetime
    temperature: float  # °C
    humidity: float  # %
    wind_speed: float  # m/s
    wind_direction: float  # 度
    precipitation: float  # mm
    cloud_cover: float  # %
    pressure: float  # hPa


@dataclass
class WeatherSummary:
    """天气摘要"""
    location: Tuple[float, float]
    forecast_hours: List[WeatherHourly]
    updated_at: datetime
    source: str


class WeatherAPI:
    """天气API封装 - 支持多个数据源"""
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key
        self.last_request_time = None
        self.cache = {}
    
    def get_weather_forecast(self, lat: float, lng: float, hours: int = 72) -> WeatherSummary:
        """
        获取指定位置的天气预报
        
        Args:
            lat: 纬度
            lng: 经度
            hours: 预报小时数
            
        Returns:
            WeatherSummary对象
        """
        cache_key = f"{lat:.4f}_{lng:.4f}_{hours}"
        
        if cache_key in self.cache:
            cached_data, cache_time = self.cache[cache_key]
            if datetime.now() - cache_time < timedelta(minutes=30):
                return cached_data
        
        try:
            return self._get_openmeteo_forecast(lat, lng, hours)
        except Exception as e:
            print(f"Open-Meteo API failed: {e}")
            return self._generate_synthetic_forecast(lat, lng, hours)
    
    def _get_openmeteo_forecast(self, lat: float, lng: float, hours: int = 72) -> WeatherSummary:
        """使用Open-Meteo免费API获取天气"""
        url = "https://api.open-meteo.com/v1/forecast"
        
        params = {
            'latitude': lat,
            'longitude': lng,
            'hourly': 'temperature_2m,relativehumidity_2m,windspeed_10m,winddirection_10m,precipitation,cloudcover,surface_pressure',
            'forecast_days': 4,  # 4天 = 96小时，取前72小时
            'timezone': 'auto'
        }
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        hourly_data = data.get('hourly', {})
        times = hourly_data.get('time', [])
        temperatures = hourly_data.get('temperature_2m', [])
        humidities = hourly_data.get('relativehumidity_2m', [])
        wind_speeds = hourly_data.get('windspeed_10m', [])
        wind_directions = hourly_data.get('winddirection_10m', [])
        precipitations = hourly_data.get('precipitation', [])
        cloud_covers = hourly_data.get('cloudcover', [])
        pressures = hourly_data.get('surface_pressure', [])
        
        forecast_hours = []
        for i in range(min(hours, len(times))):
            try:
                hour_data = WeatherHourly(
                    time=datetime.fromisoformat(times[i]),
                    temperature=float(temperatures[i]) if temperatures[i] is not None else 20.0,
                    humidity=float(humidities[i]) if humidities[i] is not None else 60.0,
                    wind_speed=float(wind_speeds[i]) if wind_speeds[i] is not None else 2.0,
                    wind_direction=float(wind_directions[i]) if wind_directions[i] is not None else 180.0,
                    precipitation=float(precipitations[i]) if precipitations[i] is not None else 0.0,
                    cloud_cover=float(cloud_covers[i]) if cloud_covers[i] is not None else 50.0,
                    pressure=float(pressures[i]) if pressures[i] is not None else 1013.0
                )
                forecast_hours.append(hour_data)
            except (IndexError, ValueError):
                continue
        
        result = WeatherSummary(
            location=(lat, lng),
            forecast_hours=forecast_hours,
            updated_at=datetime.now(),
            source='Open-Meteo'
        )
        
        cache_key = f"{lat:.4f}_{lng:.4f}_{hours}"
        self.cache[cache_key] = (result, datetime.now())
        
        return result
    
    def _generate_synthetic_forecast(self, lat: float, lng: float, hours: int = 72) -> WeatherSummary:
        """生成模拟天气数据（API失败时使用）"""
        base_temp = 15 + 10 * np.sin(np.radians(lat))
        base_humidity = 40 + 30 * abs(np.sin(np.radians(lng)))
        
        forecast_hours = []
        current_time = datetime.now().replace(minute=0, second=0, microsecond=0)
        
        for i in range(hours):
            hour = current_time + timedelta(hours=i)
            day_hour = hour.hour
            
            temp_variation = 8 * np.sin(np.radians((day_hour - 6) * 15))
            temp = base_temp + temp_variation + np.random.normal(0, 2)
            
            humidity = base_humidity + 20 * np.sin(np.radians((day_hour - 12) * 15))
            humidity = max(20, min(95, humidity + np.random.normal(0, 5)))
            
            wind_speed = 2 + 3 * np.random.rand()
            precipitation = max(0, np.random.exponential(0.5) - 0.3)
            if precipitation > 0:
                precipitation *= 5
            
            forecast_hours.append(WeatherHourly(
                time=hour,
                temperature=round(temp, 1),
                humidity=round(humidity, 1),
                wind_speed=round(wind_speed, 1),
                wind_direction=round(np.random.uniform(0, 360), 1),
                precipitation=round(precipitation, 1),
                cloud_cover=round(np.random.uniform(0, 100), 1),
                pressure=round(1013 + np.random.normal(0, 10), 1)
            ))
        
        return WeatherSummary(
            location=(lat, lng),
            forecast_hours=forecast_hours,
            updated_at=datetime.now(),
            source='Synthetic'
        )


class WeatherAnalyzer:
    """天气分析器 - 评估施药条件"""
    
    @staticmethod
    def calculate_spray_score(hourly_weather: WeatherHourly) -> Dict:
        """
        计算特定小时的施药适宜度评分
        
        Returns:
            score: 0-100，越高越适宜
            issues: 问题列表
        """
        score = 100
        issues = []
        
        if hourly_weather.temperature < 10:
            score -= 20
            issues.append("温度过低，农药活性降低")
        elif hourly_weather.temperature > 35:
            score -= 25
            issues.append("温度过高，农药易分解、药害风险")
        
        if hourly_weather.humidity < 30:
            score -= 15
            issues.append("湿度过低，农药易快速挥发")
        elif hourly_weather.humidity > 90:
            score -= 10
            issues.append("湿度过高，药液不易干燥")
        
        if hourly_weather.wind_speed > 6:
            score -= 40
            issues.append("风速过大，农药漂移风险高")
        elif hourly_weather.wind_speed > 4:
            score -= 20
            issues.append("风速较高，注意漂移控制")
        elif hourly_weather.wind_speed < 0.5:
            score -= 10
            issues.append("风速过小，药液沉降效果差")
        
        if hourly_weather.precipitation > 0.5:
            score = 0
            issues.append("有降雨，会冲刷农药")
        elif hourly_weather.precipitation > 0.1:
            score -= 30
            issues.append("有轻微降雨，可能影响药效")
        
        if hourly_weather.cloud_cover > 80:
            score -= 5
            issues.append("阴天，紫外线弱，部分农药效果可能降低")
        
        return {
            'score': max(0, score),
            'issues': issues,
            'is_suitable': score >= 60
        }
    
    @staticmethod
    def find_best_spray_windows(forecast: WeatherSummary, hours_ahead: int = 72,
                                min_window_hours: int = 4) -> List[Dict]:
        """
        寻找最佳施药时间窗口
        
        Args:
            forecast: 天气预报
            hours_ahead: 提前小时数
            min_window_hours: 最小连续窗口时长
            
        Returns:
            窗口列表，按评分排序
        """
        hourly_scores = []
        for hour_data in forecast.forecast_hours[:hours_ahead]:
            result = WeatherAnalyzer.calculate_spray_score(hour_data)
            hourly_scores.append({
                'time': hour_data.time,
                'weather': hour_data,
                'score': result['score'],
                'is_suitable': result['is_suitable'],
                'issues': result['issues']
            })
        
        windows = []
        i = 0
        while i < len(hourly_scores):
            if hourly_scores[i]['is_suitable']:
                start_idx = i
                while (i < len(hourly_scores) and 
                       hourly_scores[i]['is_suitable']):
                    i += 1
                
                window_length = i - start_idx
                if window_length >= min_window_hours:
                    window_data = hourly_scores[start_idx:i]
                    avg_score = np.mean([h['score'] for h in window_data])
                    
                    windows.append({
                        'start_time': window_data[0]['time'],
                        'end_time': window_data[-1]['time'],
                        'duration_hours': window_length,
                        'average_score': round(avg_score, 1),
                        'max_score': max([h['score'] for h in window_data]),
                        'weather_conditions': {
                            'avg_temp': round(np.mean([h['weather'].temperature for h in window_data]), 1),
                            'avg_humidity': round(np.mean([h['weather'].humidity for h in window_data]), 1),
                            'avg_wind': round(np.mean([h['weather'].wind_speed for h in window_data]), 1),
                            'total_precipitation': round(sum([h['weather'].precipitation for h in window_data]), 1)
                        }
                    })
            else:
                i += 1
        
        windows.sort(key=lambda x: x['average_score'], reverse=True)
        return windows
    
    @staticmethod
    def get_weather_summary(forecast: WeatherSummary) -> Dict:
        """获取天气摘要统计"""
        hours = forecast.forecast_hours
        
        temps = [h.temperature for h in hours]
        humidities = [h.humidity for h in hours]
        winds = [h.wind_speed for h in hours]
        precips = [h.precipitation for h in hours]
        
        return {
            'location': forecast.location,
            'forecast_range': {
                'start': hours[0].time.isoformat() if hours else None,
                'end': hours[-1].time.isoformat() if hours else None,
                'hours': len(hours)
            },
            'temperature': {
                'min': round(min(temps), 1),
                'max': round(max(temps), 1),
                'avg': round(np.mean(temps), 1)
            },
            'humidity': {
                'min': round(min(humidities), 1),
                'max': round(max(humidities), 1),
                'avg': round(np.mean(humidities), 1)
            },
            'wind': {
                'min': round(min(winds), 1),
                'max': round(max(winds), 1),
                'avg': round(np.mean(winds), 1),
                'high_wind_hours': sum(1 for w in winds if w > 4)
            },
            'precipitation': {
                'total': round(sum(precips), 1),
                'rain_hours': sum(1 for p in precips if p > 0.1),
                'heavy_rain_hours': sum(1 for p in precips if p > 5)
            },
            'source': forecast.source,
            'updated_at': forecast.updated_at.isoformat()
        }

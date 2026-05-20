#!/usr/bin/env python3
"""
农田气象数据接口模块
实现气象数据采集、预处理、质量校验功能
"""

import time
import json
import threading
from typing import Dict, List, Optional, Tuple, Callable
from dataclasses import dataclass, asdict
from enum import Enum
from datetime import datetime, timedelta
import math


class WeatherDataSource(Enum):
    """气象数据源类型"""
    LOCAL_SENSOR = "local_sensor"
    PUBLIC_API = "public_api"
    SATELLITE = "satellite"
    MANUAL_INPUT = "manual_input"


class WeatherQuality(Enum):
    """气象数据质量等级"""
    UNKNOWN = "unknown"
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"
    INVALID = "invalid"


@dataclass
class WeatherData:
    """气象数据结构"""
    timestamp: float
    device_id: str
    region_id: str
    data_source: WeatherDataSource
    
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    rainfall: Optional[float] = None
    wind_speed: Optional[float] = None
    wind_direction: Optional[float] = None
    solar_radiation: Optional[float] = None
    leaf_wetness: Optional[float] = None
    soil_temperature: Optional[float] = None
    soil_moisture: Optional[float] = None
    atmospheric_pressure: Optional[float] = None
    
    quality: WeatherQuality = WeatherQuality.UNKNOWN
    confidence: float = 1.0
    
    @classmethod
    def create_empty(cls, device_id: str, region_id: str):
        return cls(
            timestamp=time.time(),
            device_id=device_id,
            region_id=region_id,
            data_source=WeatherDataSource.LOCAL_SENSOR
        )


@dataclass
class WeatherForecast:
    """天气预报数据"""
    region_id: str
    forecast_time: float
    hours_ahead: int
    
    temperature_min: float
    temperature_max: float
    humidity_avg: float
    rainfall_prob: float
    rainfall_amount: float
    wind_speed_avg: float
    
    confidence: float = 0.8


class WeatherDataValidator:
    """气象数据质量校验器"""
    
    VALID_RANGES = {
        'temperature': (-40, 60),
        'humidity': (0, 100),
        'rainfall': (0, 500),
        'wind_speed': (0, 100),
        'wind_direction': (0, 360),
        'solar_radiation': (0, 2000),
        'leaf_wetness': (0, 100),
        'soil_temperature': (-10, 50),
        'soil_moisture': (0, 100),
        'atmospheric_pressure': (800, 1100),
    }
    
    @classmethod
    def validate(cls, data: WeatherData) -> Tuple[WeatherQuality, List[str]]:
        """校验气象数据质量"""
        issues = []
        valid_count = 0
        total_count = 0
        
        for field, (min_val, max_val) in cls.VALID_RANGES.items():
            value = getattr(data, field)
            if value is not None:
                total_count += 1
                if value < min_val or value > max_val:
                    issues.append(f"{field}: {value} 超出范围 [{min_val}, {max_val}]")
                else:
                    valid_count += 1
        
        if total_count == 0:
            return WeatherQuality.INVALID, ["无有效数据字段"]
        
        validity_ratio = valid_count / total_count
        
        if len(issues) == 0 and validity_ratio >= 0.9:
            quality = WeatherQuality.EXCELLENT
        elif validity_ratio >= 0.7:
            quality = WeatherQuality.GOOD
        elif validity_ratio >= 0.5:
            quality = WeatherQuality.FAIR
        elif validity_ratio >= 0.3:
            quality = WeatherQuality.POOR
        else:
            quality = WeatherQuality.INVALID
        
        return quality, issues


class WeatherDataPreprocessor:
    """气象数据预处理器"""
    
    def __init__(self):
        self.moving_avg_window = {
            'temperature': 5,
            'humidity': 5,
            'wind_speed': 3,
        }
        self._history_buffer: Dict[str, List[Tuple[float, Dict]]] = {}
    
    def preprocess(self, data: WeatherData) -> WeatherData:
        """数据预处理主流程"""
        processed = self._interpolate_missing(data)
        processed = self._smooth_noise(processed)
        processed = self._remove_outliers(processed)
        return processed
    
    def _interpolate_missing(self, data: WeatherData) -> WeatherData:
        """缺失值插值"""
        buffer_key = f"{data.device_id}_{data.region_id}"
        if buffer_key not in self._history_buffer:
            self._history_buffer[buffer_key] = []
        
        history = self._history_buffer[buffer_key]
        
        for field in ['temperature', 'humidity', 'wind_speed']:
            if getattr(data, field) is None and history:
                recent_values = [
                    v[1].get(field) for v in history[-3:]
                    if v[1].get(field) is not None
                ]
                if recent_values:
                    setattr(data, field, sum(recent_values) / len(recent_values))
        
        return data
    
    def _smooth_noise(self, data: WeatherData) -> WeatherData:
        """噪声平滑处理"""
        for field, window in self.moving_avg_window.items():
            current = getattr(data, field)
            if current is not None:
                buffer_key = f"{data.device_id}_{data.region_id}_{field}"
                if buffer_key not in self._history_buffer:
                    self._history_buffer[buffer_key] = []
                
                history = self._history_buffer[buffer_key]
                history.append(current)
                if len(history) > window:
                    history.pop(0)
                
                smoothed = sum(history) / len(history)
                setattr(data, field, smoothed)
        
        return data
    
    def _remove_outliers(self, data: WeatherData) -> WeatherData:
        """异常值检测与处理"""
        for field in ['temperature', 'humidity']:
            value = getattr(data, field)
            if value is not None:
                buffer_key = f"{data.device_id}_{data.region_id}_{field}_stats"
                if buffer_key not in self._history_buffer:
                    self._history_buffer[buffer_key] = []
                
                history = self._history_buffer[buffer_key]
                if len(history) >= 5:
                    mean = sum(history) / len(history)
                    std = math.sqrt(sum((x - mean) ** 2 for x in history) / len(history))
                    if abs(value - mean) > 3 * std:
                        setattr(data, field, mean)
                
                history.append(value)
                if len(history) > 20:
                    history.pop(0)
        
        return data


class WeatherDataCollector:
    """气象数据采集器"""
    
    def __init__(self):
        self._devices: Dict[str, Dict] = {}
        self._callbacks: List[Callable[[WeatherData], None]] = []
        self._collection_thread: Optional[threading.Thread] = None
        self._running = False
        self._data_cache: Dict[str, List[WeatherData]] = {}
        self._lock = threading.Lock()
        self.validator = WeatherDataValidator()
        self.preprocessor = WeatherDataPreprocessor()
    
    def register_device(self, device_id: str, device_config: Dict):
        """注册气象设备"""
        with self._lock:
            self._devices[device_id] = {
                'config': device_config,
                'last_poll': 0,
                'data_count': 0,
            }
    
    def add_data_callback(self, callback: Callable[[WeatherData], None]):
        """添加数据回调"""
        self._callbacks.append(callback)
    
    def collect_from_device(self, device_id: str, region_id: str) -> Optional[WeatherData]:
        """从设备采集数据"""
        data = WeatherData.create_empty(device_id, region_id)
        
        import random
        data.temperature = 20 + random.uniform(-5, 15)
        data.humidity = 60 + random.uniform(-20, 30)
        data.rainfall = random.uniform(0, 10) if random.random() < 0.3 else 0
        data.wind_speed = random.uniform(0, 15)
        data.wind_direction = random.uniform(0, 360)
        data.solar_radiation = random.uniform(100, 800)
        data.leaf_wetness = random.uniform(0, 40) if data.rainfall > 1 else random.uniform(0, 5)
        data.soil_temperature = 18 + random.uniform(-3, 8)
        data.soil_moisture = 40 + random.uniform(-20, 30)
        data.atmospheric_pressure = 1013 + random.uniform(-20, 20)
        
        quality, issues = self.validator.validate(data)
        data.quality = quality
        data.confidence = max(0.3, 1.0 - len(issues) * 0.1)
        
        processed = self.preprocessor.preprocess(data)
        
        cache_key = f"{device_id}_{region_id}"
        with self._lock:
            if cache_key not in self._data_cache:
                self._data_cache[cache_key] = []
            self._data_cache[cache_key].append(processed)
            if len(self._data_cache[cache_key]) > 1000:
                self._data_cache[cache_key] = self._data_cache[cache_key][-500:]
        
        for callback in self._callbacks:
            try:
                callback(processed)
            except Exception as e:
                print(f"Callback error: {e}")
        
        return processed
    
    def get_recent_data(self, device_id: str, region_id: str, hours: float = 24) -> List[WeatherData]:
        """获取最近的气象数据"""
        cache_key = f"{device_id}_{region_id}"
        cutoff = time.time() - hours * 3600
        
        with self._lock:
            if cache_key not in self._data_cache:
                return []
            return [
                d for d in self._data_cache[cache_key]
                if d.timestamp >= cutoff
            ]
    
    def get_aggregate_stats(self, region_id: str, hours: float = 24) -> Dict:
        """获取区域聚合统计"""
        all_data = []
        with self._lock:
            for key, data_list in self._data_cache.items():
                if key.endswith(f"_{region_id}"):
                    all_data.extend(data_list)
        
        cutoff = time.time() - hours * 3600
        filtered = [d for d in all_data if d.timestamp >= cutoff]
        
        if not filtered:
            return {}
        
        temps = [d.temperature for d in filtered if d.temperature is not None]
        humids = [d.humidity for d in filtered if d.humidity is not None]
        rains = [d.rainfall for d in filtered if d.rainfall is not None]
        
        return {
            'temperature': {
                'min': min(temps) if temps else None,
                'max': max(temps) if temps else None,
                'avg': sum(temps) / len(temps) if temps else None,
            },
            'humidity': {
                'min': min(humids) if humids else None,
                'max': max(humids) if humids else None,
                'avg': sum(humids) / len(humids) if humids else None,
            },
            'total_rainfall': sum(rains) if rains else 0,
            'data_points': len(filtered),
            'period_hours': hours,
        }
    
    def start_collection(self, interval_seconds: int = 300):
        """启动自动采集"""
        if self._running:
            return
        
        self._running = True
        self._collection_thread = threading.Thread(
            target=self._collection_loop,
            args=(interval_seconds,),
            daemon=True
        )
        self._collection_thread.start()
    
    def stop_collection(self):
        """停止采集"""
        self._running = False
        if self._collection_thread:
            self._collection_thread.join(timeout=5)
    
    def _collection_loop(self, interval: int):
        """采集循环"""
        while self._running:
            with self._lock:
                devices = list(self._devices.keys())
            
            for device_id in devices:
                config = self._devices[device_id]['config']
                region_id = config.get('region_id', 'default')
                self.collect_from_device(device_id, region_id)
            
            time.sleep(interval)

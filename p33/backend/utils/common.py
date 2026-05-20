import os
import sys
import json
import time
import hashlib
from typing import Any, Dict, List, Optional, Callable
from datetime import datetime
from functools import wraps
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SingletonMeta(type):
    _instances: Dict[type, Any] = {}

    def __call__(cls, *args, **kwargs):
        if cls not in cls._instances:
            cls._instances[cls] = super().__call__(*args, **kwargs)
        return cls._instances[cls]


class PerformanceMonitor:
    def __init__(self):
        self.start_times: Dict[str, float] = {}
        self.metrics: Dict[str, List[float]] = {}

    def start(self, name: str):
        self.start_times[name] = time.perf_counter()

    def end(self, name: str) -> float:
        if name not in self.start_times:
            return 0.0
        elapsed = time.perf_counter() - self.start_times[name]
        if name not in self.metrics:
            self.metrics[name] = []
        self.metrics[name].append(elapsed)
        del self.start_times[name]
        return elapsed

    def get_average(self, name: str) -> float:
        if name not in self.metrics or not self.metrics[name]:
            return 0.0
        return sum(self.metrics[name]) / len(self.metrics[name])

    def get_stats(self) -> Dict[str, Any]:
        return {
            name: {
                "count": len(values),
                "avg": sum(values) / len(values) if values else 0,
                "min": min(values) if values else 0,
                "max": max(values) if values else 0
            }
            for name, values in self.metrics.items()
        }


performance_monitor = PerformanceMonitor()


def measure_time(func: Callable) -> Callable:
    @wraps(func)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        try:
            return func(*args, **kwargs)
        finally:
            elapsed = time.perf_counter() - start
            logger.debug(f"{func.__name__} 耗时: {elapsed:.4f}s")
    return wrapper


def lazy_load(func: Callable) -> Callable:
    result: List[Any] = []

    @wraps(func)
    def wrapper(*args, **kwargs):
        if not result:
            result.append(func(*args, **kwargs))
        return result[0]
    return wrapper


class ConfigManager(metaclass=SingletonMeta):
    def __init__(self):
        self.config: Dict[str, Any] = {}
        self._load_defaults()

    def _load_defaults(self):
        self.config = {
            "cache": {
                "max_size_mb": 512,
                "ttl_seconds": 3600,
                "auto_clean_interval": 300
            },
            "image": {
                "max_dimension": 8000,
                "jpeg_quality": 85,
                "thumbnail_size": 256
            },
            "scanner": {
                "buffer_size": 10,
                "auto_reconnect": True,
                "reconnect_attempts": 3
            },
            "diagnostics": {
                "enabled": True,
                "check_interval": 60,
                "alert_threshold": 3
            }
        }

    def get(self, key: str, default: Any = None) -> Any:
        keys = key.split('.')
        value = self.config
        for k in keys:
            if isinstance(value, dict) and k in value:
                value = value[k]
            else:
                return default
        return value

    def set(self, key: str, value: Any):
        keys = key.split('.')
        config = self.config
        for k in keys[:-1]:
            if k not in config:
                config[k] = {}
            config = config[k]
        config[keys[-1]] = value


config_manager = ConfigManager()


class MemoryTracker(metaclass=SingletonMeta):
    def __init__(self):
        self.objects: Dict[str, int] = {}
        self.total_allocated = 0

    def track(self, obj: Any, size: int = 0):
        obj_id = str(id(obj))
        self.objects[obj_id] = size
        self.total_allocated += size

    def release(self, obj: Any):
        obj_id = str(id(obj))
        if obj_id in self.objects:
            self.total_allocated -= self.objects[obj_id]
            del self.objects[obj_id]

    def get_usage_mb(self) -> float:
        return self.total_allocated / (1024 * 1024)

    def get_object_count(self) -> int:
        return len(self.objects)


memory_tracker = MemoryTracker()


def get_platform_info() -> Dict[str, str]:
    return {
        "system": sys.platform,
        "platform": sys.platform,
        "python_version": sys.version,
        "is_windows": sys.platform == "win32",
        "is_macos": sys.platform == "darwin",
        "is_linux": sys.platform.startswith("linux")
    }


def file_hash(filepath: str) -> str:
    sha256 = hashlib.sha256()
    with open(filepath, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            sha256.update(chunk)
    return sha256.hexdigest()


def safe_delete(filepath: str) -> bool:
    try:
        if os.path.exists(filepath):
            os.remove(filepath)
            return True
    except Exception as e:
        logger.warning(f"删除文件失败 {filepath}: {e}")
    return False


def ensure_directory(dirpath: str) -> str:
    os.makedirs(dirpath, exist_ok=True)
    return dirpath


def format_bytes(bytes_val: int) -> str:
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_val < 1024:
            return f"{bytes_val:.1f} {unit}"
        bytes_val /= 1024
    return f"{bytes_val:.1f} TB"


class EventBus(metaclass=SingletonMeta):
    def __init__(self):
        self.listeners: Dict[str, List[Callable]] = {}

    def on(self, event: str, callback: Callable):
        if event not in self.listeners:
            self.listeners[event] = []
        self.listeners[event].append(callback)

    def emit(self, event: str, *args, **kwargs):
        if event in self.listeners:
            for callback in self.listeners[event]:
                try:
                    callback(*args, **kwargs)
                except Exception as e:
                    logger.error(f"事件回调错误 {event}: {e}")

    def off(self, event: str, callback: Callable = None):
        if event not in self.listeners:
            return
        if callback:
            if callback in self.listeners[event]:
                self.listeners[event].remove(callback)
        else:
            del self.listeners[event]


event_bus = EventBus()

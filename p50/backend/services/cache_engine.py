import os
import json
import hashlib
import logging
import time
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from collections import OrderedDict
from pathlib import Path
import asyncio
from functools import wraps

logger = logging.getLogger(__name__)

class CacheLevel:
    L1 = "l1"
    L2 = "l2"
    L3 = "l3"

@dataclass
class CacheEntry:
    key: str
    value: Any
    created_at: float = field(default_factory=time.time)
    accessed_at: float = field(default_factory=time.time)
    access_count: int = 0
    ttl_seconds: Optional[float] = None
    size_bytes: int = 0
    
    def is_expired(self) -> bool:
        if self.ttl_seconds is None:
            return False
        return (time.time() - self.created_at) > self.ttl_seconds
    
    def touch(self):
        self.accessed_at = time.time()
        self.access_count += 1

class LRUCache:
    def __init__(self, capacity: int = 1000, max_size_bytes: int = 100 * 1024 * 1024):
        self.capacity = capacity
        self.max_size_bytes = max_size_bytes
        self.cache: OrderedDict[str, CacheEntry] = OrderedDict()
        self.current_size_bytes = 0
        self.hits = 0
        self.misses = 0
    
    def get(self, key: str) -> Optional[Any]:
        if key not in self.cache:
            self.misses += 1
            return None
        
        entry = self.cache[key]
        if entry.is_expired():
            del self.cache[key]
            self.current_size_bytes -= entry.size_bytes
            self.misses += 1
            return None
        
        entry.touch()
        self.cache.move_to_end(key)
        self.hits += 1
        return entry.value
    
    def put(self, key: str, value: Any, ttl_seconds: Optional[float] = None) -> bool:
        try:
            value_bytes = len(json.dumps(value, ensure_ascii=False).encode()) if hasattr(value, '__len__') else 64
        except:
            value_bytes = 128
        
        if value_bytes > self.max_size_bytes * 0.5:
            return False
        
        if key in self.cache:
            old_entry = self.cache[key]
            self.current_size_bytes -= old_entry.size_bytes
            del self.cache[key]
        
        while len(self.cache) >= self.capacity or (self.current_size_bytes + value_bytes > self.max_size_bytes and self.cache):
            evicted_key, evicted_entry = self.cache.popitem(last=False)
            self.current_size_bytes -= evicted_entry.size_bytes
        
        entry = CacheEntry(
            key=key,
            value=value,
            ttl_seconds=ttl_seconds,
            size_bytes=value_bytes
        )
        self.cache[key] = entry
        self.current_size_bytes += value_bytes
        return True
    
    def clear(self):
        self.cache.clear()
        self.current_size_bytes = 0
        self.hits = 0
        self.misses = 0
    
    def get_stats(self) -> Dict[str, Any]:
        total_requests = self.hits + self.misses
        hit_rate = (self.hits / total_requests * 100) if total_requests > 0 else 0
        
        return {
            "entries_count": len(self.cache),
            "size_bytes": self.current_size_bytes,
            "size_mb": round(self.current_size_bytes / (1024 * 1024), 2),
            "capacity": self.capacity,
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate_percent": round(hit_rate, 2),
            "avg_entry_size": round(self.current_size_bytes / len(self.cache), 2) if self.cache else 0
        }

class DiskCache:
    def __init__(self, cache_dir: str = "./cache/disk", max_size_gb: float = 10.0):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.max_size_bytes = max_size_gb * 1024 * 1024 * 1024
        self.index_file = self.cache_dir / "index.json"
        self.index = self._load_index()
        self.hits = 0
        self.misses = 0
    
    def _load_index(self) -> Dict:
        if self.index_file.exists():
            try:
                with open(self.index_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                pass
        return {"files": {}, "total_size_bytes": 0}
    
    def _save_index(self):
        with open(self.index_file, 'w', encoding='utf-8') as f:
            json.dump(self.index, f, ensure_ascii=False, indent=2)
    
    def _get_file_path(self, key: str) -> Path:
        hashed = hashlib.sha256(key.encode()).hexdigest()
        return self.cache_dir / hashed[:2] / f"{hashed}.json"
    
    def get(self, key: str) -> Optional[Any]:
        if key not in self.index["files"]:
            self.misses += 1
            return None
        
        file_info = self.index["files"][key]
        
        if file_info.get("expires_at") and file_info["expires_at"] < time.time():
            self._delete(key)
            self.misses += 1
            return None
        
        file_path = self._get_file_path(key)
        if not file_path.exists():
            self._delete(key)
            self.misses += 1
            return None
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                value = json.load(f)
            
            file_info["accessed_at"] = time.time()
            file_info["access_count"] = file_info.get("access_count", 0) + 1
            self._save_index()
            self.hits += 1
            return value
        except Exception as e:
            logger.error(f"Disk cache read error: {e}")
            self._delete(key)
            self.misses += 1
            return None
    
    def put(self, key: str, value: Any, ttl_seconds: Optional[float] = None) -> bool:
        try:
            value_str = json.dumps(value, ensure_ascii=False)
            value_bytes = len(value_str.encode())
        except Exception as e:
            logger.error(f"Disk cache serialization error: {e}")
            return False
        
        self._ensure_capacity(value_bytes)
        
        file_path = self._get_file_path(key)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(value_str)
        except Exception as e:
            logger.error(f"Disk cache write error: {e}")
            return False
        
        if key in self.index["files"]:
            old_size = self.index["files"][key]["size_bytes"]
            self.index["total_size_bytes"] -= old_size
        
        self.index["files"][key] = {
            "file_path": str(file_path),
            "size_bytes": value_bytes,
            "created_at": time.time(),
            "accessed_at": time.time(),
            "access_count": 1,
            "expires_at": time.time() + ttl_seconds if ttl_seconds else None
        }
        self.index["total_size_bytes"] += value_bytes
        self._save_index()
        
        return True
    
    def _delete(self, key: str):
        if key in self.index["files"]:
            file_info = self.index["files"][key]
            try:
                Path(file_info["file_path"]).unlink(missing_ok=True)
            except:
                pass
            self.index["total_size_bytes"] -= file_info["size_bytes"]
            del self.index["files"][key]
            self._save_index()
    
    def _ensure_capacity(self, needed_bytes: int):
        while self.index["total_size_bytes"] + needed_bytes > self.max_size_bytes and self.index["files"]:
            oldest_key = min(
                self.index["files"].keys(),
                key=lambda k: self.index["files"][k]["accessed_at"]
            )
            self._delete(oldest_key)
    
    def clear(self):
        for key in list(self.index["files"].keys()):
            self._delete(key)
        self.hits = 0
        self.misses = 0
    
    def get_stats(self) -> Dict[str, Any]:
        total_requests = self.hits + self.misses
        hit_rate = (self.hits / total_requests * 100) if total_requests > 0 else 0
        
        return {
            "files_count": len(self.index["files"]),
            "total_size_bytes": self.index["total_size_bytes"],
            "total_size_gb": round(self.index["total_size_bytes"] / (1024**3), 3),
            "max_size_gb": round(self.max_size_bytes / (1024**3), 1),
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate_percent": round(hit_rate, 2)
        }

class PreloadManager:
    def __init__(self, dialect_ids: List[int] = None):
        self.dialect_ids = dialect_ids or [1, 2, 3, 4, 5]
        self.preload_queue: List[str] = []
        self.preloaded = set()
        self.is_preloading = False
    
    def generate_preload_keys(self, count: int = 100) -> List[str]:
        keys = []
        common_phrases = [
            "你好", "谢谢", "再见", "早上好", "晚上好",
            "今天天气怎么样", "我喜欢你", "这是什么", "多少钱",
            "在哪里", "什么时候", "为什么", "怎么办",
            "我要吃饭", "我要喝水", "我要回家", "我要睡觉"
        ]
        
        for dialect_id in self.dialect_ids:
            for phrase in common_phrases:
                for speed in [0.8, 1.0, 1.2]:
                    for emotion in ["neutral", "happy", "sad"]:
                        key = f"synthesis:{dialect_id}:{phrase}:{speed}:{emotion}"
                        keys.append(key)
                        if len(keys) >= count:
                            return keys
        return keys
    
    async def start_preload(self, cache_instance, count: int = 50):
        if self.is_preloading:
            return
        
        self.is_preloading = True
        keys = self.generate_preload_keys(count)
        
        for key in keys:
            if key in self.preloaded:
                continue
            await asyncio.sleep(0.01)
            self.preloaded.add(key)
        
        logger.info(f"Preloaded {len(self.preloaded)} cache keys")
        self.is_preloading = False

class MultiLevelCache:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if hasattr(self, '_initialized'):
            return
        self._initialized = True
        
        self.l1 = LRUCache(capacity=2000, max_size_bytes=200 * 1024 * 1024)
        self.l2 = LRUCache(capacity=10000, max_size_bytes=1 * 1024 * 1024 * 1024)
        self.l3 = DiskCache(max_size_gb=10.0)
        
        self.preload_manager = PreloadManager()
        self.default_ttl = {
            CacheLevel.L1: 300,
            CacheLevel.L2: 3600,
            CacheLevel.L3: 86400 * 7
        }
        
        logger.info("Multi-level cache initialized: L1 (200MB), L2 (1GB), L3 (10GB)")
    
    def get(self, key: str) -> Optional[Any]:
        value = self.l1.get(key)
        if value is not None:
            return value
        
        value = self.l2.get(key)
        if value is not None:
            self.l1.put(key, value, self.default_ttl[CacheLevel.L1])
            return value
        
        value = self.l3.get(key)
        if value is not None:
            self.l2.put(key, value, self.default_ttl[CacheLevel.L2])
            self.l1.put(key, value, self.default_ttl[CacheLevel.L1])
            return value
        
        return None
    
    def put(self, key: str, value: Any, ttl_seconds: Optional[float] = None) -> bool:
        ttl = ttl_seconds or self.default_ttl[CacheLevel.L1]
        self.l1.put(key, value, ttl)
        self.l2.put(key, value, ttl_seconds or self.default_ttl[CacheLevel.L2])
        self.l3.put(key, value, ttl_seconds or self.default_ttl[CacheLevel.L3])
        return True
    
    def invalidate(self, pattern: str):
        for cache in [self.l1, self.l2]:
            keys_to_delete = [k for k in cache.cache.keys() if pattern in k]
            for k in keys_to_delete:
                del cache.cache[k]
        
        for key in list(self.l3.index["files"].keys()):
            if pattern in key:
                self.l3._delete(key)
    
    def clear_all(self):
        self.l1.clear()
        self.l2.clear()
        self.l3.clear()
    
    def get_stats(self) -> Dict[str, Any]:
        return {
            "L1": self.l1.get_stats(),
            "L2": self.l2.get_stats(),
            "L3": self.l3.get_stats(),
            "overall": {
                "total_hit_rate_percent": round(
                    (self.l1.hits + self.l2.hits + self.l3.hits) /
                    max(self.l1.hits + self.l1.misses + self.l2.hits + self.l2.misses + self.l3.hits + self.l3.misses, 1) * 100,
                    2
                )
            }
        }

def cached(ttl_seconds: Optional[float] = None, key_prefix: str = ""):
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            cache = MultiLevelCache()
            cache_key = _generate_cache_key(key_prefix or func.__name__, args, kwargs)
            
            cached_value = cache.get(cache_key)
            if cached_value is not None:
                return cached_value
            
            result = await func(*args, **kwargs)
            cache.put(cache_key, result, ttl_seconds)
            return result
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            cache = MultiLevelCache()
            cache_key = _generate_cache_key(key_prefix or func.__name__, args, kwargs)
            
            cached_value = cache.get(cache_key)
            if cached_value is not None:
                return cached_value
            
            result = func(*args, **kwargs)
            cache.put(cache_key, result, ttl_seconds)
            return result
        
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    return decorator

def _generate_cache_key(name: str, args: tuple, kwargs: dict) -> str:
    key_parts = [name]
    
    for arg in args:
        if isinstance(arg, (str, int, float, bool)):
            key_parts.append(str(arg))
        elif hasattr(arg, '__dict__'):
            key_parts.append(str(arg.__class__.__name__))
    
    for k, v in sorted(kwargs.items()):
        if isinstance(v, (str, int, float, bool)):
            key_parts.append(f"{k}:{v}")
    
    key_str = "|".join(key_parts)
    hashed = hashlib.md5(key_str.encode()).hexdigest()
    return f"{name}:{hashed}"

class HotDataManager:
    def __init__(self, cache: MultiLevelCache):
        self.cache = cache
        self.access_frequencies: Dict[str, int] = {}
        self.last_hour_access = OrderedDict()
        self.hot_threshold = 10
    
    def record_access(self, key: str):
        self.access_frequencies[key] = self.access_frequencies.get(key, 0) + 1
        self.last_hour_access[key] = time.time()
        
        cutoff = time.time() - 3600
        old_keys = [k for k, v in self.last_hour_access.items() if v < cutoff]
        for k in old_keys:
            del self.last_hour_access[k]
    
    def get_hot_keys(self, top_n: int = 100) -> List[str]:
        sorted_keys = sorted(
            self.access_frequencies.keys(),
            key=lambda k: self.access_frequencies[k],
            reverse=True
        )
        return sorted_keys[:top_n]
    
    async def promote_hot_data(self):
        hot_keys = self.get_hot_keys(200)
        promoted = 0
        
        for key in hot_keys:
            if key in self.cache.l1.cache:
                continue
            
            value = self.cache.l2.get(key)
            if value is not None:
                self.cache.l1.put(key, value, 600)
                promoted += 1
        
        if promoted > 0:
            logger.info(f"Promoted {promoted} hot keys to L1 cache")

class CacheInvalidationManager:
    def __init__(self, cache: MultiLevelCache):
        self.cache = cache
        self.invalidation_rules: Dict[str, List[str]] = {}
        self.dependency_map: Dict[str, List[str]] = {}
    
    def register_dependency(self, cache_key: str, dependent_keys: List[str]):
        self.dependency_map[cache_key] = dependent_keys
    
    def invalidate_dependents(self, changed_key: str):
        if changed_key in self.dependency_map:
            for dep_key in self.dependency_map[changed_key]:
                self.cache.invalidate(dep_key)
            logger.info(f"Invalidated {len(self.dependency_map[changed_key])} dependent cache entries")
    
    def bulk_invalidate(self, patterns: List[str]):
        for pattern in patterns:
            self.cache.invalidate(pattern)

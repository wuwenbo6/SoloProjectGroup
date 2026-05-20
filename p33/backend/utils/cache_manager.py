import gc
import time
import threading
from typing import Any, Dict, Optional, Callable
from collections import OrderedDict
import logging
from .common import SingletonMeta, config_manager, memory_tracker, event_bus, measure_time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class CacheItem:
    def __init__(self, key: str, value: Any, size: int = 0, ttl: int = None):
        self.key = key
        self.value = value
        self.size = size
        self.created_at = time.time()
        self.last_accessed = self.created_at
        self.access_count = 0
        self.ttl = ttl

    def touch(self):
        self.last_accessed = time.time()
        self.access_count += 1

    def is_expired(self) -> bool:
        if self.ttl is None:
            return False
        return time.time() - self.created_at > self.ttl

    def get_age(self) -> float:
        return time.time() - self.created_at


class MemoryCache(metaclass=SingletonMeta):
    def __init__(self):
        self.cache: OrderedDict[str, CacheItem] = OrderedDict()
        self.max_size = config_manager.get('cache.max_size_mb', 512) * 1024 * 1024
        self.current_size = 0
        self.ttl_default = config_manager.get('cache.ttl_seconds', 3600)
        self.lock = threading.RLock()
        self.cleanup_thread = None
        self.running = False
        self.hits = 0
        self.misses = 0
        self.evictions = 0

    def start_auto_cleanup(self):
        if self.cleanup_thread and self.cleanup_thread.is_alive():
            return
        self.running = True
        interval = config_manager.get('cache.auto_clean_interval', 300)
        self.cleanup_thread = threading.Thread(
            target=self._auto_cleanup_worker,
            args=(interval,),
            daemon=True
        )
        self.cleanup_thread.start()
        logger.info("自动缓存清理线程已启动")

    def stop_auto_cleanup(self):
        self.running = False
        if self.cleanup_thread:
            self.cleanup_thread.join(timeout=5)

    def _auto_cleanup_worker(self, interval: int):
        while self.running:
            try:
                time.sleep(interval)
                self.cleanup()
            except Exception as e:
                logger.error(f"自动清理错误: {e}")

    @measure_time
    def get(self, key: str, default: Any = None) -> Any:
        with self.lock:
            if key not in self.cache:
                self.misses += 1
                return default

            item = self.cache[key]
            if item.is_expired():
                self._evict_item(key)
                self.misses += 1
                return default

            item.touch()
            self.cache.move_to_end(key)
            self.hits += 1
            return item.value

    @measure_time
    def set(self, key: str, value: Any, size: int = 0, ttl: int = None) -> bool:
        with self.lock:
            if key in self.cache:
                self._evict_item(key)

            if size > self.max_size:
                logger.warning(f"缓存项 {key} 大小超出限制，无法缓存")
                return False

            while self.current_size + size > self.max_size * 0.9:
                if not self._evict_lru():
                    break

            item = CacheItem(key, value, size, ttl or self.ttl_default)
            self.cache[key] = item
            self.current_size += size
            memory_tracker.track(value, size)
            return True

    def delete(self, key: str) -> bool:
        with self.lock:
            if key in self.cache:
                self._evict_item(key)
                return True
            return False

    def _evict_item(self, key: str):
        item = self.cache.pop(key)
        self.current_size -= item.size
        memory_tracker.release(item.value)
        self.evictions += 1

    def _evict_lru(self) -> bool:
        if not self.cache:
            return False
        key = next(iter(self.cache))
        self._evict_item(key)
        return True

    def cleanup(self) -> int:
        with self.lock:
            cleaned = 0
            keys_to_remove = []

            for key, item in self.cache.items():
                if item.is_expired():
                    keys_to_remove.append(key)

            for key in keys_to_remove:
                self._evict_item(key)
                cleaned += 1

            if cleaned > 0:
                logger.info(f"清理了 {cleaned} 个过期缓存项")

            gc.collect()
            return cleaned

    def clear(self):
        with self.lock:
            keys = list(self.cache.keys())
            for key in keys:
                self._evict_item(key)
            gc.collect()
            logger.info("缓存已全部清空")

    def get_stats(self) -> Dict[str, Any]:
        with self.lock:
            total_requests = self.hits + self.misses
            hit_rate = (self.hits / total_requests * 100) if total_requests > 0 else 0
            return {
                "items_count": len(self.cache),
                "current_size_mb": self.current_size / (1024 * 1024),
                "max_size_mb": self.max_size / (1024 * 1024),
                "hit_count": self.hits,
                "miss_count": self.misses,
                "hit_rate_percent": round(hit_rate, 2),
                "eviction_count": self.evictions
            }


memory_cache = MemoryCache()


class ImageCache:
    def __init__(self):
        self.cache = memory_cache
        self.prefix = "image:"

    def get_image(self, image_id: str) -> Optional[Any]:
        return self.cache.get(f"{self.prefix}{image_id}")

    def set_image(self, image_id: str, image: Any, size: int, ttl: int = None) -> bool:
        return self.cache.set(f"{self.prefix}{image_id}", image, size, ttl)

    def delete_image(self, image_id: str) -> bool:
        return self.cache.delete(f"{self.prefix}{image_id}")

    def get_or_load(self, image_id: str, loader: Callable, size: int = 0) -> Any:
        image = self.get_image(image_id)
        if image is not None:
            return image
        image = loader()
        if image is not None:
            self.set_image(image_id, image, size)
        return image


image_cache = ImageCache()


class ThumbnailCache:
    def __init__(self):
        self.cache = memory_cache
        self.prefix = "thumb:"

    def get(self, photo_id: int, size: int = 256) -> Optional[Any]:
        return self.cache.get(f"{self.prefix}{photo_id}_{size}")

    def set(self, photo_id: int, thumbnail: Any, size: int = 256, ttl: int = 7200) -> bool:
        return self.cache.set(f"{self.prefix}{photo_id}_{size}", thumbnail, size, ttl)

    def delete(self, photo_id: int):
        for key in list(self.cache.cache.keys()):
            if key.startswith(f"{self.prefix}{photo_id}_"):
                self.cache.delete(key)


thumbnail_cache = ThumbnailCache()


def cached(ttl: int = 3600, key_prefix: str = ""):
    def decorator(func: Callable) -> Callable:
        def wrapper(*args, **kwargs):
            cache_key = f"{key_prefix}{func.__name__}:{str(args)}:{str(kwargs)}"
            result = memory_cache.get(cache_key)
            if result is not None:
                return result
            result = func(*args, **kwargs)
            if result is not None:
                memory_cache.set(cache_key, result, size=1024, ttl=ttl)
            return result
        return wrapper
    return decorator


def clear_function_cache(func_name: str):
    keys_to_clear = []
    for key in memory_cache.cache.keys():
        if f":{func_name}:" in key:
            keys_to_clear.append(key)
    for key in keys_to_clear:
        memory_cache.delete(key)

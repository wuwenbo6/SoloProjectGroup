import importlib
import gc
import threading
import logging
from typing import Any, Callable, Optional, Dict, Type
from dataclasses import dataclass, field
from functools import wraps
import weakref
import time


class LazyImport:
    def __init__(self, module_name: str, attr_name: Optional[str] = None):
        self.module_name = module_name
        self.attr_name = attr_name
        self._module: Optional[Any] = None
        self._lock = threading.Lock()

    def __get__(self, instance: Any, owner: Any) -> Any:
        if self._module is None:
            with self._lock:
                if self._module is None:
                    self._module = importlib.import_module(self.module_name)
                    if self.attr_name:
                        self._module = getattr(self._module, self.attr_name)
        return self._module

    def reset(self):
        self._module = None


@dataclass
class ResourceStats:
    total_objects: int = 0
    loaded_modules: int = 0
    memory_usage_mb: float = 0.0
    cache_hits: int = 0
    cache_misses: int = 0


class ResourceManager:
    def __init__(self, max_memory_mb: float = 1024.0):
        self.logger = logging.getLogger("ResourceManager")
        self.max_memory_mb = max_memory_mb
        self._lazy_modules: Dict[str, LazyImport] = {}
        self._object_cache: Dict[str, weakref.ref] = {}
        self._gc_threshold: int = 100
        self._allocation_count: int = 0
        self._lock = threading.Lock()
        self.stats = ResourceStats()
        self._last_gc_time: float = time.time()

    def lazy_import(self, name: str, attr_name: Optional[str] = None) -> LazyImport:
        key = f"{name}:{attr_name}" if attr_name else name
        if key not in self._lazy_modules:
            self._lazy_modules[key] = LazyImport(name, attr_name)
        return self._lazy_modules[key]

    def cache_object(self, key: str, obj: Any, ttl_seconds: float = 300.0):
        with self._lock:
            self._object_cache[key] = (weakref.ref(obj), time.time() + ttl_seconds)
            self.stats.total_objects = len(self._object_cache)

    def get_cached(self, key: str) -> Optional[Any]:
        with self._lock:
            if key in self._object_cache:
                ref, expire_time = self._object_cache[key]
                if time.time() < expire_time:
                    obj = ref()
                    if obj is not None:
                        self.stats.cache_hits += 1
                        return obj
                del self._object_cache[key]
            self.stats.cache_misses += 1
            return None

    def clear_cache(self, older_than_seconds: Optional[float] = None):
        with self._lock:
            if older_than_seconds is None:
                self._object_cache.clear()
            else:
                cutoff = time.time() - older_than_seconds
                expired_keys = [
                    k for k, (_, expire_time) in self._object_cache.items()
                    if expire_time < cutoff
                ]
                for k in expired_keys:
                    del self._object_cache[k]
            self.stats.total_objects = len(self._object_cache)

    def force_gc(self):
        gc.collect()
        gc.collect()
        self._last_gc_time = time.time()
        self._update_memory_stats()

    def conditional_gc(self):
        self._allocation_count += 1
        if self._allocation_count >= self._gc_threshold:
            self._allocation_count = 0
            current_memory = self._get_current_memory()
            if current_memory > self.max_memory_mb * 0.8:
                self.force_gc()

    def _get_current_memory(self) -> float:
        try:
            import psutil
            import os
            process = psutil.Process(os.getpid())
            return process.memory_info().rss / (1024 * 1024)
        except ImportError:
            return 0.0

    def _update_memory_stats(self):
        self.stats.memory_usage_mb = self._get_current_memory()

    def get_stats(self) -> ResourceStats:
        self._update_memory_stats()
        self.stats.loaded_modules = sum(
            1 for lm in self._lazy_modules.values() if lm._module is not None
        )
        return self.stats

    def optimize_memory(self):
        self.clear_cache(older_than_seconds=60)
        self.force_gc()
        self.logger.info(f"Memory optimized: {self._get_current_memory():.2f} MB")


resource_manager = ResourceManager()


def lazy_load(attr_name: Optional[str] = None):
    def decorator(func: Callable) -> Callable:
        module_name = func.__module__

        @wraps(func)
        def wrapper(*args, **kwargs):
            lazy_import = resource_manager.lazy_import(module_name, attr_name)
            return func(*args, **kwargs)
        return wrapper
    return decorator


def memory_optimized(func: Callable) -> Callable:
    @wraps(func)
    def wrapper(*args, **kwargs):
        resource_manager.conditional_gc()
        try:
            result = func(*args, **kwargs)
            return result
        finally:
            resource_manager.conditional_gc()
    return wrapper


def gc_after(func: Callable) -> Callable:
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        finally:
            resource_manager.force_gc()
    return wrapper


class LazyLoadMetaclass(type):
    def __new__(cls, name, bases, dct):
        new_class = super().__new__(cls, name, bases, dct)

        original_init = new_class.__init__

        @wraps(original_init)
        def __init__(self, *args, **kwargs):
            original_init(self, *args, **kwargs)
            resource_manager.cache_object(f"{name}_{id(self)}", self)

        new_class.__init__ = __init__
        return new_class


class LazyDict(Dict):
    def __init__(self, factory: Callable[[str], Any]):
        super().__init__()
        self._factory = factory
        self._loaded: set = set()
        self._lock = threading.Lock()

    def __getitem__(self, key: str) -> Any:
        if key not in self._loaded:
            with self._lock:
                if key not in self._loaded:
                    super().__setitem__(key, self._factory(key))
                    self._loaded.add(key)
        return super().__getitem__(key)

    def __contains__(self, key: object) -> bool:
        if not isinstance(key, str):
            return False
        if key not in self._loaded:
            return False
        return super().__contains__(key)


def preload_modules(module_names: list):
    for name in module_names:
        try:
            importlib.import_module(name)
            resource_manager.logger.info(f"Preloaded module: {name}")
        except ImportError as e:
            resource_manager.logger.warning(f"Failed to preload {name}: {e}")


def get_memory_usage() -> float:
    try:
        import psutil
        import os
        process = psutil.Process(os.getpid())
        return process.memory_info().rss / (1024 * 1024)
    except ImportError:
        return 0.0


def optimize_startup():
    gc.set_threshold(100, 10, 10)
    gc.disable()
    resource_manager.logger.info("Startup optimization applied: GC disabled initially")


def enable_gc_after_startup():
    gc.enable()
    resource_manager.logger.info("GC enabled after startup")

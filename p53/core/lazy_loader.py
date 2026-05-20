from PyQt6.QtCore import QObject, pyqtSignal, QMutex, QMutexLocker, QTimer
from typing import Dict, Any, Optional, Callable
from dataclasses import dataclass
from functools import wraps
import time
import gc
import sys


@dataclass
class ModuleLoadStats:
    module_name: str
    load_time: float = 0.0
    memory_usage: float = 0.0
    load_count: int = 0
    is_loaded: bool = False


class LazyModuleProxy:
    def __init__(self, loader: Callable, module_name: str):
        self._loader = loader
        self._module_name = module_name
        self._instance = None
        self._mutex = QMutex()
        
    def __getattr__(self, name: str) -> Any:
        locker = QMutexLocker(self._mutex)
        
        if self._instance is None:
            start_time = time.time()
            self._instance = self._loader()
            load_time = time.time() - start_time
            
            stats = LazyLoader.instance()._stats.get(self._module_name)
            if stats:
                stats.load_time = load_time
                stats.is_loaded = True
                
        return getattr(self._instance, name)


class LazyLoader(QObject):
    module_loaded = pyqtSignal(str, float)
    garbage_collected = pyqtSignal(int)
    optimization_applied = pyqtSignal(str)
    
    _instance: Optional['LazyLoader'] = None
    
    @classmethod
    def instance(cls) -> 'LazyLoader':
        if cls._instance is None:
            cls._instance = LazyLoader()
        return cls._instance
    
    def __init__(self):
        super().__init__()
        self._mutex = QMutex()
        self._modules: Dict[str, LazyModuleProxy] = {}
        self._loaders: Dict[str, Callable] = {}
        self._stats: Dict[str, ModuleLoadStats] = {}
        self._initialized = False
        self._gc_timer = QTimer()
        self._gc_timer.timeout.connect(self._periodic_gc)
        self._gc_timer.start(30000)
        
    def register_module(self, name: str, loader: Callable) -> bool:
        locker = QMutexLocker(self._mutex)
        
        if name in self._modules:
            return False
            
        self._loaders[name] = loader
        self._stats[name] = ModuleLoadStats(name)
        self._modules[name] = LazyModuleProxy(loader, name)
        return True
        
    def get_module(self, name: str) -> Optional[Any]:
        locker = QMutexLocker(self._mutex)
        return self._modules.get(name)
        
    def preload_modules(self, module_names: list) -> float:
        start_time = time.time()
        
        for name in module_names:
            if name in self._modules:
                _ = self._modules[name].__getattr__('__class__')
                
        total_time = time.time() - start_time
        return total_time
        
    def optimize_startup(self) -> Dict[str, Any]:
        locker = QMutexLocker(self._mutex)
        
        optimizations = []
        
        gc.collect()
        gc.freeze()
        optimizations.append("垃圾回收预热")
        
        self._initialized = True
        self.optimization_applied.emit("startup_optimized")
        
        return {
            "optimizations_applied": optimizations,
            "gc_enabled": gc.isenabled()
        }
        
    def get_load_stats(self) -> Dict[str, Any]:
        locker = QMutexLocker(self._mutex)
        
        stats = {
            "modules": {},
            "total_loaded": 0,
            "total_load_time": 0.0,
            "avg_load_time": 0.0
        }
        
        for name, stat in self._stats.items():
            stats["modules"][name] = {
                "load_time": stat.load_time,
                "is_loaded": stat.is_loaded,
                "load_count": stat.load_count
            }
            if stat.is_loaded:
                stats["total_loaded"] += 1
                stats["total_load_time"] += stat.load_time
                
        if stats["total_loaded"] > 0:
            stats["avg_load_time"] = stats["total_load_time"] / stats["total_loaded"]
            
        return stats
        
    def force_gc(self) -> int:
        collected = gc.collect()
        self.garbage_collected.emit(collected)
        return collected
        
    def _periodic_gc(self):
        collected = gc.collect()
        if collected > 0:
            self.garbage_collected.emit(collected)
            
    def clear_module_cache(self, module_name: str = None):
        locker = QMutexLocker(self._mutex)
        
        if module_name:
            if module_name in self._modules:
                self._modules[module_name]._instance = None
                if module_name in self._stats:
                    self._stats[module_name].is_loaded = False
        else:
            for proxy in self._modules.values():
                proxy._instance = None
            for stat in self._stats.values():
                stat.is_loaded = False
                
        gc.collect()


def lazy_load(module_name: str):
    def decorator(cls):
        original_init = cls.__init__
        
        @wraps(cls.__init__)
        def __init__(self, *args, **kwargs):
            loader = LazyLoader.instance()
            if not loader._initialized:
                loader.optimize_startup()
            original_init(self, *args, **kwargs)
            
        cls.__init__ = __init__
        return cls
    return decorator


class MemoryOptimizer:
    @staticmethod
    def get_memory_usage() -> float:
        try:
            import psutil
            process = psutil.Process()
            return process.memory_info().rss / 1024 / 1024
        except ImportError:
            return 0.0
            
    @staticmethod
    def optimize_pil_cache():
        try:
            from PIL import Image
            Image.MAX_IMAGE_PIXELS = 100 * 1024 * 1024
            Image.warnings.simplefilter('error', Image.DecompressionBombWarning)
            return True
        except:
            return False
            
    @staticmethod
    def clear_qt_cache():
        try:
            from PyQt6.QtCore import QCoreApplication
            QCoreApplication.processEvents()
            return True
        except:
            return False
            
    @staticmethod
    def get_object_count() -> int:
        return len(gc.get_objects())


class StartupProfiler:
    def __init__(self):
        self.start_time = time.time()
        self.checkpoints = []
        
    def checkpoint(self, name: str):
        elapsed = time.time() - self.start_time
        self.checkpoints.append((name, elapsed))
        return elapsed
        
    def get_report(self) -> str:
        lines = ["启动性能分析报告:", "=" * 40]
        for name, elapsed in self.checkpoints:
            lines.append(f"{name:<30} {elapsed:.3f}s")
        lines.append("=" * 40)
        total_time = self.checkpoints[-1][1] if self.checkpoints else 0
        lines.append(f"{'总耗时':<30} {total_time:.3f}s")
        return "\n".join(lines)

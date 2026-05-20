import os
import gc
import time
import numpy as np
from typing import Dict, List, Callable, Any
from functools import lru_cache, wraps
from concurrent.futures import ThreadPoolExecutor, as_completed
import logging

logger = logging.getLogger(__name__)

class MemoryOptimizer:
    def __init__(self, max_memory_percent: float = 70.0):
        self.max_memory_percent = max_memory_percent
        self._gc_threshold = 100
        self._gc_counter = 0

    def get_memory_usage(self) -> Dict:
        try:
            import psutil
            process = psutil.Process(os.getpid())
            memory_info = process.memory_info()
            return {
                "rss_mb": memory_info.rss / (1024 ** 2),
                "vms_mb": memory_info.vms / (1024 ** 2),
                "percent": process.memory_percent()
            }
        except:
            return {
                "rss_mb": 0,
                "vms_mb": 0,
                "percent": 0
            }

    def check_memory_safety(self) -> bool:
        usage = self.get_memory_usage()
        return usage["percent"] < self.max_memory_percent

    def force_gc(self):
        self._gc_counter += 1
        if self._gc_counter >= self._gc_threshold:
            gc.collect()
            self._gc_counter = 0
            logger.debug("执行垃圾回收")

    def clear_cuda_cache(self):
        try:
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                logger.debug("清理CUDA缓存")
        except:
            pass

class LazyLoader:
    def __init__(self):
        self._loaded_modules = {}
        self._load_times = {}

    def lazy_import(self, module_name: str, alias: str = None):
        if alias is None:
            alias = module_name
        
        if alias not in self._loaded_modules:
            start_time = time.time()
            module = __import__(module_name)
            self._loaded_modules[alias] = module
            self._load_times[alias] = time.time() - start_time
            logger.debug(f"懒加载模块: {module_name} -> {alias} (耗时: {self._load_times[alias]:.3f}s)")
        
        return self._loaded_modules[alias]

    def get_load_stats(self) -> Dict:
        return {
            "loaded_count": len(self._loaded_modules),
            "load_times": self._load_times,
            "total_time": sum(self._load_times.values())
        }

class BatchInferenceOptimizer:
    def __init__(self, max_batch_size: int = 32, max_workers: int = 4):
        self.max_batch_size = max_batch_size
        self.max_workers = max_workers
        self.memory_optimizer = MemoryOptimizer()

    def optimize_batch(self, items: List, dynamic: bool = True) -> List[List]:
        if not items:
            return []

        if dynamic:
            usage = self.memory_optimizer.get_memory_usage()
            if usage["percent"] > 60:
                batch_size = max(1, self.max_batch_size // 4)
            elif usage["percent"] > 40:
                batch_size = max(1, self.max_batch_size // 2)
            else:
                batch_size = self.max_batch_size
        else:
            batch_size = self.max_batch_size

        batches = []
        for i in range(0, len(items), batch_size):
            batches.append(items[i:i + batch_size])
        
        logger.debug(f"拆分 {len(items)} 个项目为 {len(batches)} 个批次 (批大小: {batch_size})")
        return batches

    def parallel_process(
        self,
        items: List,
        process_func: Callable,
        use_threads: bool = True
    ) -> List:
        if not items:
            return []

        batches = self.optimize_batch(items)
        results = []

        if use_threads:
            with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                future_to_batch = {executor.submit(process_func, batch): batch for batch in batches}
                for future in as_completed(future_to_batch):
                    try:
                        batch_result = future.result()
                        results.extend(batch_result)
                        self.memory_optimizer.force_gc()
                    except Exception as e:
                        logger.error(f"批处理执行失败: {e}")
        else:
            for batch in batches:
                try:
                    batch_result = process_func(batch)
                    results.extend(batch_result)
                    self.memory_optimizer.force_gc()
                except Exception as e:
                    logger.error(f"批处理执行失败: {e}")

        return results

class ResultCache:
    def __init__(self, max_size: int = 1000, ttl_seconds: int = 3600):
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self._cache = {}
        self._access_times = {}
        self._hit_count = 0
        self._miss_count = 0

    def _generate_key(self, *args, **kwargs) -> str:
        key_parts = [str(arg) for arg in args]
        key_parts.extend([f"{k}:{v}" for k, v in sorted(kwargs.items())])
        return "|".join(key_parts)

    def get(self, *args, **kwargs) -> Any:
        key = self._generate_key(*args, **kwargs)
        
        if key in self._cache:
            cache_time, value = self._cache[key]
            if time.time() - cache_time <= self.ttl_seconds:
                self._hit_count += 1
                self._access_times[key] = time.time()
                return value
            else:
                del self._cache[key]
                del self._access_times[key]
        
        self._miss_count += 1
        return None

    def set(self, value: Any, *args, **kwargs):
        if len(self._cache) >= self.max_size:
            oldest_key = min(self._access_times.keys(), key=lambda k: self._access_times[k])
            del self._cache[oldest_key]
            del self._access_times[oldest_key]
        
        key = self._generate_key(*args, **kwargs)
        self._cache[key] = (time.time(), value)
        self._access_times[key] = time.time()

    def stats(self) -> Dict:
        total = self._hit_count + self._miss_count
        hit_rate = self._hit_count / total if total > 0 else 0
        return {
            "size": len(self._cache),
            "max_size": self.max_size,
            "hits": self._hit_count,
            "misses": self._miss_count,
            "hit_rate": hit_rate,
            "ttl_seconds": self.ttl_seconds
        }

    def clear(self):
        self._cache.clear()
        self._access_times.clear()
        self._hit_count = 0
        self._miss_count = 0
        logger.info("缓存已清空")

def optimize_inference(func: Callable = None, *, cache_size: int = 100):
    def decorator(f):
        cache = ResultCache(max_size=cache_size)
        memory_optimizer = MemoryOptimizer()

        @wraps(f)
        def wrapper(*args, **kwargs):
            cached_result = cache.get(*args, **kwargs)
            if cached_result is not None:
                logger.debug(f"缓存命中: {f.__name__}")
                return cached_result

            if not memory_optimizer.check_memory_safety():
                logger.warning("内存使用率过高，执行GC清理")
                memory_optimizer.force_gc()
                memory_optimizer.clear_cuda_cache()

            result = f(*args, **kwargs)
            
            cache.set(result, *args, **kwargs)
            
            return result
        
        wrapper.get_cache_stats = cache.stats
        wrapper.clear_cache = cache.clear
        return wrapper

    if func is not None:
        return decorator(func)
    return decorator

class QuantizationOptimizer:
    def __init__(self):
        self.quantization_levels = {
            "float32": 4,
            "float16": 2,
            "int8": 1,
            "int4": 0.5
        }

    def quantize_array(self, arr: np.ndarray, target_precision: str = "float16") -> np.ndarray:
        if target_precision == "float16" and arr.dtype == np.float32:
            return arr.astype(np.float16)
        elif target_precision == "int8":
            scale = np.max(np.abs(arr))
            if scale > 0:
                return (arr / scale * 127).astype(np.int8)
            return arr.astype(np.int8)
        return arr

    def estimate_memory_savings(self, original_size_mb: float, target_precision: str) -> float:
        level = self.quantization_levels.get(target_precision, 4)
        return original_size_mb * (1 - level / 4)

class PerformanceMonitor:
    def __init__(self):
        self._start_times = {}
        self._durations = {}
        self._call_counts = {}

    def start(self, operation_name: str):
        self._start_times[operation_name] = time.time()
        if operation_name not in self._call_counts:
            self._call_counts[operation_name] = 0

    def end(self, operation_name: str) -> float:
        if operation_name in self._start_times:
            duration = time.time() - self._start_times[operation_name]
            if operation_name not in self._durations:
                self._durations[operation_name] = []
            self._durations[operation_name].append(duration)
            self._call_counts[operation_name] += 1
            return duration
        return 0

    def get_stats(self, operation_name: str = None) -> Dict:
        if operation_name:
            durations = self._durations.get(operation_name, [])
            if not durations:
                return {}
            return {
                "count": self._call_counts.get(operation_name, 0),
                "avg_ms": np.mean(durations) * 1000,
                "min_ms": np.min(durations) * 1000,
                "max_ms": np.max(durations) * 1000,
                "total_ms": np.sum(durations) * 1000
            }
        
        all_stats = {}
        for op in self._durations:
            all_stats[op] = self.get_stats(op)
        return all_stats

def monitor_performance(func: Callable = None):
    def decorator(f):
        monitor = PerformanceMonitor()

        @wraps(f)
        def wrapper(*args, **kwargs):
            monitor.start(f.__name__)
            result = f(*args, **kwargs)
            duration = monitor.end(f.__name__)
            logger.debug(f"{f.__name__} 执行耗时: {duration*1000:.2f}ms")
            return result
        
        wrapper.get_performance_stats = monitor.get_stats
        return wrapper

    if func is not None:
        return decorator(func)
    return decorator

class ResourceManager:
    def __init__(self):
        self.memory_optimizer = MemoryOptimizer()
        self.lazy_loader = LazyLoader()
        self.performance_monitor = PerformanceMonitor()
        self.result_cache = ResultCache()

    def get_system_status(self) -> Dict:
        return {
            "memory": self.memory_optimizer.get_memory_usage(),
            "load_stats": self.lazy_loader.get_load_stats(),
            "cache_stats": self.result_cache.stats(),
            "performance_stats": self.performance_monitor.get_stats()
        }

    def cleanup(self):
        self.memory_optimizer.force_gc()
        self.memory_optimizer.clear_cuda_cache()
        self.result_cache.clear()
        logger.info("资源清理完成")

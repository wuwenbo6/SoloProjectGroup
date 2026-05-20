import pandas as pd
import numpy as np
import time
import hashlib
import pickle
import os
import logging
from functools import wraps, lru_cache
from datetime import datetime, timedelta
from collections import OrderedDict
from typing import Any, Callable, Dict, List, Optional, Tuple, Union
import threading
import json
import gc

try:
    import dask.dataframe as dd
    from dask.distributed import Client, LocalCluster
    DASK_AVAILABLE = True
except ImportError:
    DASK_AVAILABLE = False

logger = logging.getLogger(__name__)


class LRUCache:
    def __init__(self, max_size: int = 128, ttl_seconds: int = 3600):
        self.cache = OrderedDict()
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self.lock = threading.RLock()
        self.hits = 0
        self.misses = 0

    def get(self, key: str) -> Optional[Any]:
        with self.lock:
            if key not in self.cache:
                self.misses += 1
                return None
            
            item = self.cache[key]
            if datetime.now() > item['expire_time']:
                del self.cache[key]
                self.misses += 1
                return None
            
            self.cache.move_to_end(key)
            self.hits += 1
            return item['value']

    def put(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
        with self.lock:
            if len(self.cache) >= self.max_size:
                self.cache.popitem(last=False)
            
            expire_time = datetime.now() + timedelta(seconds=ttl_seconds or self.ttl_seconds)
            self.cache[key] = {
                'value': value,
                'expire_time': expire_time,
                'created_at': datetime.now()
            }

    def delete(self, key: str) -> bool:
        with self.lock:
            if key in self.cache:
                del self.cache[key]
                return True
            return False

    def clear(self) -> None:
        with self.lock:
            self.cache.clear()
            self.hits = 0
            self.misses = 0

    def get_stats(self) -> Dict[str, Any]:
        with self.lock:
            total = self.hits + self.misses
            hit_rate = self.hits / total if total > 0 else 0
            return {
                'size': len(self.cache),
                'max_size': self.max_size,
                'hits': self.hits,
                'misses': self.misses,
                'hit_rate': hit_rate,
                'ttl_seconds': self.ttl_seconds
            }


class MultiLevelCache:
    def __init__(self, cache_dir: str = '.cache', memory_cache_size: int = 256):
        self.memory_cache = LRUCache(max_size=memory_cache_size, ttl_seconds=1800)
        self.disk_cache_dir = cache_dir
        os.makedirs(cache_dir, exist_ok=True)
        self.disk_cache_enabled = True
        self._init_disk_cache_index()

    def _init_disk_cache_index(self):
        self.disk_index_path = os.path.join(self.disk_cache_dir, 'index.json')
        if os.path.exists(self.disk_index_path):
            with open(self.disk_index_path, 'r') as f:
                self.disk_index = json.load(f)
        else:
            self.disk_index = {}

    def _save_disk_index(self):
        with open(self.disk_index_path, 'w') as f:
            json.dump(self.disk_index, f, indent=2)

    def _get_disk_path(self, key: str) -> str:
        hashed = hashlib.md5(key.encode()).hexdigest()
        return os.path.join(self.disk_cache_dir, f'{hashed}.pkl')

    def get(self, key: str, level: str = 'all') -> Optional[Any]:
        if level in ['all', 'memory']:
            value = self.memory_cache.get(key)
            if value is not None:
                logger.debug(f'内存缓存命中: {key}')
                return value

        if level in ['all', 'disk'] and self.disk_cache_enabled:
            if key in self.disk_index:
                cache_info = self.disk_index[key]
                if datetime.fromisoformat(cache_info['expire_time']) > datetime.now():
                    try:
                        with open(self._get_disk_path(key), 'rb') as f:
                            value = pickle.load(f)
                        self.memory_cache.put(key, value)
                        logger.debug(f'磁盘缓存命中: {key}')
                        return value
                    except Exception as e:
                        logger.warning(f'读取磁盘缓存失败 {key}: {e}')
                        del self.disk_index[key]
                        self._save_disk_index()

        return None

    def put(self, key: str, value: Any, ttl_seconds: int = 3600, level: str = 'all') -> None:
        if level in ['all', 'memory']:
            self.memory_cache.put(key, value, ttl_seconds)

        if level in ['all', 'disk'] and self.disk_cache_enabled:
            try:
                disk_path = self._get_disk_path(key)
                with open(disk_path, 'wb') as f:
                    pickle.dump(value, f, protocol=pickle.HIGHEST_PROTOCOL)
                
                self.disk_index[key] = {
                    'path': disk_path,
                    'size_bytes': os.path.getsize(disk_path),
                    'created_at': datetime.now().isoformat(),
                    'expire_time': (datetime.now() + timedelta(seconds=ttl_seconds)).isoformat()
                }
                self._save_disk_index()
                logger.debug(f'写入磁盘缓存: {key}')
            except Exception as e:
                logger.warning(f'写入磁盘缓存失败 {key}: {e}')

    def clear_expired(self) -> int:
        cleared_count = 0
        current_time = datetime.now()
        
        keys_to_delete = []
        for key, info in self.disk_index.items():
            if datetime.fromisoformat(info['expire_time']) < current_time:
                keys_to_delete.append(key)
        
        for key in keys_to_delete:
            try:
                os.remove(self.disk_index[key]['path'])
            except:
                pass
            del self.disk_index[key]
            cleared_count += 1
        
        if cleared_count > 0:
            self._save_disk_index()
        
        logger.info(f'清理了 {cleared_count} 个过期磁盘缓存')
        return cleared_count

    def get_stats(self) -> Dict[str, Any]:
        memory_stats = self.memory_cache.get_stats()
        total_disk_size = sum(info['size_bytes'] for info in self.disk_index.values())
        
        return {
            'memory_cache': memory_stats,
            'disk_cache': {
                'size': len(self.disk_index),
                'total_size_bytes': total_disk_size,
                'total_size_mb': total_disk_size / (1024 * 1024)
            }
        }

    def clear_all(self) -> None:
        self.memory_cache.clear()
        for key in list(self.disk_index.keys()):
            try:
                os.remove(self.disk_index[key]['path'])
            except:
                pass
        self.disk_index.clear()
        self._save_disk_index()
        logger.info('所有缓存已清理')


class DaskParallelProcessor:
    def __init__(self, n_workers: int = None, memory_limit: str = '4GB'):
        self.n_workers = n_workers or max(1, os.cpu_count() - 1)
        self.memory_limit = memory_limit
        self.client = None
        self.cluster = None
    
    def __enter__(self):
        self.start()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.stop()
    
    def start(self) -> None:
        if not DASK_AVAILABLE:
            logger.warning("Dask不可用，将回退到单线程处理")
            return
        
        try:
            import dask.dataframe as dd_local
            from dask.distributed import Client, LocalCluster
            self.cluster = LocalCluster(
                n_workers=self.n_workers,
                threads_per_worker=2,
                memory_limit=self.memory_limit,
                silence_logs=logging.WARNING
            )
            self.client = Client(self.cluster)
            logger.info(f"Dask集群启动成功: {self.n_workers} 个工作进程, {self.client.dashboard_link}")
        except Exception as e:
            logger.warning(f"Dask集群启动失败，将回退到单线程处理: {e}")
    
    def stop(self) -> None:
        if self.client:
            self.client.close()
            self.client = None
        if self.cluster:
            self.cluster.close()
            self.cluster = None
            logger.info("Dask集群已关闭")
    
    def load_csv_parallel(self, file_path: str, chunk_size: str = '100MB', **kwargs):
        if not DASK_AVAILABLE:
            logger.warning("Dask不可用，回退到Pandas加载")
            return pd.read_csv(file_path, **kwargs)
        
        import dask.dataframe as dd_local
        logger.info(f"使用Dask并行加载CSV: {file_path}, 分块大小: {chunk_size}")
        return dd_local.read_csv(file_path, blocksize=chunk_size, **kwargs)
    
    def apply_parallel(self, df, func: Callable, meta: Any = None):
        if not DASK_AVAILABLE:
            if isinstance(df, pd.DataFrame):
                return func(df)
            return df
        
        return df.map_partitions(func, meta=meta)
    
    def compute(self, df, **kwargs) -> pd.DataFrame:
        if not DASK_AVAILABLE or isinstance(df, pd.DataFrame):
            return df
        
        logger.info(f"开始并行计算，分区数: {df.npartitions}")
        return df.compute(**kwargs)
    
    def parallel_feature_extraction(self, df, extractors: List[Callable]):
        if not DASK_AVAILABLE:
            result = df.copy()
            for extractor in extractors:
                result = extractor(result)
            return result
        
        def process_partition(partition):
            for extractor in extractors:
                partition = extractor(partition)
            return partition
        
        meta = process_partition(df.head(1))
        return df.map_partitions(process_partition, meta=meta)


class PerformanceMonitor:
    def __init__(self):
        self.metrics = {}
        self.start_times = {}

    def start_timer(self, name: str) -> None:
        self.start_times[name] = time.perf_counter()
        logger.debug(f'开始计时: {name}')

    def end_timer(self, name: str) -> float:
        if name not in self.start_times:
            logger.warning(f'计时器 {name} 未启动')
            return 0
        
        elapsed = time.perf_counter() - self.start_times[name]
        del self.start_times[name]
        
        if name not in self.metrics:
            self.metrics[name] = {
                'count': 0,
                'total_time': 0,
                'min_time': float('inf'),
                'max_time': 0,
                'times': []
            }
        
        self.metrics[name]['count'] += 1
        self.metrics[name]['total_time'] += elapsed
        self.metrics[name]['min_time'] = min(self.metrics[name]['min_time'], elapsed)
        self.metrics[name]['max_time'] = max(self.metrics[name]['max_time'], elapsed)
        self.metrics[name]['times'].append(elapsed)
        
        logger.debug(f'完成 {name}: {elapsed:.4f} 秒')
        return elapsed

    def get_metric(self, name: str) -> Dict[str, Any]:
        if name not in self.metrics:
            return {}
        
        metric = self.metrics[name]
        return {
            'count': metric['count'],
            'total_time': metric['total_time'],
            'avg_time': metric['total_time'] / metric['count'],
            'min_time': metric['min_time'],
            'max_time': metric['max_time'],
            'p50_time': np.percentile(metric['times'], 50) if metric['times'] else 0,
            'p95_time': np.percentile(metric['times'], 95) if metric['times'] else 0,
            'p99_time': np.percentile(metric['times'], 99) if metric['times'] else 0
        }

    def get_all_metrics(self) -> Dict[str, Dict[str, Any]]:
        return {name: self.get_metric(name) for name in self.metrics}

    def print_summary(self) -> None:
        print('\n' + '=' * 70)
        print('📊 性能监控汇总')
        print('=' * 70)
        
        for name, metric in self.get_all_metrics().items():
            print(f"\n  {name}:")
            print(f"    调用次数: {metric['count']}")
            print(f"    总耗时: {metric['total_time']:.4f} 秒")
            print(f"    平均耗时: {metric['avg_time']:.4f} 秒")
            print(f"    最小耗时: {metric['min_time']:.4f} 秒")
            print(f"    最大耗时: {metric['max_time']:.4f} 秒")
            print(f"    P50 耗时: {metric['p50_time']:.4f} 秒")
            print(f"    P95 耗时: {metric['p95_time']:.4f} 秒")
            print(f"    P99 耗时: {metric['p99_time']:.4f} 秒")
        
        print('\n' + '=' * 70)


def profile_memory(func: Callable) -> Callable:
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            import psutil
            process = psutil.Process()
            mem_before = process.memory_info().rss / 1024 / 1024
            
            result = func(*args, **kwargs)
            
            mem_after = process.memory_info().rss / 1024 / 1024
            mem_diff = mem_after - mem_before
            
            logger.info(f"{func.__name__} 内存变化: {mem_before:.2f} MB -> {mem_after:.2f} MB (Δ {mem_diff:+.2f} MB)")
            return result
        except ImportError:
            return func(*args, **kwargs)
    return wrapper


def profile_time(func: Callable) -> Callable:
    @wraps(func)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        elapsed = time.perf_counter() - start
        logger.info(f"{func.__name__} 执行耗时: {elapsed:.4f} 秒")
        return result
    return wrapper


class MemoryOptimizer:
    @staticmethod
    def optimize_dataframe(df: pd.DataFrame, inplace: bool = False, verbose: bool = False) -> pd.DataFrame:
        if not inplace:
            df = df.copy()
        
        original_memory = df.memory_usage(deep=True).sum() / 1024 / 1024
        
        for col in df.columns:
            col_type = df[col].dtype
            
            if col_type == 'object':
                num_unique = df[col].nunique()
                if num_unique / len(df) < 0.5:
                    df[col] = df[col].astype('category')
            
            elif np.issubdtype(col_type, np.integer):
                c_min, c_max = df[col].min(), df[col].max()
                if c_min > np.iinfo(np.int8).min and c_max < np.iinfo(np.int8).max:
                    df[col] = df[col].astype(np.int8)
                elif c_min > np.iinfo(np.int16).min and c_max < np.iinfo(np.int16).max:
                    df[col] = df[col].astype(np.int16)
                elif c_min > np.iinfo(np.int32).min and c_max < np.iinfo(np.int32).max:
                    df[col] = df[col].astype(np.int32)
            
            elif np.issubdtype(col_type, np.floating):
                c_min, c_max = df[col].min(), df[col].max()
                if c_min > np.finfo(np.float32).min and c_max < np.finfo(np.float32).max:
                    df[col] = df[col].astype(np.float32)
        
        optimized_memory = df.memory_usage(deep=True).sum() / 1024 / 1024
        savings = (1 - optimized_memory / original_memory) * 100
        
        if verbose:
            logger.info(f'DataFrame 内存优化: {original_memory:.2f} MB -> {optimized_memory:.2f} MB (节省 {savings:.1f}%)')
        
        return df

    @staticmethod
    def optimize_numeric_columns(df: pd.DataFrame) -> pd.DataFrame:
        for col in df.select_dtypes(include=[np.number]).columns:
            col_min = df[col].min()
            col_max = df[col].max()
            
            if np.issubdtype(df[col].dtype, np.integer):
                if col_min >= 0:
                    if col_max <= 255:
                        df[col] = df[col].astype(np.uint8)
                    elif col_max <= 65535:
                        df[col] = df[col].astype(np.uint16)
                    elif col_max <= 4294967295:
                        df[col] = df[col].astype(np.uint32)
            elif np.issubdtype(df[col].dtype, np.floating):
                df[col] = df[col].astype(np.float32)
        
        return df

    @staticmethod
    def force_gc() -> None:
        collected = gc.collect()
        logger.debug(f'垃圾回收完成，释放了 {collected} 个对象')


class BenchmarkSuite:
    def __init__(self):
        self.results = {}
        self.monitor = PerformanceMonitor()

    def benchmark_data_loading(self, file_path: str, sizes: List[str] = ['10MB', '100MB', '1GB']) -> Dict:
        print('\n' + '=' * 70)
        print('📦 数据加载性能基准测试')
        print('=' * 70)
        
        results = {}
        
        for size in sizes:
            print(f'\n测试 {size} 分块加载...')
            
            self.monitor.start_timer(f'load_dask_{size}')
            with DaskParallelProcessor() as processor:
                df_dask = processor.load_csv_parallel(file_path, chunk_size=size)
                result_dask = processor.compute(df_dask)
            results[f'dask_{size}'] = self.monitor.end_timer(f'load_dask_{size}')
            print(f'  Dask {size}: {results[f"dask_{size}"]:.4f} 秒')
            
            self.monitor.start_timer('load_pandas')
            df_pandas = pd.read_csv(file_path)
            results['pandas'] = self.monitor.end_timer('load_pandas')
            print(f'  Pandas: {results["pandas"]:.4f} 秒')
            
            speedup = results['pandas'] / results[f'dask_{size}']
            print(f'  加速比: {speedup:.2f}x')
        
        self.results['data_loading'] = results
        return results

    def benchmark_feature_extraction(self, df: pd.DataFrame, feature_count: int = 10) -> Dict:
        print('\n' + '=' * 70)
        print('🔬 特征提取性能基准测试')
        print('=' * 70)
        
        results = {}
        
        if DASK_AVAILABLE:
            print('\n测试 Dask 并行特征提取...')
            self.monitor.start_timer('feature_dask')
            
            with DaskParallelProcessor() as processor:
                ddf = dd.from_pandas(df, npartitions=processor.n_workers)
                
                def extract_features(partition):
                    for i in range(feature_count):
                        partition[f'feature_{i}'] = np.random.rand(len(partition))
                    return partition
                
                result = processor.apply_parallel(ddf, extract_features)
                final_df = processor.compute(result)
            
            results['dask'] = self.monitor.end_timer('feature_dask')
            print(f'  Dask: {results["dask"]:.4f} 秒')
        
        print('\n测试 Pandas 单线程特征提取...')
        self.monitor.start_timer('feature_pandas')
        for i in range(feature_count):
            df[f'feature_{i}'] = np.random.rand(len(df))
        results['pandas'] = self.monitor.end_timer('feature_pandas')
        print(f'  Pandas: {results["pandas"]:.4f} 秒')
        
        if 'dask' in results:
            speedup = results['pandas'] / results['dask']
            print(f'  加速比: {speedup:.2f}x')
        
        self.results['feature_extraction'] = results
        return results

    def benchmark_memory_optimization(self, df: pd.DataFrame) -> Dict:
        print('\n' + '=' * 70)
        print('💾 内存优化性能基准测试')
        print('=' * 70)
        
        original_memory = df.memory_usage(deep=True).sum() / 1024 / 1024
        print(f'\n原始内存占用: {original_memory:.2f} MB')
        
        self.monitor.start_timer('mem_optimize')
        optimized_df = MemoryOptimizer.optimize_dataframe(df, verbose=True)
        optimization_time = self.monitor.end_timer('mem_optimize')
        
        optimized_memory = optimized_df.memory_usage(deep=True).sum() / 1024 / 1024
        savings = (1 - optimized_memory / original_memory) * 100
        
        results = {
            'original_memory_mb': original_memory,
            'optimized_memory_mb': optimized_memory,
            'savings_percent': savings,
            'optimization_time_sec': optimization_time
        }
        
        print(f'优化后内存占用: {optimized_memory:.2f} MB')
        print(f'节省: {savings:.1f}%')
        print(f'优化耗时: {optimization_time:.4f} 秒')
        
        self.results['memory_optimization'] = results
        return results

    def print_summary(self) -> None:
        print('\n' + '=' * 70)
        print('🏆 基准测试结果汇总')
        print('=' * 70)
        
        for test_name, results in self.results.items():
            print(f'\n{test_name}:')
            for key, value in results.items():
                if isinstance(value, float):
                    if 'time' in key or 'sec' in key or key.endswith('_pandas') or key.endswith('_dask'):
                        print(f'  {key}: {value:.4f} 秒')
                    elif 'memory' in key or 'mb' in key.lower():
                        print(f'  {key}: {value:.2f} MB')
                    elif 'percent' in key or 'savings' in key.lower():
                        print(f'  {key}: {value:.1f}%')
                    else:
                        print(f'  {key}: {value:.4f}')
                else:
                    print(f'  {key}: {value}')
        
        print('\n' + '=' * 70)


_global_cache = MultiLevelCache()
_global_monitor = PerformanceMonitor()


def get_cache() -> MultiLevelCache:
    return _global_cache


def get_monitor() -> PerformanceMonitor:
    return _global_monitor

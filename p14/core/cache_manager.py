import hashlib
import json
import pickle
from datetime import datetime, timedelta
from typing import Any, Optional, Dict, Callable
from functools import wraps
import time

try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False


class CacheManager:
    """智能缓存管理器 - 支持Redis和内存缓存"""

    def __init__(self, redis_url: str = "redis://localhost:6379/0",
                 default_ttl: int = 3600,
                 use_memory_fallback: bool = True):
        self.default_ttl = default_ttl
        self.use_memory_fallback = use_memory_fallback
        self.memory_cache: Dict[str, tuple] = {}  # key: (value, expire_time)
        self.redis_client: Optional[redis.Redis] = None
        self.stats = {'hits': 0, 'misses': 0, 'sets': 0, 'memory_fallback': 0}

        if REDIS_AVAILABLE:
            try:
                self.redis_client = redis.from_url(redis_url)
                self.redis_client.ping()
                print("✓ Redis缓存连接成功")
            except Exception as e:
                print(f"⚠ Redis连接失败: {e}")
                if use_memory_fallback:
                    print("→ 启用内存缓存作为后备")

    def _generate_key(self, prefix: str, *args, **kwargs) -> str:
        """生成缓存键"""
        key_parts = [prefix] + list(map(str, args)) + sorted(kwargs.items())
        key_str = json.dumps(key_parts, sort_keys=True)
        return f"dash:{prefix}:{hashlib.md5(key_str.encode()).hexdigest()[:12]}"

    def get(self, key: str) -> Optional[Any]:
        """获取缓存"""
        # 先查内存缓存
        if key in self.memory_cache:
            value, expire_time = self.memory_cache[key]
            if datetime.now() < expire_time:
                self.stats['hits'] += 1
                return value
            else:
                del self.memory_cache[key]

        # 查Redis
        if self.redis_client:
            try:
                data = self.redis_client.get(key)
                if data:
                    self.stats['hits'] += 1
                    return pickle.loads(data)
            except Exception as e:
                print(f"缓存读取失败: {e}")

        self.stats['misses'] += 1
        return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """设置缓存"""
        ttl = ttl or self.default_ttl
        expire_time = datetime.now() + timedelta(seconds=ttl)

        # 内存缓存
        self.memory_cache[key] = (value, expire_time)
        self.stats['sets'] += 1

        # Redis缓存
        if self.redis_client:
            try:
                serialized = pickle.dumps(value)
                if len(serialized) > 50 * 1024 * 1024:  # 50MB限制
                    print(f"⚠ 对象过大，跳过Redis缓存: {len(serialized):,} bytes")
                    return True
                self.redis_client.setex(key, ttl, serialized)
                return True
            except Exception as e:
                print(f"缓存写入失败: {e}")
                self.stats['memory_fallback'] += 1
        return True

    def delete(self, key: str):
        """删除缓存"""
        self.memory_cache.pop(key, None)
        if self.redis_client:
            try:
                self.redis_client.delete(key)
            except Exception as e:
                print(f"缓存删除失败: {e}")

    def invalidate_pattern(self, pattern: str):
        """按模式批量失效缓存"""
        self.memory_cache = {k: v for k, v in self.memory_cache.items() if pattern not in k}
        if self.redis_client:
            try:
                keys = self.redis_client.keys(f"*{pattern}*")
                if keys:
                    self.redis_client.delete(*keys)
                    print(f"✓ 已清除 {len(keys)} 个缓存键")
            except Exception as e:
                print(f"批量清除缓存失败: {e}")

    def clear_all(self):
        """清空所有缓存"""
        self.memory_cache.clear()
        if self.redis_client:
            try:
                self.redis_client.flushdb()
                print("✓ Redis缓存已清空")
            except Exception as e:
                print(f"清空缓存失败: {e}")

    def get_stats(self) -> Dict[str, Any]:
        """获取缓存统计"""
        total = self.stats['hits'] + self.stats['misses']
        hit_rate = (self.stats['hits'] / total * 100) if total > 0 else 0

        return {
            **self.stats,
            'hit_rate_pct': round(hit_rate, 2),
            'memory_cache_size': len(self.memory_cache),
            'redis_connected': self.redis_client is not None
        }

    def memoize(self, prefix: str, ttl: Optional[int] = None):
        """装饰器：缓存函数结果"""
        def decorator(func: Callable) -> Callable:
            @wraps(func)
            def wrapper(*args, **kwargs):
                # 跳过不可序列化的参数
                cache_kwargs = {k: v for k, v in kwargs.items()
                               if isinstance(v, (str, int, float, bool, tuple, list, type(None)))}
                key = self._generate_key(prefix, func.__name__, *args, **cache_kwargs)

                cached = self.get(key)
                if cached is not None:
                    return cached

                result = func(*args, **kwargs)
                self.set(key, result, ttl)
                return result
            return wrapper
        return decorator

    def cache_dataframe(self, name: str, df: Any, ttl: Optional[int] = None,
                        sample_size: Optional[int] = None) -> str:
        """缓存DataFrame，大对象自动采样"""
        import pandas as pd

        if isinstance(df, pd.DataFrame) and sample_size and len(df) > sample_size:
            df = df.sample(n=sample_size, random_state=42)
            key = self._generate_key(f"df:{name}", "sampled", len(df))
        else:
            key = self._generate_key(f"df:{name}", str(hash(pd.util.hash_pandas_object(df).sum())))

        self.set(key, df, ttl)
        return key

    def cache_figure(self, figure_id: str, figure: Any, ttl: Optional[int] = None) -> str:
        """缓存Plotly图表"""
        key = self._generate_key(f"fig:{figure_id}")
        self.set(key, figure, ttl)
        return key

    def get_or_compute(self, key: str, compute_func: Callable,
                       ttl: Optional[int] = None, force: bool = False) -> Any:
        """获取缓存或计算后缓存"""
        if not force:
            cached = self.get(key)
            if cached is not None:
                return cached

        result = compute_func()
        self.set(key, result, ttl)
        return result

    def cleanup_expired(self):
        """清理过期的内存缓存"""
        now = datetime.now()
        expired = [k for k, (_, expire_time) in self.memory_cache.items() if expire_time <= now]
        for key in expired:
            del self.memory_cache[key]
        if expired:
            print(f"✓ 清理了 {len(expired)} 个过期内存缓存")


class DashboardCache:
    """仪表板专用缓存管理器"""

    def __init__(self, cache_manager: CacheManager):
        self.cache = cache_manager

    def get_dataset_summary(self, dataset_id: str) -> Optional[Dict]:
        """获取数据集摘要缓存"""
        return self.cache.get(self.cache._generate_key("summary", dataset_id))

    def set_dataset_summary(self, dataset_id: str, summary: Dict, ttl: int = 86400) -> str:
        """缓存数据集摘要"""
        key = self.cache._generate_key("summary", dataset_id)
        self.cache.set(key, summary, ttl)
        return key

    def get_correlation_matrix(self, dataset_id: str, method: str = "pearson") -> Optional[Any]:
        """获取相关性矩阵缓存"""
        return self.cache.get(self.cache._generate_key("corr", dataset_id, method))

    def set_correlation_matrix(self, dataset_id: str, method: str, matrix: Any,
                               ttl: int = 3600) -> str:
        """缓存相关性矩阵"""
        key = self.cache._generate_key("corr", dataset_id, method)
        self.cache.set(key, matrix, ttl)
        return key

    def get_clustering_result(self, dataset_id: str, algorithm: str, params: Dict) -> Optional[Dict]:
        """获取聚类结果缓存"""
        return self.cache.get(self.cache._generate_key("cluster", dataset_id, algorithm, params))

    def set_clustering_result(self, dataset_id: str, algorithm: str, params: Dict,
                              result: Dict, ttl: int = 1800) -> str:
        """缓存聚类结果"""
        key = self.cache._generate_key("cluster", dataset_id, algorithm, params)
        self.cache.set(key, result, ttl)
        return key

    def get_figure(self, figure_id: str) -> Optional[Any]:
        """获取图表缓存"""
        return self.cache.get(self.cache._generate_key("figure", figure_id))

    def set_figure(self, figure_id: str, figure: Any, ttl: int = 600) -> str:
        """缓存图表（图表缓存时间较短，因为交互频繁）"""
        key = self.cache._generate_key("figure", figure_id)
        self.cache.set(key, figure, ttl)
        return key

    def invalidate_dataset(self, dataset_id: str):
        """失效某个数据集相关的所有缓存"""
        self.cache.invalidate_pattern(dataset_id)
        print(f"✓ 已失效数据集 {dataset_id} 的所有缓存")

    def get_load_time_stats(self) -> Dict:
        """获取加载性能统计"""
        stats = self.cache.get_stats()
        return {
            'hit_rate': stats['hit_rate_pct'],
            'estimated_saved_seconds': stats['hits'] * 0.5,  # 假设每次计算节省0.5秒
            'total_requests': stats['hits'] + stats['misses']
        }


# 全局缓存实例
_global_cache: Optional[CacheManager] = None


def get_global_cache(redis_url: str = "redis://localhost:6379/0", **kwargs) -> CacheManager:
    """获取全局缓存实例"""
    global _global_cache
    if _global_cache is None:
        _global_cache = CacheManager(redis_url=redis_url, **kwargs)
    return _global_cache

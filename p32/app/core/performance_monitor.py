import time
import asyncio
import functools
import threading
from typing import Dict, List, Callable, Any
from collections import defaultdict, deque
from datetime import datetime, timedelta
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy.orm import Session
import logging

logger = logging.getLogger(__name__)


class PerformanceMetrics:
    def __init__(self, max_samples: int = 1000):
        self.max_samples = max_samples
        self.response_times: Dict[str, deque] = defaultdict(lambda: deque(maxlen=max_samples))
        self.request_counts: Dict[str, int] = defaultdict(int)
        self.error_counts: Dict[str, int] = defaultdict(int)
        self._lock = threading.Lock()

    def record_request(self, endpoint: str, response_time: float, is_error: bool = False):
        with self._lock:
            self.response_times[endpoint].append(response_time)
            self.request_counts[endpoint] += 1
            if is_error:
                self.error_counts[endpoint] += 1

    def get_endpoint_stats(self, endpoint: str) -> Dict:
        with self._lock:
            times = self.response_times[endpoint]
            if not times:
                return {
                    "endpoint": endpoint,
                    "total_requests": 0,
                    "error_count": 0,
                    "error_rate": 0.0,
                    "avg_response_time": 0.0,
                    "p50_response_time": 0.0,
                    "p95_response_time": 0.0,
                    "p99_response_time": 0.0
                }

            sorted_times = sorted(times)
            n = len(sorted_times)
            total = self.request_counts[endpoint]
            errors = self.error_counts[endpoint]

            return {
                "endpoint": endpoint,
                "total_requests": total,
                "error_count": errors,
                "error_rate": errors / total if total > 0 else 0.0,
                "avg_response_time": sum(times) / n,
                "p50_response_time": sorted_times[int(n * 0.5)],
                "p95_response_time": sorted_times[int(n * 0.95)],
                "p99_response_time": sorted_times[int(n * 0.99)]
            }

    def get_all_stats(self) -> List[Dict]:
        with self._lock:
            endpoints = list(self.response_times.keys())
        return [self.get_endpoint_stats(ep) for ep in endpoints]


class AutoRecoveryMechanism:
    def __init__(self):
        self.recovery_actions: Dict[str, Callable] = {}
        self.failure_history: Dict[str, List[datetime]] = defaultdict(list)
        self.recovery_counts: Dict[str, int] = defaultdict(int)
        self._lock = threading.Lock()

    def register_recovery_action(self, component: str, action: Callable):
        with self._lock:
            self.recovery_actions[component] = action

    def record_failure(self, component: str, max_failures: int = 5, window_seconds: int = 60):
        now = datetime.utcnow()
        with self._lock:
            self.failure_history[component].append(now)
            window_start = now - timedelta(seconds=window_seconds)
            self.failure_history[component] = [
                t for t in self.failure_history[component] if t > window_start
            ]

            if len(self.failure_history[component]) >= max_failures:
                if component in self.recovery_actions:
                    asyncio.create_task(self._execute_recovery(component))

    async def _execute_recovery(self, component: str):
        logger.warning(f"执行自动恢复: {component}")
        try:
            action = self.recovery_actions[component]
            if asyncio.iscoroutinefunction(action):
                await action()
            else:
                action()
            self.recovery_counts[component] += 1
            logger.info(f"自动恢复成功: {component}")
        except Exception as e:
            logger.error(f"自动恢复失败: {component}, 错误: {e}")

    def get_recovery_stats(self) -> Dict:
        with self._lock:
            return {
                component: {
                    "recent_failures": len(self.failure_history[component]),
                    "recovery_count": self.recovery_counts[component]
                }
                for component in self.recovery_actions.keys()
            }


class DatabaseConnectionPoolManager:
    def __init__(self):
        self.pool_stats: Dict[str, Dict] = {}
        self._lock = threading.Lock()

    def record_pool_stats(self, pool_name: str, checked_in: int, checked_out: int, overflow: int):
        with self._lock:
            self.pool_stats[pool_name] = {
                "checked_in": checked_in,
                "checked_out": checked_out,
                "overflow": overflow,
                "last_updated": datetime.utcnow()
            }

    def get_pool_stats(self) -> Dict:
        with self._lock:
            return dict(self.pool_stats)


class QueryOptimizer:
    def __init__(self):
        self.query_cache: Dict[str, tuple] = {}
        self.slow_queries: List[Dict] = []
        self._lock = threading.Lock()
        self.max_slow_queries = 100

    def cache_query(self, query_key: str, result: Any, ttl_seconds: int = 300):
        with self._lock:
            self.query_cache[query_key] = (
                result,
                datetime.utcnow() + timedelta(seconds=ttl_seconds)
            )

    def get_cached_query(self, query_key: str) -> Any:
        with self._lock:
            if query_key in self.query_cache:
                result, expiry = self.query_cache[query_key]
                if datetime.utcnow() < expiry:
                    return result
                else:
                    del self.query_cache[query_key]
        return None

    def record_slow_query(self, query: str, execution_time: float, params: Dict = None):
        with self._lock:
            self.slow_queries.append({
                "query": query,
                "execution_time": execution_time,
                "params": params,
                "timestamp": datetime.utcnow()
            })
            if len(self.slow_queries) > self.max_slow_queries:
                self.slow_queries.pop(0)

    def get_slow_queries(self, min_time: float = 1.0) -> List[Dict]:
        with self._lock:
            return [
                q for q in self.slow_queries
                if q["execution_time"] >= min_time
            ]


class PerformanceMonitorMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, metrics: PerformanceMetrics):
        super().__init__(app)
        self.metrics = metrics

    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        endpoint = request.url.path
        is_error = False

        try:
            response = await call_next(request)
            return response
        except Exception as e:
            is_error = True
            raise
        finally:
            elapsed = time.time() - start_time
            self.metrics.record_request(endpoint, elapsed, is_error)


def monitor_performance(func):
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            result = await func(*args, **kwargs)
            return result
        finally:
            elapsed = time.time() - start_time
            if elapsed > 1.0:
                logger.warning(f"慢请求: {func.__name__}, 耗时: {elapsed:.3f}s")
    return wrapper


def with_retry(max_retries: int = 3, delay_seconds: float = 1.0, backoff: float = 2.0):
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            current_delay = delay_seconds
            for attempt in range(max_retries):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    if attempt == max_retries - 1:
                        raise
                    logger.warning(f"重试 {attempt + 1}/{max_retries}: {func.__name__}, 错误: {e}")
                    await asyncio.sleep(current_delay)
                    current_delay *= backoff
        return wrapper
    return decorator


_global_metrics = PerformanceMetrics()
_global_recovery = AutoRecoveryMechanism()
_global_pool_manager = DatabaseConnectionPoolManager()
_global_query_optimizer = QueryOptimizer()


def get_performance_metrics() -> PerformanceMetrics:
    return _global_metrics


def get_auto_recovery() -> AutoRecoveryMechanism:
    return _global_recovery


def get_pool_manager() -> DatabaseConnectionPoolManager:
    return _global_pool_manager


def get_query_optimizer() -> QueryOptimizer:
    return _global_query_optimizer

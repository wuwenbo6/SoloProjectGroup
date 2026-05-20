#!/usr/bin/env python3
"""
系统稳定性增强模块
实现容错、降级、重试、熔断、限流等机制
"""

import time
import threading
import logging
from typing import Dict, List, Optional, Callable, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
from collections import deque
from functools import wraps
import hashlib
import json
import random

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class RetryStrategy(Enum):
    """重试策略"""
    FIXED = "fixed"
    EXPONENTIAL = "exponential"
    LINEAR = "linear"
    RANDOM = "random"


class CircuitState(Enum):
    """断路器状态"""
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class DegradationLevel(Enum):
    """降级级别"""
    NORMAL = "normal"
    LIGHT = "light"
    MEDIUM = "medium"
    HEAVY = "heavy"
    CRITICAL = "critical"


class ErrorCategory(Enum):
    """错误类别"""
    TRANSIENT = "transient"
    PERMANENT = "permanent"
    NETWORK = "network"
    RESOURCE = "resource"
    TIMEOUT = "timeout"
    VALIDATION = "validation"
    UNKNOWN = "unknown"


@dataclass
class RetryConfig:
    """重试配置"""
    max_attempts: int = 3
    initial_delay: float = 0.1
    strategy: RetryStrategy = RetryStrategy.EXPONENTIAL
    exponential_base: float = 2.0
    max_delay: float = 5.0
    jitter: bool = True
    retry_on_exceptions: Tuple[type, ...] = field(default_factory=lambda: (Exception,))


@dataclass
class CircuitBreakerConfig:
    """断路器配置"""
    failure_threshold: int = 5
    success_threshold: int = 3
    timeout_seconds: float = 30.0
    reset_timeout: float = 60.0
    half_open_max_calls: int = 3


@dataclass
class RateLimitConfig:
    """限流配置"""
    max_requests: int = 100
    time_window: float = 60.0
    max_burst: int = 20
    enable_burst: bool = True


@dataclass
class BulkheadConfig:
    """舱壁模式配置"""
    max_concurrent_calls: int = 10
    max_queue_size: int = 100
    timeout_seconds: float = 5.0


@dataclass
class OperationStats:
    """操作统计"""
    total_calls: int = 0
    successful_calls: int = 0
    failed_calls: int = 0
    retry_count: int = 0
    timeout_count: int = 0
    circuit_breaker_trips: int = 0
    rate_limited_count: int = 0
    avg_latency_ms: float = 0.0
    p99_latency_ms: float = 0.0


class RetryHandler:
    """重试处理器"""
    
    def __init__(self, config: Optional[RetryConfig] = None):
        self.config = config or RetryConfig()
        self._lock = threading.Lock()
        self._retry_stats: Dict[str, int] = {}
    
    def _calculate_delay(self, attempt: int) -> float:
        """计算延迟"""
        if attempt >= self.config.max_attempts:
            return 0.0
        
        strategy = self.config.strategy
        initial = self.config.initial_delay
        
        if strategy == RetryStrategy.FIXED:
            delay = initial
        elif strategy == RetryStrategy.EXPONENTIAL:
            delay = initial * (self.config.exponential_base ** attempt)
        elif strategy == RetryStrategy.LINEAR:
            delay = initial * (attempt + 1)
        elif strategy == RetryStrategy.RANDOM:
            delay = random.uniform(0, initial * 2)
        else:
            delay = initial
        
        if self.config.jitter:
            delay = delay * (0.5 + random.random())
        
        return min(delay, self.config.max_delay)
    
    def execute(self,
               operation: Callable,
               *args,
               operation_name: str = "unknown",
               on_retry: Optional[Callable[[int, Exception], None]] = None,
               **kwargs) -> Any:
        """执行带重试的操作"""
        last_exception = None
        
        for attempt in range(self.config.max_attempts):
            try:
                result = operation(*args, **kwargs)
                
                if attempt > 0:
                    with self._lock:
                        self._retry_stats[operation_name] = \
                            self._retry_stats.get(operation_name, 0) + attempt
                
                return result
            
            except Exception as e:
                last_exception = e
                
                if not isinstance(e, self.config.retry_on_exceptions):
                    raise
                
                if attempt < self.config.max_attempts - 1:
                    delay = self._calculate_delay(attempt)
                    
                    if on_retry:
                        try:
                            on_retry(attempt + 1, e)
                        except Exception:
                            pass
                    
                    logger.warning(
                        f"Retry {attempt + 1}/{self.config.max_attempts} "
                        f"for {operation_name} after {delay:.3f}s: {e}"
                    )
                    
                    time.sleep(delay)
                else:
                    logger.error(
                        f"Operation {operation_name} failed after "
                        f"{self.config.max_attempts} attempts: {e}"
                    )
        
        if last_exception:
            raise last_exception
    
    def get_retry_count(self, operation_name: str) -> int:
        """获取重试次数"""
        with self._lock:
            return self._retry_stats.get(operation_name, 0)


class CircuitBreaker:
    """断路器"""
    
    def __init__(self, name: str, config: Optional[CircuitBreakerConfig] = None):
        self.name = name
        self.config = config or CircuitBreakerConfig()
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._last_failure_time = 0.0
        self._open_time = 0.0
        self._lock = threading.Lock()
        self._trip_count = 0
        self._half_open_calls = 0
    
    @property
    def state(self) -> CircuitState:
        """获取状态"""
        return self._state
    
    def can_execute(self) -> bool:
        """判断是否可以执行"""
        with self._lock:
            if self._state == CircuitState.CLOSED:
                return True
            
            if self._state == CircuitState.OPEN:
                now = time.time()
                if now - self._open_time >= self.config.reset_timeout:
                    self._state = CircuitState.HALF_OPEN
                    self._half_open_calls = 0
                    logger.info(f"Circuit breaker {self.name} entering half-open state")
                    return True
                return False
            
            if self._state == CircuitState.HALF_OPEN:
                return self._half_open_calls < self.config.half_open_max_calls
            
            return False
    
    def record_success(self):
        """记录成功"""
        with self._lock:
            self._failure_count = 0
            
            if self._state == CircuitState.HALF_OPEN:
                self._success_count += 1
                if self._success_count >= self.config.success_threshold:
                    self._state = CircuitState.CLOSED
                    self._success_count = 0
                    logger.info(f"Circuit breaker {self.name} closed - service recovered")
            
            elif self._state == CircuitState.OPEN:
                self._state = CircuitState.CLOSED
                self._success_count = 0
                logger.info(f"Circuit breaker {self.name} closed")
    
    def record_failure(self, exception: Optional[Exception] = None):
        """记录失败"""
        with self._lock:
            self._last_failure_time = time.time()
            
            if self._state == CircuitState.CLOSED:
                self._failure_count += 1
                if self._failure_count >= self.config.failure_threshold:
                    self._trip()
            
            elif self._state == CircuitState.HALF_OPEN:
                self._trip()
    
    def _trip(self):
        """触发断路器"""
        self._state = CircuitState.OPEN
        self._open_time = time.time()
        self._trip_count += 1
        self._failure_count = 0
        self._success_count = 0
        logger.warning(f"Circuit breaker {self.name} tripped!")
    
    def reset(self):
        """重置断路器"""
        with self._lock:
            self._state = CircuitState.CLOSED
            self._failure_count = 0
            self._success_count = 0
            self._half_open_calls = 0
            self._trip_count = 0
    
    def get_stats(self) -> Dict:
        """获取统计"""
        with self._lock:
            return {
                'name': self.name,
                'state': self._state.value,
                'failure_count': self._failure_count,
                'success_count': self._success_count,
                'trip_count': self._trip_count,
                'time_in_state': time.time() - self._open_time if self._state != CircuitState.CLOSED else 0,
            }


class RateLimiter:
    """限流器 - 令牌桶算法"""
    
    def __init__(self, name: str, config: Optional[RateLimitConfig] = None):
        self.name = name
        self.config = config or RateLimitConfig()
        self._tokens = self.config.max_requests
        self._last_refill = time.time()
        self._lock = threading.Lock()
        self._limited_count = 0
        self._total_requests = 0
    
    def _refill_tokens(self):
        """补充令牌"""
        now = time.time()
        elapsed = now - self._last_refill
        
        if elapsed > 0:
            tokens_to_add = int(elapsed * self.config.max_requests / self.config.time_window)
            max_tokens = self.config.max_requests + (self.config.max_burst if self.config.enable_burst else 0)
            self._tokens = min(max_tokens, self._tokens + tokens_to_add)
            self._last_refill = now
    
    def try_acquire(self, tokens: int = 1) -> bool:
        """尝试获取令牌"""
        with self._lock:
            self._total_requests += 1
            self._refill_tokens()
            
            if self._tokens >= tokens:
                self._tokens -= tokens
                return True
            
            self._limited_count += 1
            return False
    
    def acquire(self, tokens: int = 1, timeout: Optional[float] = None) -> bool:
        """获取令牌，带超时"""
        start = time.time()
        
        while True:
            if self.try_acquire(tokens):
                return True
            
            if timeout and time.time() - start >= timeout:
                return False
            
            time.sleep(0.01)
    
    def get_stats(self) -> Dict:
        """获取统计"""
        with self._lock:
            self._refill_tokens()
            return {
                'name': self.name,
                'available_tokens': self._tokens,
                'max_tokens': self.config.max_requests,
                'total_requests': self._total_requests,
                'limited_count': self._limited_count,
                'limit_rate': (
                    self._limited_count / self._total_requests
                    if self._total_requests > 0 else 0
                ),
            }


class Bulkhead:
    """舱壁模式 - 隔离资源"""
    
    def __init__(self, name: str, config: Optional[BulkheadConfig] = None):
        self.name = name
        self.config = config or BulkheadConfig()
        self._semaphore = threading.Semaphore(self.config.max_concurrent_calls)
        self._active_calls = 0
        self._rejected_calls = 0
        self._total_calls = 0
        self._lock = threading.Lock()
        self._latency_samples: deque = deque(maxlen=1000)
    
    def can_acquire(self) -> bool:
        """判断是否可以获取"""
        with self._lock:
            return self._active_calls < self.config.max_concurrent_calls
    
    def acquire(self, timeout: Optional[float] = None) -> bool:
        """获取资源"""
        timeout = timeout or self.config.timeout_seconds
        acquired = self._semaphore.acquire(timeout=timeout)
        
        with self._lock:
            self._total_calls += 1
            if acquired:
                self._active_calls += 1
            else:
                self._rejected_calls += 1
        
        return acquired
    
    def release(self, latency_ms: Optional[float] = None):
        """释放资源"""
        self._semaphore.release()
        
        with self._lock:
            self._active_calls -= 1
            if latency_ms is not None:
                self._latency_samples.append(latency_ms)
    
    def get_stats(self) -> Dict:
        """获取统计"""
        with self._lock:
            avg_latency = (
                sum(self._latency_samples) / len(self._latency_samples)
                if self._latency_samples else 0
            )
            
            return {
                'name': self.name,
                'active_calls': self._active_calls,
                'max_concurrent_calls': self.config.max_concurrent_calls,
                'utilization': self._active_calls / max(self.config.max_concurrent_calls, 1),
                'total_calls': self._total_calls,
                'rejected_calls': self._rejected_calls,
                'rejection_rate': (
                    self._rejected_calls / self._total_calls
                    if self._total_calls > 0 else 0
                ),
                'avg_latency_ms': avg_latency,
            }


class FallbackHandler:
    """降级处理器"""
    
    def __init__(self):
        self._fallbacks: Dict[str, Callable] = {}
        self._degradation_level = DegradationLevel.NORMAL
        self._lock = threading.Lock()
        self._degradation_history: deque = deque(maxlen=100)
    
    def register_fallback(self, operation_name: str, fallback: Callable):
        """注册降级方法"""
        with self._lock:
            self._fallbacks[operation_name] = fallback
    
    def execute_with_fallback(self,
                             operation: Callable,
                             operation_name: str,
                             *args,
                             fallback: Optional[Callable] = None,
                             **kwargs) -> Tuple[Any, bool]:
        """执行带降级的操作"""
        try:
            result = operation(*args, **kwargs)
            return result, False
        except Exception as e:
            logger.warning(f"Operation {operation_name} failed, attempting fallback: {e}")
            
            with self._lock:
                registered_fallback = self._fallbacks.get(operation_name)
            
            actual_fallback = fallback or registered_fallback
            
            if actual_fallback:
                try:
                    result = actual_fallback(*args, **kwargs)
                    self._record_degradation(operation_name, e)
                    return result, True
                except Exception as fallback_error:
                    logger.error(f"Fallback for {operation_name} also failed: {fallback_error}")
                    raise fallback_error
            else:
                raise e
    
    def _record_degradation(self, operation_name: str, exception: Exception):
        """记录降级"""
        with self._lock:
            self._degradation_history.append({
                'operation': operation_name,
                'exception': str(exception),
                'timestamp': time.time(),
            })
    
    def set_degradation_level(self, level: DegradationLevel):
        """设置降级级别"""
        with self._lock:
            self._degradation_level = level
            logger.info(f"Degradation level set to: {level.value}")
    
    def get_degradation_level(self) -> DegradationLevel:
        """获取降级级别"""
        with self._lock:
            return self._degradation_level
    
    def get_degradation_stats(self) -> Dict:
        """获取降级统计"""
        with self._lock:
            return {
                'current_level': self._degradation_level.value,
                'total_degradations': len(self._degradation_history),
                'recent_degradations': list(self._degradation_history)[-10:],
                'registered_fallbacks': list(self._fallbacks.keys()),
            }


class TimeoutHandler:
    """超时处理器"""
    
    def __init__(self, default_timeout: float = 30.0):
        self.default_timeout = default_timeout
        self._timeout_stats: Dict[str, int] = {}
        self._lock = threading.Lock()
    
    def execute_with_timeout(self,
                            operation: Callable,
                            timeout: Optional[float] = None,
                            operation_name: str = "unknown",
                            *args,
                            **kwargs) -> Any:
        """带超时执行操作"""
        timeout = timeout or self.default_timeout
        result = [None]
        exception = [None]
        
        def target():
            try:
                result[0] = operation(*args, **kwargs)
            except Exception as e:
                exception[0] = e
        
        thread = threading.Thread(target=target, daemon=True)
        thread.start()
        thread.join(timeout=timeout)
        
        if thread.is_alive():
            with self._lock:
                self._timeout_stats[operation_name] = \
                    self._timeout_stats.get(operation_name, 0) + 1
            
            raise TimeoutError(
                f"Operation {operation_name} timed out after {timeout}s"
            )
        
        if exception[0] is not None:
            raise exception[0]
        
        return result[0]
    
    def get_timeout_count(self, operation_name: str) -> int:
        """获取超时次数"""
        with self._lock:
            return self._timeout_stats.get(operation_name, 0)


class ErrorClassifier:
    """错误分类器"""
    
    @staticmethod
    def classify(exception: Exception) -> ErrorCategory:
        """分类错误"""
        error_str = str(exception).lower()
        
        if isinstance(exception, TimeoutError):
            return ErrorCategory.TIMEOUT
        
        if isinstance(exception, (ConnectionError, OSError)):
            return ErrorCategory.NETWORK
        
        if isinstance(exception, (ValueError, TypeError)):
            return ErrorCategory.VALIDATION
        
        if 'memory' in error_str or 'resource' in error_str:
            return ErrorCategory.RESOURCE
        
        if 'temporary' in error_str or 'transient' in error_str:
            return ErrorCategory.TRANSIENT
        
        return ErrorCategory.UNKNOWN
    
    @staticmethod
    def is_retryable(exception: Exception) -> bool:
        """判断是否可重试"""
        category = ErrorClassifier.classify(exception)
        return category in {
            ErrorCategory.TRANSIENT,
            ErrorCategory.NETWORK,
            ErrorCategory.TIMEOUT,
        }


class StabilityManager:
    """稳定性管理器 - 整合所有稳定性机制"""
    
    def __init__(self):
        self._retry_handlers: Dict[str, RetryHandler] = {}
        self._circuit_breakers: Dict[str, CircuitBreaker] = {}
        self._rate_limiters: Dict[str, RateLimiter] = {}
        self._bulkheads: Dict[str, Bulkhead] = {}
        self._fallback_handler = FallbackHandler()
        self._timeout_handler = TimeoutHandler()
        
        self._operation_stats: Dict[str, OperationStats] = {}
        self._global_configs: Dict[str, Any] = {}
        
        self._lock = threading.Lock()
        self._running = False
        self._monitor_thread: Optional[threading.Thread] = None
        
        logger.info("Stability manager initialized")
    
    def configure_retry(self, name: str, config: RetryConfig):
        """配置重试"""
        with self._lock:
            self._retry_handlers[name] = RetryHandler(config)
            self._global_configs[f'retry_{name}'] = config
    
    def configure_circuit_breaker(self, name: str, config: CircuitBreakerConfig):
        """配置断路器"""
        with self._lock:
            self._circuit_breakers[name] = CircuitBreaker(name, config)
            self._global_configs[f'cb_{name}'] = config
    
    def configure_rate_limiter(self, name: str, config: RateLimitConfig):
        """配置限流器"""
        with self._lock:
            self._rate_limiters[name] = RateLimiter(name, config)
            self._global_configs[f'rl_{name}'] = config
    
    def configure_bulkhead(self, name: str, config: BulkheadConfig):
        """配置舱壁"""
        with self._lock:
            self._bulkheads[name] = Bulkhead(name, config)
            self._global_configs[f'bh_{name}'] = config
    
    def register_fallback(self, operation_name: str, fallback: Callable):
        """注册降级方法"""
        self._fallback_handler.register_fallback(operation_name, fallback)
    
    def execute_stable(self,
                      operation: Callable,
                      operation_name: str,
                      *args,
                      enable_retry: bool = True,
                      enable_circuit_breaker: bool = True,
                      enable_rate_limit: bool = True,
                      enable_bulkhead: bool = True,
                      enable_timeout: bool = True,
                      enable_fallback: bool = True,
                      timeout: Optional[float] = None,
                      fallback: Optional[Callable] = None,
                      **kwargs) -> Any:
        """执行稳定操作（所有稳定性机制）"""
        start_time = time.time()
        degraded = False
        
        try:
            with self._lock:
                if operation_name not in self._operation_stats:
                    self._operation_stats[operation_name] = OperationStats()
                self._operation_stats[operation_name].total_calls += 1
            
            if enable_circuit_breaker and operation_name in self._circuit_breakers:
                cb = self._circuit_breakers[operation_name]
                if not cb.can_execute():
                    logger.warning(f"Circuit breaker {operation_name} is open, rejecting")
                    with self._lock:
                        self._operation_stats[operation_name].circuit_breaker_trips += 1
                    raise RuntimeError(f"Circuit breaker {operation_name} is open")
            
            if enable_rate_limit and operation_name in self._rate_limiters:
                rl = self._rate_limiters[operation_name]
                if not rl.try_acquire():
                    logger.warning(f"Rate limit exceeded for {operation_name}")
                    with self._lock:
                        self._operation_stats[operation_name].rate_limited_count += 1
                    raise RuntimeError(f"Rate limit exceeded for {operation_name}")
            
            bulkhead_acquired = False
            if enable_bulkhead and operation_name in self._bulkheads:
                bh = self._bulkheads[operation_name]
                if not bh.acquire():
                    logger.warning(f"Bulkhead {operation_name} is full")
                    raise RuntimeError(f"Bulkhead {operation_name} capacity exceeded")
                bulkhead_acquired = True
            
            try:
                def do_operation():
                    if enable_retry and operation_name in self._retry_handlers:
                        retry_handler = self._retry_handlers[operation_name]
                        return retry_handler.execute(
                            operation,
                            operation_name=operation_name,
                            *args,
                            **kwargs
                        )
                    else:
                        return operation(*args, **kwargs)
                
                if enable_timeout:
                    result = self._timeout_handler.execute_with_timeout(
                        do_operation,
                        timeout=timeout,
                        operation_name=operation_name,
                    )
                else:
                    result = do_operation()
                
                if enable_circuit_breaker and operation_name in self._circuit_breakers:
                    self._circuit_breakers[operation_name].record_success()
                
                with self._lock:
                    self._operation_stats[operation_name].successful_calls += 1
                
                return result
            
            except Exception as e:
                if enable_circuit_breaker and operation_name in self._circuit_breakers:
                    self._circuit_breakers[operation_name].record_failure(e)
                
                with self._lock:
                    self._operation_stats[operation_name].failed_calls += 1
                
                if enable_fallback:
                    result, degraded = self._fallback_handler.execute_with_fallback(
                        lambda: operation(*args, **kwargs),
                        operation_name,
                        fallback=fallback,
                    )
                    return result
                else:
                    raise
            finally:
                if bulkhead_acquired and enable_bulkhead and operation_name in self._bulkheads:
                    latency = (time.time() - start_time) * 1000
                    self._bulkheads[operation_name].release(latency)
        
        except Exception as e:
            if isinstance(e, TimeoutError):
                with self._lock:
                    self._operation_stats[operation_name].timeout_count += 1
            raise
    
    def get_all_stats(self) -> Dict:
        """获取所有统计"""
        with self._lock:
            return {
                'operation_stats': {
                    name: {
                        'total_calls': stats.total_calls,
                        'successful_calls': stats.successful_calls,
                        'failed_calls': stats.failed_calls,
                        'retry_count': stats.retry_count,
                        'timeout_count': stats.timeout_count,
                        'circuit_breaker_trips': stats.circuit_breaker_trips,
                        'rate_limited_count': stats.rate_limited_count,
                        'success_rate': (
                            stats.successful_calls / stats.total_calls
                            if stats.total_calls > 0 else 0
                        ),
                    }
                    for name, stats in self._operation_stats.items()
                },
                'circuit_breakers': {
                    name: cb.get_stats()
                    for name, cb in self._circuit_breakers.items()
                },
                'rate_limiters': {
                    name: rl.get_stats()
                    for name, rl in self._rate_limiters.items()
                },
                'bulkheads': {
                    name: bh.get_stats()
                    for name, bh in self._bulkheads.items()
                },
                'fallbacks': self._fallback_handler.get_degradation_stats(),
                'degradation_level': self._fallback_handler.get_degradation_level().value,
            }
    
    def health_check(self) -> Dict:
        """健康检查"""
        stats = self.get_all_stats()
        
        total_calls = sum(
            s['total_calls']
            for s in stats['operation_stats'].values()
        )
        failed_calls = sum(
            s['failed_calls']
            for s in stats['operation_stats'].values()
        )
        
        overall_health = 'healthy'
        if total_calls > 0 and failed_calls / total_calls > 0.1:
            overall_health = 'degraded'
        if total_calls > 0 and failed_calls / total_calls > 0.3:
            overall_health = 'unhealthy'
        
        open_circuits = [
            name for name, cb_stats in stats['circuit_breakers'].items()
            if cb_stats['state'] != 'closed'
        ]
        
        return {
            'overall_health': overall_health,
            'total_operations': total_calls,
            'failed_operations': failed_calls,
            'open_circuit_breakers': open_circuits,
            'degradation_level': stats['degradation_level'],
            'timestamp': time.time(),
        }
    
    def start_monitor(self, interval: float = 10.0):
        """启动监控"""
        self._running = True
        self._monitor_thread = threading.Thread(
            target=self._monitor_loop,
            args=(interval,),
            daemon=True,
        )
        self._monitor_thread.start()
        logger.info("Stability monitor started")
    
    def stop_monitor(self):
        """停止监控"""
        self._running = False
        if self._monitor_thread:
            self._monitor_thread.join(timeout=2.0)
        logger.info("Stability monitor stopped")
    
    def _monitor_loop(self, interval: float):
        """监控循环"""
        while self._running:
            health = self.health_check()
            
            if health['overall_health'] != 'healthy':
                logger.warning(
                    f"System health is {health['overall_health']}: "
                    f"failed={health['failed_operations']}/{health['total_operations']}"
                )
            
            time.sleep(interval)


def with_stability(manager: StabilityManager,
                  operation_name: str,
                  **options):
    """稳定性装饰器"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            return manager.execute_stable(
                func,
                operation_name,
                *args,
                **options,
                **kwargs,
            )
        return wrapper
    return decorator

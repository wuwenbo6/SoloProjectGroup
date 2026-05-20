import os
import asyncio
import logging
import time
from typing import Dict, List, Optional, Any, Callable, Awaitable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from collections import deque
from functools import wraps
import threading
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor
import queue
import uuid

logger = logging.getLogger(__name__)

class ConcurrencyStrategy:
    ASYNC = "async"
    THREAD = "thread"
    PROCESS = "process"
    HYBRID = "hybrid"

@dataclass
class RequestMetrics:
    request_id: str
    endpoint: str
    start_time: float
    end_time: Optional[float] = None
    duration_ms: Optional[float] = None
    status: str = "pending"
    error: Optional[str] = None
    queue_wait_ms: Optional[float] = None
    
    def complete(self, status: str = "success", error: str = None):
        self.end_time = time.time()
        self.duration_ms = (self.end_time - self.start_time) * 1000
        self.status = status
        self.error = error

@dataclass
class ConcurrencyConfig:
    max_concurrent_requests: int = 100
    max_queue_size: int = 1000
    request_timeout_sec: int = 30
    worker_threads: int = 8
    worker_processes: int = 4
    strategy: str = ConcurrencyStrategy.HYBRID
    enable_request_batching: bool = True
    batch_size: int = 16
    batch_window_ms: int = 50

class AsyncRequestQueue:
    def __init__(self, config: ConcurrencyConfig):
        self.config = config
        self.queue = asyncio.Queue(maxsize=config.max_queue_size)
        self.active_requests: Dict[str, RequestMetrics] = {}
        self.completed_requests: deque = deque(maxlen=10000)
        self.semaphore = asyncio.Semaphore(config.max_concurrent_requests)
        self._running = False
        self._worker_task: Optional[asyncio.Task] = None
        
    async def start(self):
        if not self._running:
            self._running = True
            self._worker_task = asyncio.create_task(self._worker_loop())
            logger.info("Async request queue started")
    
    async def stop(self):
        self._running = False
        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
        logger.info("Async request queue stopped")
    
    async def submit(self, coro: Awaitable, request_id: str, endpoint: str) -> Any:
        metrics = RequestMetrics(
            request_id=request_id,
            endpoint=endpoint,
            start_time=time.time()
        )
        self.active_requests[request_id] = metrics
        
        try:
            async with self.semaphore:
                queue_enter_time = time.time()
                metrics.queue_wait_ms = (queue_enter_time - metrics.start_time) * 1000
                
                result = await asyncio.wait_for(
                    coro,
                    timeout=self.config.request_timeout_sec
                )
                
                metrics.complete("success")
                return result
                
        except asyncio.TimeoutError:
            metrics.complete("timeout", "Request timed out")
            raise
        except Exception as e:
            metrics.complete("error", str(e))
            raise
        finally:
            self.completed_requests.append(metrics)
            if request_id in self.active_requests:
                del self.active_requests[request_id]
    
    async def _worker_loop(self):
        while self._running:
            await asyncio.sleep(0.1)
    
    def get_queue_stats(self) -> Dict[str, Any]:
        now = time.time()
        active_durations = []
        for req in self.active_requests.values():
            active_durations.append((now - req.start_time) * 1000)
        
        completed_count = len(self.completed_requests)
        avg_duration = 0
        if completed_count > 0:
            durations = [r.duration_ms for r in self.completed_requests if r.duration_ms]
            if durations:
                avg_duration = sum(durations) / len(durations)
        
        return {
            "queue_size": self.queue.qsize(),
            "active_requests": len(self.active_requests),
            "completed_requests": completed_count,
            "avg_request_duration_ms": round(avg_duration, 2),
            "max_active_duration_ms": round(max(active_durations) if active_durations else 0, 2),
            "avg_queue_wait_ms": round(sum(r.queue_wait_ms or 0 for r in self.completed_requests) / completed_count if completed_count > 0 else 0, 2),
            "timestamp": datetime.now().isoformat()
        }

class BatchingEngine:
    def __init__(self, config: ConcurrencyConfig, process_func: Callable):
        self.config = config
        self.process_func = process_func
        self._batch_buffer: List[Dict] = []
        self._last_batch_time = time.time()
        self._lock = threading.Lock()
        self._results: Dict[str, Any] = {}
        self._events: Dict[str, threading.Event] = {}
        
        self._batch_thread = threading.Thread(target=self._batch_loop, daemon=True)
        self._batch_thread.start()
        logger.info("Batching engine started")
    
    def submit(self, item: Dict) -> Any:
        request_id = str(uuid.uuid4())
        event = threading.Event()
        
        with self._lock:
            self._batch_buffer.append({
                "request_id": request_id,
                "item": item,
                "submit_time": time.time()
            })
            self._events[request_id] = event
        
        event.wait(timeout=self.config.request_timeout_sec)
        
        with self._lock:
            result = self._results.pop(request_id, None)
            self._events.pop(request_id, None)
        
        return result
    
    def _batch_loop(self):
        while True:
            time.sleep(self.config.batch_window_ms / 1000.0)
            
            with self._lock:
                buffer_size = len(self._batch_buffer)
                time_since_last_batch = (time.time() - self._last_batch_time) * 1000
                
                should_process = (
                    buffer_size >= self.config.batch_size or
                    (buffer_size > 0 and time_since_last_batch >= self.config.batch_window_ms)
                )
                
                if not should_process:
                    continue
                
                batch_items = self._batch_buffer[:self.config.batch_size]
                self._batch_buffer = self._batch_buffer[self.config.batch_size:]
                self._last_batch_time = time.time()
            
            if batch_items:
                self._process_batch(batch_items)
    
    def _process_batch(self, batch_items: List[Dict]):
        try:
            items = [bi["item"] for bi in batch_items]
            results = self.process_func(items)
            
            with self._lock:
                for bi, result in zip(batch_items, results):
                    request_id = bi["request_id"]
                    self._results[request_id] = result
                    if request_id in self._events:
                        self._events[request_id].set()
        
        except Exception as e:
            logger.error(f"Batch processing error: {e}")
            with self._lock:
                for bi in batch_items:
                    request_id = bi["request_id"]
                    self._results[request_id] = {"error": str(e)}
                    if request_id in self._events:
                        self._events[request_id].set()

class WorkerPool:
    def __init__(self, config: ConcurrencyConfig):
        self.config = config
        self.thread_executor = ThreadPoolExecutor(max_workers=config.worker_threads)
        self.process_executor = None
        if config.worker_processes > 0:
            self.process_executor = ProcessPoolExecutor(max_workers=config.worker_processes)
        logger.info(f"Worker pool initialized: {config.worker_threads} threads, {config.worker_processes} processes")
    
    async def run_in_thread(self, func: Callable, *args, **kwargs) -> Any:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self.thread_executor, lambda: func(*args, **kwargs))
    
    async def run_in_process(self, func: Callable, *args, **kwargs) -> Any:
        if not self.process_executor:
            return await self.run_in_thread(func, *args, **kwargs)
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self.process_executor, lambda: func(*args, **kwargs))
    
    def shutdown(self):
        self.thread_executor.shutdown(wait=True)
        if self.process_executor:
            self.process_executor.shutdown(wait=True)

class AsyncRateLimiter:
    def __init__(self, max_requests_per_minute: int = 1000):
        self.max_requests = max_requests_per_minute
        self.request_times: deque = deque()
        self._lock = threading.Lock()
    
    def acquire(self) -> bool:
        with self._lock:
            now = time.time()
            cutoff = now - 60
            
            while self.request_times and self.request_times[0] < cutoff:
                self.request_times.popleft()
            
            if len(self.request_times) < self.max_requests:
                self.request_times.append(now)
                return True
            return False
    
    async def wait_for_slot(self) -> bool:
        while not self.acquire():
            await asyncio.sleep(0.1)
        return True
    
    def get_stats(self) -> Dict[str, Any]:
        with self._lock:
            now = time.time()
            cutoff = now - 60
            recent_requests = [t for t in self.request_times if t >= cutoff]
            return {
                "requests_last_minute": len(recent_requests),
                "max_requests_per_minute": self.max_requests,
                "utilization": round(len(recent_requests) / self.max_requests * 100, 2)
            }

class CircuitBreakerState:
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"

class CircuitBreaker:
    def __init__(self, name: str, failure_threshold: int = 5, 
                 recovery_timeout_sec: int = 30,
                 half_open_success_threshold: int = 3):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = timedelta(seconds=recovery_timeout_sec)
        self.half_open_success_threshold = half_open_success_threshold
        
        self.state = CircuitBreakerState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time: Optional[datetime] = None
        self.open_time: Optional[datetime] = None
        
        self._lock = threading.Lock()
        logger.info(f"Circuit breaker '{name}' initialized")
    
    def can_execute(self) -> bool:
        with self._lock:
            if self.state == CircuitBreakerState.CLOSED:
                return True
            
            if self.state == CircuitBreakerState.OPEN:
                if datetime.now() - self.open_time >= self.recovery_timeout:
                    logger.info(f"Circuit breaker '{self.name}' transitioning to HALF_OPEN")
                    self.state = CircuitBreakerState.HALF_OPEN
                    self.success_count = 0
                    return True
                return False
            
            return self.state == CircuitBreakerState.HALF_OPEN
    
    def record_success(self):
        with self._lock:
            if self.state == CircuitBreakerState.HALF_OPEN:
                self.success_count += 1
                if self.success_count >= self.half_open_success_threshold:
                    logger.info(f"Circuit breaker '{self.name}' transitioning to CLOSED (recovery successful)")
                    self.state = CircuitBreakerState.CLOSED
                    self.failure_count = 0
                    self.success_count = 0
            
            elif self.state == CircuitBreakerState.CLOSED:
                self.failure_count = max(0, self.failure_count - 1)
    
    def record_failure(self):
        with self._lock:
            self.last_failure_time = datetime.now()
            
            if self.state in [CircuitBreakerState.CLOSED, CircuitBreakerState.HALF_OPEN]:
                self.failure_count += 1
                
                if self.failure_count >= self.failure_threshold:
                    logger.warning(f"Circuit breaker '{self.name}' OPENED after {self.failure_count} failures")
                    self.state = CircuitBreakerState.OPEN
                    self.open_time = datetime.now()
                    self.failure_count = 0
    
    def get_state(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "name": self.name,
                "state": self.state,
                "failure_count": self.failure_count,
                "success_count_in_half_open": self.success_count,
                "last_failure_time": self.last_failure_time.isoformat() if self.last_failure_time else None,
                "open_time": self.open_time.isoformat() if self.open_time else None,
                "can_execute": self.state == CircuitBreakerState.CLOSED or 
                              (self.state == CircuitBreakerState.HALF_OPEN)
            }

def with_circuit_breaker(circuit_breaker: CircuitBreaker, fallback_func: Optional[Callable] = None):
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            if not circuit_breaker.can_execute():
                if fallback_func:
                    logger.warning(f"Circuit open, using fallback for {func.__name__}")
                    return fallback_func(*args, **kwargs)
                raise Exception(f"Circuit breaker '{circuit_breaker.name}' is OPEN")
            
            try:
                result = await func(*args, **kwargs)
                circuit_breaker.record_success()
                return result
            except Exception as e:
                circuit_breaker.record_failure()
                raise
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            if not circuit_breaker.can_execute():
                if fallback_func:
                    logger.warning(f"Circuit open, using fallback for {func.__name__}")
                    return fallback_func(*args, **kwargs)
                raise Exception(f"Circuit breaker '{circuit_breaker.name}' is OPEN")
            
            try:
                result = func(*args, **kwargs)
                circuit_breaker.record_success()
                return result
            except Exception as e:
                circuit_breaker.record_failure()
                raise
        
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    return decorator

def with_retry(max_retries: int = 3, retry_delay_ms: int = 1000, backoff_factor: float = 2.0):
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            delay = retry_delay_ms
            last_exception = None
            
            for attempt in range(max_retries):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    if attempt < max_retries - 1:
                        logger.warning(f"Retry {attempt + 1}/{max_retries} for {func.__name__}: {e}")
                        await asyncio.sleep(delay / 1000.0)
                        delay *= backoff_factor
            
            raise last_exception
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            delay = retry_delay_ms
            last_exception = None
            
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    if attempt < max_retries - 1:
                        logger.warning(f"Retry {attempt + 1}/{max_retries} for {func.__name__}: {e}")
                        time.sleep(delay / 1000.0)
                        delay *= backoff_factor
            
            raise last_exception
        
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    return decorator

class ConcurrencyManager:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if hasattr(self, '_initialized'):
            return
        self._initialized = True
        
        self.config = ConcurrencyConfig()
        self.request_queue = AsyncRequestQueue(self.config)
        self.worker_pool = WorkerPool(self.config)
        self.rate_limiter = AsyncRateLimiter(max_requests_per_minute=5000)
        self.circuit_breakers: Dict[str, CircuitBreaker] = {}
        
        self.startup_time = datetime.now()
        logger.info("Concurrency manager initialized")
    
    def get_circuit_breaker(self, name: str, **kwargs) -> CircuitBreaker:
        if name not in self.circuit_breakers:
            self.circuit_breakers[name] = CircuitBreaker(name, **kwargs)
        return self.circuit_breakers[name]
    
    async def start(self):
        await self.request_queue.start()
    
    async def shutdown(self):
        await self.request_queue.stop()
        self.worker_pool.shutdown()
    
    def get_status(self) -> Dict[str, Any]:
        uptime = (datetime.now() - self.startup_time).total_seconds()
        
        return {
            "uptime_seconds": round(uptime, 1),
            "concurrency_config": {
                "max_concurrent_requests": self.config.max_concurrent_requests,
                "max_queue_size": self.config.max_queue_size,
                "request_timeout_sec": self.config.request_timeout_sec,
                "worker_threads": self.config.worker_threads,
                "worker_processes": self.config.worker_processes,
                "strategy": self.config.strategy
            },
            "queue_stats": self.request_queue.get_queue_stats(),
            "rate_limiter": self.rate_limiter.get_stats(),
            "circuit_breakers": {
                name: cb.get_state() for name, cb in self.circuit_breakers.items()
            }
        }

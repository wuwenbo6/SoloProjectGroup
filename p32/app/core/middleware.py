import time
import asyncio
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from collections import defaultdict
import logging
from functools import wraps

logger = logging.getLogger(__name__)


class RateLimiter:
    def __init__(self, max_requests: int = 100, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests = defaultdict(list)
        self._lock = asyncio.Lock()

    async def is_allowed(self, client_id: str) -> bool:
        async with self._lock:
            current_time = time.time()
            window_start = current_time - self.window_seconds
            self.requests[client_id] = [
                req_time for req_time in self.requests[client_id]
                if req_time > window_start
            ]
            if len(self.requests[client_id]) >= self.max_requests:
                return False
            self.requests[client_id].append(current_time)
            return True


rate_limiter = RateLimiter(max_requests=200, window_seconds=60)


def retry_on_exception(max_retries: int = 3, delay: float = 0.1, exceptions: tuple = (Exception,)):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(max_retries):
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    if attempt < max_retries - 1:
                        await asyncio.sleep(delay * (2 ** attempt))
                        logger.warning(f"重试第 {attempt + 1} 次: {str(e)}")
            raise last_exception
        return wrapper
    return decorator


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host if request.client else "unknown"

        if not await rate_limiter.is_allowed(client_ip):
            logger.warning(f"请求频率超限: {client_ip}")
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": "请求过于频繁，请稍后再试",
                    "retry_after": 60
                }
            )

        try:
            start_time = time.time()
            response = await asyncio.wait_for(call_next(request), timeout=60.0)
            process_time = time.time() - start_time

            if process_time > 5:
                logger.warning(f"慢请求警告: {request.url.path} 耗时 {process_time:.2f}秒")

            return response
        except asyncio.TimeoutError:
            logger.error(f"请求超时: {request.url.path}")
            return JSONResponse(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                content={"detail": "请求处理超时，请稍后重试"}
            )
        except Exception as e:
            logger.error(f"请求处理异常: {str(e)}", exc_info=True)
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={
                    "detail": "服务暂时不可用，请稍后重试",
                    "retry_after": 10
                }
            )


class CircuitBreaker:
    def __init__(self, failure_threshold: int = 5, recovery_timeout: int = 30):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.last_failure_time = 0
        self.state = "CLOSED"
        self._lock = asyncio.Lock()

    async def call(self, func, *args, **kwargs):
        async with self._lock:
            if self.state == "OPEN":
                if time.time() - self.last_failure_time > self.recovery_timeout:
                    self.state = "HALF_OPEN"
                else:
                    raise HTTPException(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        detail="服务熔断，请稍后重试"
                    )

        try:
            result = await func(*args, **kwargs)
            async with self._lock:
                if self.state == "HALF_OPEN":
                    self.state = "CLOSED"
                    self.failure_count = 0
            return result
        except Exception as e:
            async with self._lock:
                self.failure_count += 1
                self.last_failure_time = time.time()
                if self.failure_count >= self.failure_threshold:
                    self.state = "OPEN"
                    logger.error(f"熔断器已打开，失败次数: {self.failure_count}")
            raise e


circuit_breaker = CircuitBreaker()

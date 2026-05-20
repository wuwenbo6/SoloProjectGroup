import random
import time
import asyncio
import aiohttp
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class Proxy:
    ip: str
    port: int
    protocol: str = "http"
    username: Optional[str] = None
    password: Optional[str] = None
    success_count: int = 0
    fail_count: int = 0
    last_used: Optional[datetime] = None
    last_check: Optional[datetime] = None
    response_time: float = 0.0
    is_active: bool = True

    @property
    def url(self) -> str:
        if self.username and self.password:
            return f"{self.protocol}://{self.username}:{self.password}@{self.ip}:{self.port}"
        return f"{self.protocol}://{self.ip}:{self.port}"

    @property
    def success_rate(self) -> float:
        total = self.success_count + self.fail_count
        return self.success_count / total if total > 0 else 0.0


class ProxyPool:
    def __init__(self, redis_client=None):
        self.proxies: List[Proxy] = []
        self.redis = redis_client
        self.current_index = 0
        self.lock = asyncio.Lock()
        self._load_default_proxies()

    def _load_default_proxies(self):
        default_proxies = [
            {"ip": "127.0.0.1", "port": 8080, "protocol": "http"},
            {"ip": "127.0.0.1", "port": 8081, "protocol": "http"},
            {"ip": "127.0.0.1", "port": 3128, "protocol": "http"},
        ]
        for p in default_proxies:
            self.proxies.append(Proxy(**p))

    def add_proxy(self, proxy: Proxy):
        self.proxies.append(proxy)
        logger.info(f"Added proxy: {proxy.ip}:{proxy.port}")

    def add_proxies_from_list(self, proxy_list: List[Dict]):
        for p in proxy_list:
            self.add_proxy(Proxy(**p))

    async def check_proxy(self, proxy: Proxy, timeout: int = 10) -> bool:
        try:
            start = time.time()
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    "http://httpbin.org/ip",
                    proxy=proxy.url,
                    timeout=aiohttp.ClientTimeout(total=timeout)
                ) as response:
                    if response.status == 200:
                        proxy.response_time = time.time() - start
                        proxy.last_check = datetime.now()
                        proxy.success_count += 1
                        proxy.is_active = True
                        return True
        except Exception as e:
            proxy.fail_count += 1
            proxy.is_active = proxy.success_rate > 0.3
            logger.debug(f"Proxy {proxy.ip} check failed: {e}")
        return False

    async def check_all_proxies(self) -> Dict[str, int]:
        tasks = [self.check_proxy(p) for p in self.proxies]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        active = sum(1 for r in results if r is True)
        total = len(self.proxies)
        logger.info(f"Proxy check complete: {active}/{total} active")
        return {"active": active, "total": total, "inactive": total - active}

    async def get_proxy(self, strategy: str = "round_robin") -> Optional[Proxy]:
        async with self.lock:
            active_proxies = [p for p in self.proxies if p.is_active]
            if not active_proxies:
                logger.warning("No active proxies available!")
                return None

            if strategy == "round_robin":
                proxy = active_proxies[self.current_index % len(active_proxies)]
                self.current_index += 1
            elif strategy == "random":
                proxy = random.choice(active_proxies)
            elif strategy == "best":
                proxy = max(active_proxies, key=lambda p: p.success_rate)
            elif strategy == "fastest":
                proxy = min(active_proxies, key=lambda p: p.response_time if p.response_time > 0 else float('inf'))
            else:
                proxy = random.choice(active_proxies)

            proxy.last_used = datetime.now()
            return proxy

    def report_success(self, proxy: Proxy):
        proxy.success_count += 1
        proxy.is_active = True

    def report_failure(self, proxy: Proxy):
        proxy.fail_count += 1
        if proxy.success_rate < 0.2:
            proxy.is_active = False
            logger.warning(f"Proxy {proxy.ip} marked as inactive (success rate: {proxy.success_rate:.2%})")

    def get_stats(self) -> Dict:
        active = sum(1 for p in self.proxies if p.is_active)
        return {
            "total_proxies": len(self.proxies),
            "active_proxies": active,
            "inactive_proxies": len(self.proxies) - active,
            "avg_success_rate": sum(p.success_rate for p in self.proxies) / len(self.proxies) if self.proxies else 0,
            "avg_response_time": sum(p.response_time for p in self.proxies if p.response_time > 0) / active if active > 0 else 0
        }


_proxy_pool_instance: Optional[ProxyPool] = None


def get_proxy_pool(redis_client=None) -> ProxyPool:
    global _proxy_pool_instance
    if _proxy_pool_instance is None:
        _proxy_pool_instance = ProxyPool(redis_client)
    return _proxy_pool_instance

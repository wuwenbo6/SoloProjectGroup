from abc import ABC, abstractmethod
from typing import List, Dict, Optional
from datetime import datetime, timedelta
import uuid
import random
import time
import asyncio
import aiohttp
from ..core.database import get_elasticsearch
from ..core.proxy_pool import get_proxy_pool, Proxy
from ..nlp.processor import NLPProcessor
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class AntiBanStrategy:
    def __init__(self):
        self.request_count = 0
        self.last_request_time = 0
        self.min_delay = 1.0
        self.max_delay = 5.0
        self.consecutive_failures = 0

    def get_random_delay(self) -> float:
        base_delay = random.uniform(self.min_delay, self.max_delay)
        backoff = min(2 ** self.consecutive_failures, 60)
        return base_delay + backoff

    def record_request(self):
        self.request_count += 1
        self.last_request_time = time.time()

    def record_failure(self):
        self.consecutive_failures += 1

    def record_success(self):
        self.consecutive_failures = max(0, self.consecutive_failures - 1)

    def should_rotate_proxy(self) -> bool:
        return self.consecutive_failures >= 3 or self.request_count % 10 == 0


class BaseCrawler(ABC):
    USER_AGENTS = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0",
    ]

    ACCEPT_LANGUAGES = [
        "en-US,en;q=0.9",
        "en-GB,en;q=0.8",
        "zh-CN,zh;q=0.9,en;q=0.8",
        "ja-JP,ja;q=0.9,en;q=0.8",
        "ko-KR,ko;q=0.9,en;q=0.8",
    ]

    def __init__(self, use_proxy: bool = True, max_retries: int = 5):
        self.es = get_elasticsearch()
        self.nlp = NLPProcessor()
        self.proxy_pool = get_proxy_pool()
        self.use_proxy = use_proxy
        self.max_retries = max_retries
        self.anti_ban = AntiBanStrategy()
        self.current_proxy: Optional[Proxy] = None
        self.session: Optional[aiohttp.ClientSession] = None

    def get_headers(self) -> Dict[str, str]:
        return {
            "User-Agent": random.choice(self.USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": random.choice(self.ACCEPT_LANGUAGES),
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Cache-Control": "max-age=0",
            "DNT": "1",
        }

    async def rotate_proxy(self):
        if self.use_proxy:
            self.current_proxy = await self.proxy_pool.get_proxy(strategy="random")
            if self.current_proxy:
                logger.info(f"Rotated to proxy: {self.current_proxy.ip}")
            else:
                logger.warning("No proxy available, using direct connection")

    async def make_request(self, url: str, method: str = "GET", **kwargs) -> Optional[aiohttp.ClientResponse]:
        for attempt in range(self.max_retries):
            if self.anti_ban.should_rotate_proxy() or self.current_proxy is None:
                await self.rotate_proxy()

            delay = self.anti_ban.get_random_delay()
            await asyncio.sleep(delay)

            try:
                proxy = self.current_proxy.url if self.current_proxy and self.use_proxy else None
                headers = kwargs.pop("headers", {})
                headers.update(self.get_headers())

                if not self.session:
                    timeout = aiohttp.ClientTimeout(total=30)
                    self.session = aiohttp.ClientSession(timeout=timeout)

                self.anti_ban.record_request()

                async with self.session.request(
                    method, url, headers=headers, proxy=proxy, **kwargs
                ) as response:
                    if response.status == 200:
                        self.anti_ban.record_success()
                        if self.current_proxy:
                            self.proxy_pool.report_success(self.current_proxy)
                        return response
                    elif response.status in [429, 403, 407]:
                        logger.warning(f"Rate limited/blocked (status {response.status}), rotating proxy...")
                        if self.current_proxy:
                            self.proxy_pool.report_failure(self.current_proxy)
                        self.anti_ban.record_failure()
                        await self.rotate_proxy()
                    else:
                        logger.warning(f"Request failed with status {response.status}")
                        self.anti_ban.record_failure()

            except Exception as e:
                logger.error(f"Request error (attempt {attempt + 1}): {e}")
                if self.current_proxy:
                    self.proxy_pool.report_failure(self.current_proxy)
                self.anti_ban.record_failure()

                if "Connection refused" in str(e) or "Proxy" in str(e):
                    await self.rotate_proxy()

        logger.error(f"Max retries exceeded for {url}")
        return None

    async def close_session(self):
        if self.session:
            await self.session.close()
            self.session = None

    @abstractmethod
    async def fetch_data_async(self, keyword: str, limit: int) -> List[Dict]:
        pass

    async def crawl_async(self, keyword: str, limit: int = 100) -> List[Dict]:
        try:
            raw_posts = await self.fetch_data_async(keyword, limit)
            processed_posts = []

            for post in raw_posts:
                entities = self.nlp.extract_entities(post.get("content", ""))
                sentiment = self.nlp.analyze_sentiment(post.get("content", ""))

                post_id = str(uuid.uuid4())
                doc = {
                    "id": post_id,
                    "platform": self.platform,
                    "content": post.get("content", ""),
                    "author": post.get("author"),
                    "created_at": post.get("created_at", datetime.utcnow()),
                    "url": post.get("url"),
                    "entities": entities,
                    "sentiment_score": sentiment["score"],
                    "sentiment_label": sentiment["label"],
                    "location": post.get("location"),
                    "keywords": [keyword],
                    "raw_data": post,
                    "crawl_timestamp": datetime.utcnow(),
                }

                self.es.index(index="posts", id=post_id, body=doc)
                processed_posts.append(doc)

            return processed_posts
        finally:
            await self.close_session()

    def crawl(self, keyword: str, limit: int = 100) -> List[Dict]:
        return asyncio.run(self.crawl_async(keyword, limit))

    def get_crawler_stats(self) -> Dict:
        proxy_stats = self.proxy_pool.get_stats() if self.proxy_pool else {}
        return {
            "platform": getattr(self, "platform", "unknown"),
            "use_proxy": self.use_proxy,
            "max_retries": self.max_retries,
            "request_count": self.anti_ban.request_count,
            "consecutive_failures": self.anti_ban.consecutive_failures,
            "current_proxy": self.current_proxy.ip if self.current_proxy else None,
            "proxy_stats": proxy_stats,
        }

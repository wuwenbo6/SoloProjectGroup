from fastapi import APIRouter, Depends, HTTPException
from ..core.database import get_elasticsearch
from ..core.proxy_pool import get_proxy_pool
from ..crawlers.twitter import TwitterCrawler
from ..crawlers.reddit import RedditCrawler
from ..crawlers.telegram import TelegramCrawler
from ..schemas.post import CrawlRequest

router = APIRouter()


@router.post("/crawl")
async def crawl_data(request: CrawlRequest, es=Depends(get_elasticsearch)):
    platform = request.platform.lower()

    crawlers = {
        "twitter": TwitterCrawler(use_proxy=True),
        "reddit": RedditCrawler(use_proxy=True),
        "telegram": TelegramCrawler(use_proxy=True)
    }

    if platform not in crawlers:
        raise HTTPException(status_code=400, detail=f"Unsupported platform: {platform}")

    crawler = crawlers[platform]
    posts = await crawler.crawl_async(request.keyword, request.limit)

    sarcastic_count = sum(1 for p in posts if p.get("is_sarcastic", False))

    return {
        "status": "success",
        "crawled_count": len(posts),
        "platform": platform,
        "sarcastic_detected": sarcastic_count
    }


@router.get("/status/{platform}")
async def get_crawler_status(platform: str):
    crawler_classes = {
        "twitter": TwitterCrawler,
        "reddit": RedditCrawler,
        "telegram": TelegramCrawler
    }

    if platform not in crawler_classes:
        raise HTTPException(status_code=400, detail=f"Unsupported platform: {platform}")

    crawler = crawler_classes[platform]()
    stats = crawler.get_crawler_stats()

    return {"platform": platform, "status": "ready", "stats": stats}


@router.get("/proxy/stats")
async def get_proxy_stats():
    proxy_pool = get_proxy_pool()
    return proxy_pool.get_stats()


@router.post("/proxy/check")
async def check_all_proxies():
    proxy_pool = get_proxy_pool()
    results = await proxy_pool.check_all_proxies()
    return results


@router.post("/proxy/add")
async def add_proxy(proxy_config: dict):
    proxy_pool = get_proxy_pool()
    from ..core.proxy_pool import Proxy
    proxy = Proxy(
        ip=proxy_config["ip"],
        port=proxy_config["port"],
        protocol=proxy_config.get("protocol", "http"),
        username=proxy_config.get("username"),
        password=proxy_config.get("password")
    )
    proxy_pool.add_proxy(proxy)
    return {"status": "success", "message": "Proxy added successfully"}

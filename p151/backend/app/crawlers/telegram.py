from typing import List, Dict
from datetime import datetime, timedelta
import random
from .base import BaseCrawler


class TelegramCrawler(BaseCrawler):
    def __init__(self, use_proxy: bool = True):
        super().__init__(use_proxy=use_proxy)
        self.platform = "telegram"

    async def fetch_data_async(self, keyword: str, limit: int) -> List[Dict]:
        posts = []
        channels = ["@tech_news", "@crypto_channel", "@general_discussion", "@news_bot"]
        authors = ["user_a", "user_b", "user_c", "user_d"]
        sentiments = [
            f"Breaking: {keyword} is making headlines!",
            f"Just in: Updates on {keyword}",
            f"Analysis: What {keyword} means for us",
            f"Discussion thread: {keyword}",
            f"Poll: What's your take on {keyword}?",
            f"Important update regarding {keyword}",
            f"Hot take: {keyword} is misunderstood",
            f"Share your thoughts on {keyword}",
            f"{keyword} - The full story",
            f"Expert opinion on {keyword}",
            f"Oh WOW, {keyword} is SO revolutionary. Mind = blown 🤯 /s",
            f"Yeah, {keyword} is totally going to change everything. Sure.",
        ]

        for i in range(limit):
            created_at = datetime.utcnow() - timedelta(hours=random.randint(0, 72))
            posts.append({
                "content": random.choice(sentiments),
                "author": random.choice(authors),
                "created_at": created_at,
                "channel": random.choice(channels),
                "url": f"https://t.me/{random.choice(channels)}/{i}",
                "location": None
            })

        return posts

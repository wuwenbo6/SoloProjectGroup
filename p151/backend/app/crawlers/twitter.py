from typing import List, Dict
from datetime import datetime, timedelta
import random
from .base import BaseCrawler


class TwitterCrawler(BaseCrawler):
    def __init__(self, use_proxy: bool = True):
        super().__init__(use_proxy=use_proxy)
        self.platform = "twitter"

    async def fetch_data_async(self, keyword: str, limit: int) -> List[Dict]:
        posts = []
        authors = ["user1", "user2", "user3", "user4", "user5"]
        sentiments = [
            f"I love {keyword}! It's amazing!",
            f"{keyword} is the worst thing ever.",
            f"Just tried {keyword} for the first time. Interesting...",
            f"Can't stop talking about {keyword}!",
            f"Why does everyone like {keyword}? I don't get it.",
            f"Breaking news: {keyword} is trending!",
            f"My thoughts on {keyword}: it's okay.",
            f"Best day ever with {keyword}!",
            f"Disappointed with {keyword}. Expected better.",
            f"#{keyword} is awesome! Check it out.",
            f"Oh great, another {keyword} post. Just what I needed 🙄",
            f"Yeah right, {keyword} is TOTALLY going to work 😒",
            f"Wow, {keyword} is so great. Can't you tell how excited I am?",
            f"Thanks a lot {keyword}, you really made my day 😒",
            f"I just LOVE when {keyword} breaks everything! Fantastic!",
        ]

        locations = [
            {"lat": 40.7128, "lon": -74.0060},
            {"lat": 34.0522, "lon": -118.2437},
            {"lat": 51.5074, "lon": -0.1278},
            {"lat": 35.6762, "lon": 139.6503},
            None
        ]

        for i in range(limit):
            created_at = datetime.utcnow() - timedelta(hours=random.randint(0, 168))
            posts.append({
                "content": random.choice(sentiments),
                "author": random.choice(authors),
                "created_at": created_at,
                "url": f"https://twitter.com/{random.choice(authors)}/status/{i}",
                "location": random.choice(locations)
            })

        return posts

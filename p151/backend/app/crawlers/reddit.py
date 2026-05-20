from typing import List, Dict
from datetime import datetime, timedelta
import random
from .base import BaseCrawler


class RedditCrawler(BaseCrawler):
    def __init__(self, use_proxy: bool = True):
        super().__init__(use_proxy=use_proxy)
        self.platform = "reddit"

    async def fetch_data_async(self, keyword: str, limit: int) -> List[Dict]:
        posts = []
        subreddits = ["r/technology", "r/news", "r/discussion", "r/general"]
        authors = ["redditor1", "redditor2", "redditor3", "redditor4"]
        sentiments = [
            f"[D] What do you think about {keyword}?",
            f"Let's have a serious discussion about {keyword}.",
            f"ELI5: What is {keyword}?",
            f"TIL about {keyword} and it changed my perspective.",
            f"Unpopular opinion: {keyword} is overrated.",
            f"I work with {keyword} AMA!",
            f"PSA: {keyword} is important and here's why.",
            f"Discussion: The future of {keyword}",
            f"Anyone else obsessed with {keyword}?",
            f"The problem with {keyword} and how to fix it.",
            f"Oh yeah, {keyword} is DEFINITELY going mainstream. Sure...",
            f"Great, another {keyword} post. Exactly what this sub needed 🙄",
            f"Love it when {keyword} works perfectly 100% of the time! /s",
        ]

        for i in range(limit):
            created_at = datetime.utcnow() - timedelta(hours=random.randint(0, 336))
            posts.append({
                "content": random.choice(sentiments),
                "author": random.choice(authors),
                "created_at": created_at,
                "url": f"https://reddit.com/{random.choice(subreddits)}/comments/{i}",
                "subreddit": random.choice(subreddits),
                "location": None
            })

        return posts

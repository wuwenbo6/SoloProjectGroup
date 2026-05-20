from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime


class PostBase(BaseModel):
    platform: str
    content: str
    author: Optional[str] = None
    url: Optional[str] = None
    location: Optional[Dict[str, float]] = None
    raw_data: Optional[Dict] = None


class PostCreate(PostBase):
    created_at: Optional[datetime] = None


class PostResponse(PostBase):
    id: str
    created_at: datetime
    entities: List[str] = []
    sentiment_score: float = 0.0
    sentiment_label: str = "neutral"
    keywords: List[str] = []

    class Config:
        from_attributes = True


class PostSearchResponse(BaseModel):
    total: int
    posts: List[PostResponse]


class CrawlRequest(BaseModel):
    platform: str
    keyword: str
    limit: int = 100

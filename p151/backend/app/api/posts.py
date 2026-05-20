from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from datetime import datetime
from ..core.database import get_elasticsearch, get_redis
from ..nlp.processor import NLPProcessor
from ..schemas.post import PostCreate, PostResponse, PostSearchResponse
import json
import uuid

router = APIRouter()
nlp_processor = NLPProcessor()


@router.post("/", response_model=PostResponse)
async def create_post(post: PostCreate, es=Depends(get_elasticsearch), redis=Depends(get_redis)):
    post_id = str(uuid.uuid4())
    entities = nlp_processor.extract_entities(post.content)
    sentiment = nlp_processor.analyze_sentiment(post.content)

    doc = {
        "id": post_id,
        "platform": post.platform,
        "content": post.content,
        "author": post.author,
        "created_at": post.created_at or datetime.utcnow(),
        "url": post.url,
        "entities": entities,
        "sentiment_score": sentiment["score"],
        "sentiment_label": sentiment["label"],
        "location": post.location,
        "keywords": [],
        "raw_data": post.raw_data or {}
    }

    es.index(index="posts", id=post_id, body=doc)
    redis.delete(f"post:{post_id}")
    return doc


@router.get("/{post_id}", response_model=PostResponse)
async def get_post(post_id: str, es=Depends(get_elasticsearch), redis=Depends(get_redis)):
    cache_key = f"post:{post_id}"
    cached = redis.get(cache_key)
    if cached:
        return json.loads(cached)

    try:
        result = es.get(index="posts", id=post_id)
        post_data = result["_source"]
        redis.setex(cache_key, 3600, json.dumps(post_data))
        return post_data
    except Exception:
        raise HTTPException(status_code=404, detail="Post not found")


@router.get("/", response_model=PostSearchResponse)
async def search_posts(
    keyword: Optional[str] = None,
    platform: Optional[str] = None,
    sentiment: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    es=Depends(get_elasticsearch)
):
    query = {"bool": {"must": []}}

    if keyword:
        query["bool"]["must"].append({
            "multi_match": {
                "query": keyword,
                "fields": ["content", "entities"]
            }
        })

    if platform:
        query["bool"]["must"].append({"term": {"platform": platform}})

    if sentiment:
        query["bool"]["must"].append({"term": {"sentiment_label": sentiment}})

    if start_date or end_date:
        date_range = {}
        if start_date:
            date_range["gte"] = start_date
        if end_date:
            date_range["lte"] = end_date
        query["bool"]["must"].append({"range": {"created_at": date_range}})

    if not query["bool"]["must"]:
        query = {"match_all": {}}

    result = es.search(
        index="posts",
        query=query,
        sort=[{"created_at": {"order": "desc"}}],
        from_=(page - 1) * size,
        size=size
    )

    posts = [hit["_source"] for hit in result["hits"]["hits"]]
    total = result["hits"]["total"]["value"]

    return {"total": total, "posts": posts}

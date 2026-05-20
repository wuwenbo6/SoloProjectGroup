from fastapi import APIRouter, Depends, Query
from typing import Optional
from datetime import datetime, timedelta
from collections import Counter
from ..core.database import get_elasticsearch, get_redis
import json

router = APIRouter()


@router.get("/trends")
async def get_trends(
    keyword: Optional[str] = None,
    platform: Optional[str] = None,
    days: int = Query(7, ge=1, le=365),
    es=Depends(get_elasticsearch),
    redis=Depends(get_redis)
):
    cache_key = f"trends:{keyword}:{platform}:{days}"
    cached = redis.get(cache_key)
    if cached:
        return json.loads(cached)

    start_date = datetime.utcnow() - timedelta(days=days)

    query = {
        "bool": {
            "must": [
                {"range": {"created_at": {"gte": start_date}}}
            ]
        }
    }

    if keyword:
        query["bool"]["must"].append({
            "multi_match": {
                "query": keyword,
                "fields": ["content", "entities"]
            }
        })

    if platform:
        query["bool"]["must"].append({"term": {"platform": platform}})

    aggs = {
        "by_date": {
            "date_histogram": {
                "field": "created_at",
                "calendar_interval": "day"
            },
            "aggs": {
                "avg_sentiment": {"avg": {"field": "sentiment_score"}},
                "count": {"value_count": {"field": "id"}}
            }
        },
        "by_platform": {
            "terms": {"field": "platform"}
        },
        "sentiment_distribution": {
            "terms": {"field": "sentiment_label"}
        }
    }

    result = es.search(index="posts", query=query, aggs=aggs, size=0)

    trends_data = {
        "time_series": [
            {
                "date": bucket["key_as_string"],
                "count": bucket["count"]["value"],
                "avg_sentiment": bucket["avg_sentiment"]["value"] or 0
            }
            for bucket in result["aggregations"]["by_date"]["buckets"]
        ],
        "platform_distribution": [
            {"platform": bucket["key"], "count": bucket["doc_count"]}
            for bucket in result["aggregations"]["by_platform"]["buckets"]
        ],
        "sentiment_distribution": [
            {"sentiment": bucket["key"], "count": bucket["doc_count"]}
            for bucket in result["aggregations"]["sentiment_distribution"]["buckets"]
        ]
    }

    redis.setex(cache_key, 300, json.dumps(trends_data))
    return trends_data


@router.get("/wordcloud")
async def get_wordcloud(
    keyword: Optional[str] = None,
    platform: Optional[str] = None,
    days: int = Query(7, ge=1),
    es=Depends(get_elasticsearch)
):
    start_date = datetime.utcnow() - timedelta(days=days)

    query = {
        "bool": {
            "must": [
                {"range": {"created_at": {"gte": start_date}}}
            ]
        }
    }

    if keyword:
        query["bool"]["must"].append({
            "multi_match": {
                "query": keyword,
                "fields": ["content", "entities"]
            }
        })

    if platform:
        query["bool"]["must"].append({"term": {"platform": platform}})

    result = es.search(
        index="posts",
        query=query,
        _source=["entities", "content"],
        size=1000
    )

    all_entities = []
    for hit in result["hits"]["hits"]:
        entities = hit["_source"].get("entities", [])
        all_entities.extend(entities)

    word_counts = Counter(all_entities)
    wordcloud_data = [{"word": word, "count": count} for word, count in word_counts.most_common(100)]

    return {"wordcloud": wordcloud_data}


@router.get("/geography")
async def get_geography(
    keyword: Optional[str] = None,
    days: int = Query(30, ge=1),
    es=Depends(get_elasticsearch)
):
    start_date = datetime.utcnow() - timedelta(days=days)

    query = {
        "bool": {
            "must": [
                {"range": {"created_at": {"gte": start_date}}},
                {"exists": {"field": "location"}}
            ]
        }
    }

    if keyword:
        query["bool"]["must"].append({
            "multi_match": {
                "query": keyword,
                "fields": ["content", "entities"]
            }
        })

    result = es.search(
        index="posts",
        query=query,
        _source=["location", "sentiment_score", "platform"],
        size=1000
    )

    locations = []
    for hit in result["hits"]["hits"]:
        loc = hit["_source"].get("location")
        if loc:
            locations.append({
                "lat": loc.get("lat"),
                "lon": loc.get("lon"),
                "sentiment": hit["_source"].get("sentiment_score"),
                "platform": hit["_source"].get("platform")
            })

    return {"locations": locations}

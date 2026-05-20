import redis
from elasticsearch import Elasticsearch
from .config import settings


class RedisClient:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = redis.from_url(settings.REDIS_URL)
        return cls._instance


class ElasticsearchClient:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = Elasticsearch(settings.ELASTICSEARCH_URL)
        return cls._instance


def get_redis():
    return RedisClient()


def get_elasticsearch():
    return ElasticsearchClient()


def init_indices(es: Elasticsearch):
    posts_index = {
        "mappings": {
            "properties": {
                "id": {"type": "keyword"},
                "platform": {"type": "keyword"},
                "content": {"type": "text", "analyzer": "standard"},
                "author": {"type": "keyword"},
                "created_at": {"type": "date"},
                "url": {"type": "keyword"},
                "entities": {"type": "keyword"},
                "sentiment_score": {"type": "float"},
                "sentiment_label": {"type": "keyword"},
                "location": {"type": "geo_point"},
                "keywords": {"type": "keyword"},
                "raw_data": {"type": "object"}
            }
        }
    }

    keywords_index = {
        "mappings": {
            "properties": {
                "keyword": {"type": "keyword"},
                "user_id": {"type": "keyword"},
                "created_at": {"type": "date"},
                "alert_threshold": {"type": "float"},
                "is_active": {"type": "boolean"}
            }
        }
    }

    alerts_index = {
        "mappings": {
            "properties": {
                "keyword": {"type": "keyword"},
                "user_id": {"type": "keyword"},
                "message": {"type": "text"},
                "created_at": {"type": "date"},
                "is_read": {"type": "boolean"}
            }
        }
    }

    if not es.indices.exists(index="posts"):
        es.indices.create(index="posts", body=posts_index)

    if not es.indices.exists(index="keywords"):
        es.indices.create(index="keywords", body=keywords_index)

    if not es.indices.exists(index="alerts"):
        es.indices.create(index="alerts", body=alerts_index)

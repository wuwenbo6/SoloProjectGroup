from fastapi import APIRouter, Depends, HTTPException
from typing import List
from datetime import datetime
import uuid
from ..core.database import get_elasticsearch
from ..schemas.alert import KeywordMonitor, AlertResponse

router = APIRouter()


@router.post("/keywords")
async def add_keyword_monitor(monitor: KeywordMonitor, es=Depends(get_elasticsearch)):
    doc = monitor.model_dump()
    doc["created_at"] = datetime.utcnow()

    result = es.search(
        index="keywords",
        query={
            "bool": {
                "must": [
                    {"term": {"keyword": monitor.keyword}},
                    {"term": {"user_id": monitor.user_id}}
                ]
            }
        }
    )

    if result["hits"]["total"]["value"] > 0:
        raise HTTPException(status_code=400, detail="Keyword already monitored")

    keyword_id = str(uuid.uuid4())
    es.index(index="keywords", id=keyword_id, body=doc)

    return {"status": "success", "keyword_id": keyword_id}


@router.get("/keywords/{user_id}")
async def get_user_keywords(user_id: str, es=Depends(get_elasticsearch)):
    result = es.search(
        index="keywords",
        query={"term": {"user_id": user_id}},
        sort=[{"created_at": {"order": "desc"}}]
    )

    keywords = [
        {"id": hit["_id"], **hit["_source"]}
        for hit in result["hits"]["hits"]
    ]

    return {"keywords": keywords}


@router.delete("/keywords/{keyword_id}")
async def delete_keyword(keyword_id: str, es=Depends(get_elasticsearch)):
    try:
        es.delete(index="keywords", id=keyword_id)
        return {"status": "success"}
    except Exception:
        raise HTTPException(status_code=404, detail="Keyword not found")


@router.get("/{user_id}", response_model=List[AlertResponse])
async def get_alerts(user_id: str, es=Depends(get_elasticsearch), unread_only: bool = False):
    query = {"term": {"user_id": user_id}}
    if unread_only:
        query = {"bool": {"must": [
            {"term": {"user_id": user_id}},
            {"term": {"is_read": False}}
        ]}}

    result = es.search(
        index="alerts",
        query=query,
        sort=[{"created_at": {"order": "desc"}}],
        size=100
    )

    alerts = [
        AlertResponse(id=hit["_id"], **hit["_source"])
        for hit in result["hits"]["hits"]
    ]

    return alerts


@router.put("/{alert_id}/read")
async def mark_alert_read(alert_id: str, es=Depends(get_elasticsearch)):
    try:
        es.update(
            index="alerts",
            id=alert_id,
            body={"doc": {"is_read": True}}
        )
        return {"status": "success"}
    except Exception:
        raise HTTPException(status_code=404, detail="Alert not found")

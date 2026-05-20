from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from pydantic import BaseModel

from app.database import get_db
from app.auth import get_current_user, is_manager_or_above
from app.models import User, AudioSample, ClusterStatus
from app.clustering.async_cluster import cluster_manager


router = APIRouter(prefix="/api/v1/clustering", tags=["clustering"])


class ClusterRequest(BaseModel):
    sample_ids: Optional[List[int]] = None
    auto_select: bool = False
    auto_select_limit: int = 100


@router.post("/start")
async def start_clustering(
    request: ClusterRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(is_manager_or_above)
):
    sample_ids = request.sample_ids or []
    
    if request.auto_select:
        sample_ids = await cluster_manager.get_pending_samples(db, request.auto_select_limit)
    
    if not sample_ids:
        return {
            "success": False,
            "message": "没有待聚类的样本"
        }
    
    task_id = cluster_manager.create_task(sample_ids)
    result = await cluster_manager.submit_task(task_id, db)
    
    return {
        **result,
        "sample_count": len(sample_ids)
    }


@router.get("/task/{task_id}")
async def get_task_status(
    task_id: str,
    current_user: User = Depends(get_current_user)
):
    status = cluster_manager.get_task_status(task_id)
    if not status:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    return status


@router.get("/tasks")
async def list_all_tasks(
    current_user: User = Depends(is_manager_or_above)
):
    return {
        "tasks": cluster_manager.get_all_tasks(),
        "active_count": len(cluster_manager.active_tasks),
        "max_workers": cluster_manager.max_workers
    }


@router.get("/stats")
async def get_clustering_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    status_counts = {}
    for status in [ClusterStatus.PENDING, ClusterStatus.PROCESSING, 
                   ClusterStatus.COMPLETED, ClusterStatus.FAILED]:
        count = await db.scalar(
            select(func.count(AudioSample.id))
            .where(AudioSample.cluster_status == status)
        )
        status_counts[status] = count or 0
    
    with_feature = await db.scalar(
        select(func.count(AudioSample.id))
        .where(AudioSample.feature_vector.isnot(None))
    )
    
    without_feature = await db.scalar(
        select(func.count(AudioSample.id))
        .where(AudioSample.feature_vector.is_(None))
    )
    
    return {
        "status_distribution": {
            "pending": status_counts[ClusterStatus.PENDING],
            "processing": status_counts[ClusterStatus.PROCESSING],
            "completed": status_counts[ClusterStatus.COMPLETED],
            "failed": status_counts[ClusterStatus.FAILED]
        },
        "feature_vector_stats": {
            "with_feature": with_feature or 0,
            "without_feature": without_feature or 0
        },
        "active_tasks": len(cluster_manager.active_tasks),
        "max_workers": cluster_manager.max_workers
    }


@router.post("/batch/start")
async def start_batch_clustering(
    batch_size: int = 200,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(is_manager_or_above)
):
    pending_samples = await cluster_manager.get_pending_samples(db, batch_size)
    
    if not pending_samples:
        return {
            "success": False,
            "message": "没有待聚类的样本"
        }
    
    tasks_started = []
    for i in range(0, len(pending_samples), cluster_manager.batch_size):
        batch = pending_samples[i:i + cluster_manager.batch_size]
        if batch:
            task_id = cluster_manager.create_task(batch)
            result = await cluster_manager.submit_task(task_id, db)
            if result["success"]:
                tasks_started.append({
                    "task_id": task_id,
                    "sample_count": len(batch)
                })
    
    return {
        "success": True,
        "tasks_started": tasks_started,
        "total_tasks": len(tasks_started),
        "total_samples": len(pending_samples)
    }


@router.get("/pending-samples")
async def get_pending_samples(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(AudioSample)
        .where(AudioSample.cluster_status == ClusterStatus.PENDING)
        .where(AudioSample.feature_vector.isnot(None))
        .order_by(AudioSample.uploaded_at.desc())
        .offset(skip)
        .limit(limit)
    )
    samples = result.scalars().all()
    
    return [
        {
            "id": s.id,
            "filename": s.filename,
            "dialect_category_id": s.dialect_category_id,
            "uploaded_at": s.uploaded_at
        }
        for s in samples
    ]


@router.post("/reset-samples")
async def reset_clustering_status(
    sample_ids: List[int],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(is_manager_or_above)
):
    from sqlalchemy import update
    
    await db.execute(
        update(AudioSample)
        .where(AudioSample.id.in_(sample_ids))
        .values(
            cluster_status=ClusterStatus.PENDING,
            cluster_id=None,
            cluster_task_id=None
        )
    )
    await db.commit()
    
    return {
        "success": True,
        "reset_count": len(sample_ids),
        "message": f"已重置 {len(sample_ids)} 个样本的聚类状态"
    }

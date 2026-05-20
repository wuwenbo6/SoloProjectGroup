from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from datetime import datetime
from ..core.database import get_db
from ..core.security import get_current_active_user, require_role
from ..models import User, UserRole, AnnotationTask, TaskStatus, AudioSample, Annotation, AnnotationStatus
from ..schemas import (
    AnnotationTaskCreate,
    AnnotationTaskResponse,
    TaskClaimRequest,
    TaskReleaseRequest
)

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.post("/", response_model=AnnotationTaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    task_in: AnnotationTaskCreate,
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db)
):
    audio_sample = await db.get(AudioSample, task_in.audio_sample_id)
    if not audio_sample:
        raise HTTPException(status_code=404, detail="Audio sample not found")
    
    task = AnnotationTask(
        **task_in.model_dump(),
        status=TaskStatus.PENDING
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


@router.get("/", response_model=List[AnnotationTaskResponse])
async def get_tasks(
    skip: int = 0,
    limit: int = 100,
    status: Optional[TaskStatus] = None,
    region: Optional[str] = None,
    my_tasks: bool = False,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(AnnotationTask)
    
    if status:
        query = query.where(AnnotationTask.status == status)
    if region:
        query = query.where(AnnotationTask.region.like(f"%{region}%"))
    if my_tasks:
        query = query.where(AnnotationTask.annotator_id == current_user.id)
    
    query = query.offset(skip).limit(limit).order_by(AnnotationTask.priority.desc())
    result = await db.execute(query)
    tasks = result.scalars().all()
    return tasks


@router.get("/available", response_model=List[AnnotationTaskResponse])
async def get_available_tasks(
    skip: int = 0,
    limit: int = 100,
    region: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(AnnotationTask).where(AnnotationTask.status == TaskStatus.PENDING)
    
    if region:
        query = query.where(
            (AnnotationTask.region.like(f"%{region}%")) |
            (AnnotationTask.region.is_(None))
        )
    elif current_user.region:
        query = query.where(
            (AnnotationTask.region.like(f"%{current_user.region}%")) |
            (AnnotationTask.region.is_(None))
        )
    
    query = query.offset(skip).limit(limit).order_by(AnnotationTask.priority.desc())
    result = await db.execute(query)
    tasks = result.scalars().all()
    return tasks


@router.get("/{task_id}", response_model=AnnotationTaskResponse)
async def get_task(
    task_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    task = await db.get(AnnotationTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.post("/claim", response_model=AnnotationTaskResponse)
async def claim_task(
    claim_in: TaskClaimRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    task = await db.get(AnnotationTask, claim_in.task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task.status != TaskStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Task is not available for claiming (current status: {task.status})"
        )
    
    active_tasks = await db.execute(
        select(func.count(AnnotationTask.id)).where(
            AnnotationTask.annotator_id == current_user.id,
            AnnotationTask.status.in_([TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS])
        )
    )
    active_count = active_tasks.scalar_one()
    
    if active_count >= 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have too many active tasks. Please complete some first."
        )
    
    task.annotator_id = current_user.id
    task.status = TaskStatus.ASSIGNED
    task.assigned_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(task)
    return task


@router.post("/release", response_model=AnnotationTaskResponse)
async def release_task(
    release_in: TaskReleaseRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    task = await db.get(AnnotationTask, release_in.task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task.annotator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only release tasks that you have claimed"
        )
    
    task.annotator_id = None
    task.status = TaskStatus.PENDING
    task.assigned_at = None
    task.started_at = None
    
    await db.commit()
    await db.refresh(task)
    return task


@router.post("/{task_id}/start", response_model=AnnotationTaskResponse)
async def start_task(
    task_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    task = await db.get(AnnotationTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task.annotator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only start tasks assigned to you"
        )
    
    if task.status != TaskStatus.ASSIGNED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot start task in {task.status} status"
        )
    
    task.status = TaskStatus.IN_PROGRESS
    task.started_at = datetime.utcnow()
    
    audio_sample = await db.get(AudioSample, task.audio_sample_id)
    if audio_sample:
        audio_sample.annotation_status = AnnotationStatus.ANNOTATING
    
    await db.commit()
    await db.refresh(task)
    return task


@router.put("/{task_id}", response_model=AnnotationTaskResponse)
async def update_task(
    task_id: int,
    task_in: AnnotationTaskCreate,
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db)
):
    task = await db.get(AnnotationTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    update_data = task_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(task, field, value)
    
    await db.commit()
    await db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: int,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    task = await db.get(AnnotationTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    await db.delete(task)
    await db.commit()
    return None

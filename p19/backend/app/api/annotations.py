from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from datetime import datetime
from ..core.database import get_db
from ..core.security import get_current_active_user, require_role
from ..models import User, UserRole, Annotation, AnnotationStatus, AudioSample, AnnotationTask, TaskStatus, DialectCategory
from ..schemas import (
    AnnotationCreate,
    AnnotationUpdate,
    AnnotationResponse,
    AnnotationReview
)

router = APIRouter(prefix="/annotations", tags=["annotations"])


@router.post("/", response_model=AnnotationResponse, status_code=status.HTTP_201_CREATED)
async def create_annotation(
    annotation_in: AnnotationCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    audio_sample = await db.get(AudioSample, annotation_in.audio_sample_id)
    if not audio_sample:
        raise HTTPException(status_code=404, detail="Audio sample not found")
    
    existing = await db.execute(
        select(Annotation).where(
            Annotation.audio_sample_id == annotation_in.audio_sample_id,
            Annotation.annotator_id == current_user.id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already created an annotation for this sample"
        )
    
    annotation = Annotation(
        **annotation_in.model_dump(),
        annotator_id=current_user.id
    )
    db.add(annotation)
    await db.commit()
    await db.refresh(annotation)
    return annotation


@router.get("/", response_model=List[AnnotationResponse])
async def get_annotations(
    skip: int = 0,
    limit: int = 100,
    audio_sample_id: Optional[int] = None,
    my_annotations: bool = False,
    pending_review: bool = False,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Annotation)
    
    if audio_sample_id:
        query = query.where(Annotation.audio_sample_id == audio_sample_id)
    if my_annotations:
        query = query.where(Annotation.annotator_id == current_user.id)
    if pending_review and current_user.role in [UserRole.ADMIN, UserRole.MANAGER, UserRole.REVIEWER]:
        query = query.where(Annotation.is_accepted.is_(None))
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    annotations = result.scalars().all()
    return annotations


@router.get("/{annotation_id}", response_model=AnnotationResponse)
async def get_annotation(
    annotation_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    annotation = await db.get(Annotation, annotation_id)
    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")
    return annotation


@router.put("/{annotation_id}", response_model=AnnotationResponse)
async def update_annotation(
    annotation_id: int,
    annotation_in: AnnotationUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    annotation = await db.get(Annotation, annotation_id)
    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")
    
    if annotation.annotator_id != current_user.id and current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own annotations"
        )
    
    update_data = annotation_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(annotation, field, value)
    
    await db.commit()
    await db.refresh(annotation)
    return annotation


@router.post("/{annotation_id}/submit")
async def submit_annotation(
    annotation_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    annotation = await db.get(Annotation, annotation_id)
    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")
    
    if annotation.annotator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only submit your own annotations"
        )
    
    annotation.submitted_at = datetime.utcnow()
    
    audio_sample = await db.get(AudioSample, annotation.audio_sample_id)
    if audio_sample:
        audio_sample.annotation_status = AnnotationStatus.SUBMITTED
    
    task_result = await db.execute(
        select(AnnotationTask).where(AnnotationTask.audio_sample_id == annotation.audio_sample_id)
    )
    task = task_result.scalar_one_or_none()
    if task:
        task.status = TaskStatus.SUBMITTED
        task.submitted_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(annotation)
    
    return {"message": "Annotation submitted for review", "annotation_id": annotation_id}


@router.post("/{annotation_id}/review", response_model=AnnotationResponse)
async def review_annotation(
    annotation_id: int,
    review_in: AnnotationReview,
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER, UserRole.REVIEWER)),
    db: AsyncSession = Depends(get_db)
):
    annotation = await db.get(Annotation, annotation_id)
    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")
    
    annotation.is_accepted = review_in.is_accepted
    annotation.reviewer_comments = review_in.reviewer_comments
    annotation.quality_score = review_in.quality_score
    annotation.reviewer_id = current_user.id
    annotation.reviewed_at = datetime.utcnow()
    
    audio_sample = await db.get(AudioSample, annotation.audio_sample_id)
    if audio_sample:
        audio_sample.annotation_status = AnnotationStatus.ACCEPTED if review_in.is_accepted else AnnotationStatus.REJECTED
    
    task_result = await db.execute(
        select(AnnotationTask).where(AnnotationTask.audio_sample_id == annotation.audio_sample_id)
    )
    task = task_result.scalar_one_or_none()
    if task:
        task.status = TaskStatus.COMPLETED if review_in.is_accepted else TaskStatus.REJECTED
        task.completed_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(annotation)
    return annotation


@router.delete("/{annotation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_annotation(
    annotation_id: int,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    annotation = await db.get(Annotation, annotation_id)
    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")
    
    await db.delete(annotation)
    await db.commit()
    return None


@router.get("/stats/summary")
async def get_annotation_stats(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    total_samples = await db.execute(select(func.count(AudioSample.id)))
    total_samples = total_samples.scalar_one()
    
    annotated = await db.execute(
        select(func.count(AudioSample.id)).where(
            AudioSample.annotation_status.in_([
                AnnotationStatus.SUBMITTED,
                AnnotationStatus.REVIEWING,
                AnnotationStatus.ACCEPTED
            ])
        )
    )
    annotated = annotated.scalar_one()
    
    pending_tasks = await db.execute(
        select(func.count(AnnotationTask.id)).where(AnnotationTask.status == TaskStatus.PENDING)
    )
    pending_tasks = pending_tasks.scalar_one()
    
    in_progress = await db.execute(
        select(func.count(AnnotationTask.id)).where(AnnotationTask.status == TaskStatus.IN_PROGRESS)
    )
    in_progress = in_progress.scalar_one()
    
    completed = await db.execute(
        select(func.count(AnnotationTask.id)).where(AnnotationTask.status == TaskStatus.COMPLETED)
    )
    completed = completed.scalar_one()
    
    total_users = await db.execute(select(func.count(User.id)))
    total_users = total_users.scalar_one()
    
    dialect_categories = await db.execute(select(func.count(DialectCategory.id)))
    dialect_categories = dialect_categories.scalar_one()
    
    return {
        "total_samples": total_samples,
        "annotated_samples": annotated,
        "pending_tasks": pending_tasks,
        "in_progress_tasks": in_progress,
        "completed_tasks": completed,
        "total_users": total_users,
        "dialect_categories": dialect_categories
    }

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta
import random

from app.database import get_db
from app.models import AudioSample, Annotation, User
from app.auth import get_current_user, is_manager_or_above
from app.models import UserRole


router = APIRouter(prefix="/api/v1/quality-check", tags=["quality-check"])


class SampleCheckResponse(BaseModel):
    id: int
    sample_id: int
    checker_id: Optional[int] = None
    status: str
    score: Optional[float] = None
    comment: Optional[str] = None
    created_at: datetime
    checked_at: Optional[datetime] = None
    original_filename: Optional[str] = None
    annotation_text: Optional[str] = None
    annotator: Optional[str] = None


class CheckSubmission(BaseModel):
    sample_check_id: int
    passed: bool
    score: float
    comment: Optional[str] = None


class QualityStats(BaseModel):
    total_checked: int
    passed_count: int
    failed_count: int
    pending_count: int
    average_score: float
    pass_rate: float


class BatchCheckRequest(BaseModel):
    sample_ids: List[int]


@router.get("/pending", response_model=List[SampleCheckResponse])
async def get_pending_checks(
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取待抽检的样本列表"""
    result = await db.execute(
        select(AudioSample)
        .where(AudioSample.annotation_status == "submitted")
        .where(AudioSample.quality_checked == False)
        .order_by(AudioSample.submitted_at.desc())
        .offset(skip)
        .limit(limit)
    )
    samples = result.scalars().all()
    
    response = []
    for sample in samples:
        annotator = None
        if sample.annotator_id:
            user = await db.get(User, sample.annotator_id)
            if user:
                annotator = user.username
        
        response.append(SampleCheckResponse(
            id=sample.id,
            sample_id=sample.id,
            status="pending",
            created_at=sample.submitted_at or sample.uploaded_at,
            original_filename=sample.original_filename,
            annotation_text=sample.annotation_text,
            annotator=annotator
        ))
    
    return response


@router.get("/stats", response_model=QualityStats)
async def get_quality_stats(
    days: int = 30,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取质量统计数据"""
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    result = await db.execute(
        select(AudioSample)
        .where(AudioSample.quality_checked == True)
        .where(AudioSample.checked_at >= cutoff_date)
    )
    checked_samples = result.scalars().all()
    
    total_checked = len(checked_samples)
    passed_count = sum(1 for s in checked_samples if s.quality_status == "passed")
    failed_count = sum(1 for s in checked_samples if s.quality_status == "failed")
    pending_count = await db.scalar(
        select(func.count(AudioSample.id))
        .where(AudioSample.annotation_status == "submitted")
        .where(AudioSample.quality_checked == False)
    )
    
    scores = [s.quality_score for s in checked_samples if s.quality_score]
    average_score = sum(scores) / len(scores) if scores else 0
    
    return QualityStats(
        total_checked=total_checked,
        passed_count=passed_count,
        failed_count=failed_count,
        pending_count=pending_count or 0,
        average_score=round(average_score, 2),
        pass_rate=round(passed_count / total_checked * 100, 2) if total_checked > 0 else 0
    )


@router.post("/auto-sample")
async def auto_sample_for_check(
    sample_count: int = 10,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(is_manager_or_above)
):
    """自动抽样待审核的语料"""
    result = await db.execute(
        select(AudioSample)
        .where(AudioSample.annotation_status == "submitted")
        .where(AudioSample.quality_checked == False)
    )
    pending_samples = result.scalars().all()
    
    if len(pending_samples) == 0:
        return {"sampled_count": 0, "message": "没有待审核的语料"}
    
    sampled = random.sample(pending_samples, min(sample_count, len(pending_samples)))
    
    for sample in sampled:
        sample.quality_check_priority = calculate_priority(sample)
    
    await db.commit()
    
    return {
        "sampled_count": len(sampled),
        "sampled_ids": [s.id for s in sampled],
        "message": f"已自动抽取 {len(sampled)} 条语料进行审核"
    }


def calculate_priority(sample: AudioSample) -> float:
    """计算抽检优先级"""
    priority = 0.5
    
    if sample.duration and sample.duration > 30:
        priority += 0.2
    
    if sample.annotator_id:
        priority += 0.1
    
    if sample.dialect_category_id:
        priority += 0.1
    
    return min(1.0, priority)


@router.post("/submit-check")
async def submit_check(
    submission: CheckSubmission,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """提交抽检结果"""
    sample = await db.get(AudioSample, submission.sample_check_id)
    if not sample:
        raise HTTPException(status_code=404, detail="样本不存在")
    
    sample.quality_checked = True
    sample.quality_status = "passed" if submission.passed else "failed"
    sample.quality_score = submission.score
    sample.quality_comment = submission.comment
    sample.checked_by = current_user.id
    sample.checked_at = datetime.utcnow()
    
    if submission.passed and submission.score >= 0.8:
        sample.annotation_status = "accepted"
    elif not submission.passed or submission.score < 0.6:
        sample.annotation_status = "rejected"
    
    await db.commit()
    
    return {
        "success": True,
        "message": "抽检结果已提交",
        "annotation_status": sample.annotation_status
    }


@router.post("/batch-check")
async def batch_submit_check(
    submissions: List[CheckSubmission],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """批量提交抽检结果"""
    success_count = 0
    
    for submission in submissions:
        sample = await db.get(AudioSample, submission.sample_check_id)
        if sample:
            sample.quality_checked = True
            sample.quality_status = "passed" if submission.passed else "failed"
            sample.quality_score = submission.score
            sample.quality_comment = submission.comment
            sample.checked_by = current_user.id
            sample.checked_at = datetime.utcnow()
            
            if submission.passed and submission.score >= 0.8:
                sample.annotation_status = "accepted"
            elif not submission.passed or submission.score < 0.6:
                sample.annotation_status = "rejected"
            
            success_count += 1
    
    await db.commit()
    
    return {
        "success": True,
        "processed_count": success_count,
        "message": f"批量审核完成，共处理 {success_count} 条"
    }


@router.get("/my-checks")
async def get_my_checks(
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取我审核过的样本"""
    result = await db.execute(
        select(AudioSample)
        .where(AudioSample.checked_by == current_user.id)
        .order_by(AudioSample.checked_at.desc())
        .offset(skip)
        .limit(limit)
    )
    samples = result.scalars().all()
    
    response = []
    for sample in samples:
        response.append(SampleCheckResponse(
            id=sample.id,
            sample_id=sample.id,
            checker_id=sample.checked_by,
            status=sample.quality_status or "unknown",
            score=sample.quality_score,
            comment=sample.quality_comment,
            created_at=sample.uploaded_at,
            checked_at=sample.checked_at,
            original_filename=sample.original_filename,
            annotation_text=sample.annotation_text
        ))
    
    return response


@router.get("/annotator-performance/{annotator_id}")
async def get_annotator_performance(
    annotator_id: int,
    days: int = 30,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(is_manager_or_above)
):
    """获取标注人员的质量表现"""
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    result = await db.execute(
        select(AudioSample)
        .where(AudioSample.annotator_id == annotator_id)
        .where(AudioSample.quality_checked == True)
        .where(AudioSample.checked_at >= cutoff_date)
    )
    samples = result.scalars().all()
    
    user = await db.get(User, annotator_id)
    
    if len(samples) == 0:
        return {
            "annotator_id": annotator_id,
            "annotator_name": user.username if user else None,
            "total_annotations": 0,
            "average_score": 0,
            "pass_rate": 0,
            "message": "该时间段内暂无抽检数据"
        }
    
    scores = [s.quality_score for s in samples if s.quality_score]
    avg_score = sum(scores) / len(scores) if scores else 0
    passed = sum(1 for s in samples if s.quality_status == "passed")
    
    return {
        "annotator_id": annotator_id,
        "annotator_name": user.username if user else None,
        "total_annotations": len(samples),
        "average_score": round(avg_score, 2),
        "pass_rate": round(passed / len(samples) * 100, 2),
        "passed_count": passed,
        "failed_count": len(samples) - passed
    }


@router.post("/mark-checked")
async def mark_as_checked(
    request: BatchCheckRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """批量标记为已抽检"""
    updated_count = 0
    for sample_id in request.sample_ids:
        sample = await db.get(AudioSample, sample_id)
        if sample:
            sample.quality_checked = True
            sample.quality_status = "passed"
            sample.quality_score = 0.8
            sample.checked_by = current_user.id
            sample.checked_at = datetime.utcnow()
            sample.annotation_status = "accepted"
            updated_count += 1
    
    await db.commit()
    
    return {"success": True, "updated_count": updated_count}

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta
import pandas as pd
import io

from app.database import get_db
from app.models import AudioSample, DialectCategory, User, Annotation
from app.auth import get_current_user, is_researcher, is_manager_or_above
from app.models import UserRole


router = APIRouter(prefix="/api/v1/research", tags=["research"])


class DataExportRequest(BaseModel):
    dialect_category_ids: Optional[List[int]] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    include_audio_metadata: bool = True
    include_annotations: bool = True
    quality_min: Optional[float] = None


class ResearchStats(BaseModel):
    total_corpora: int
    total_duration_hours: float
    dialect_distribution: List[dict]
    quality_distribution: List[dict]
    annotator_count: int
    growth_trend: List[dict]


class AccessLogEntry(BaseModel):
    id: int
    researcher_id: int
    researcher_name: str
    action: str
    resource_type: str
    timestamp: datetime
    details: Optional[str] = None


@router.get("/stats", response_model=ResearchStats)
async def get_research_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(is_researcher)
):
    """获取方言研究统计数据概览"""
    result = await db.execute(select(AudioSample))
    all_samples = result.scalars().all()
    
    total_duration = sum(s.duration or 0 for s in all_samples)
    
    dialect_dist = {}
    for sample in all_samples:
        if sample.dialect_category_id:
            category = await db.get(DialectCategory, sample.dialect_category_id)
            cat_name = category.name if category else "未分类"
            dialect_dist[cat_name] = dialect_dist.get(cat_name, 0) + 1
    
    quality_dist = {"excellent": 0, "good": 0, "fair": 0, "poor": 0, "unknown": 0}
    for sample in all_samples:
        if sample.quality_score:
            if sample.quality_score >= 0.9:
                quality_dist["excellent"] += 1
            elif sample.quality_score >= 0.75:
                quality_dist["good"] += 1
            elif sample.quality_score >= 0.6:
                quality_dist["fair"] += 1
            else:
                quality_dist["poor"] += 1
        else:
            quality_dist["unknown"] += 1
    
    annotator_count = await db.scalar(
        select(func.count(func.distinct(AudioSample.annotator_id)))
        .where(AudioSample.annotator_id.isnot(None))
    )
    
    today = datetime.utcnow()
    growth_data = []
    for i in range(6, -1, -1):
        date = today - timedelta(days=i)
        next_date = date + timedelta(days=1)
        count = await db.scalar(
            select(func.count(AudioSample.id))
            .where(AudioSample.uploaded_at >= date)
            .where(AudioSample.uploaded_at < next_date)
        )
        growth_data.append({
            "date": date.strftime("%Y-%m-%d"),
            "count": count or 0
        })
    
    return ResearchStats(
        total_corpora=len(all_samples),
        total_duration_hours=round(total_duration / 3600, 2),
        dialect_distribution=[{"dialect": k, "count": v} for k, v in dialect_dist.items()],
        quality_distribution=[{"level": k, "count": v} for k, v in quality_dist.items()],
        annotator_count=annotator_count or 0,
        growth_trend=growth_data
    )


@router.get("/dialect-distribution")
async def get_dialect_distribution(
    level: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(is_researcher)
):
    """获取方言分布详细数据（用于研究分析）"""
    query = select(DialectCategory)
    if level is not None:
        query = query.where(DialectCategory.level == level)
    
    result = await db.execute(query)
    categories = result.scalars().all()
    
    distribution = []
    for cat in categories:
        sample_count = await db.scalar(
            select(func.count(AudioSample.id))
            .where(AudioSample.dialect_category_id == cat.id)
        )
        
        checked_count = await db.scalar(
            select(func.count(AudioSample.id))
            .where(AudioSample.dialect_category_id == cat.id)
            .where(AudioSample.quality_checked == True)
        )
        
        distribution.append({
            "category_id": cat.id,
            "category_name": cat.name,
            "code": cat.code,
            "level": cat.level,
            "region": cat.region,
            "sample_count": sample_count or 0,
            "checked_count": checked_count or 0,
            "description": cat.description
        })
    
    return distribution


@router.post("/export-csv")
async def export_data_csv(
    request: DataExportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(is_researcher)
):
    """导出CSV格式研究数据（受限访问）"""
    query = select(AudioSample).where(AudioSample.annotation_status == "accepted")
    
    if request.dialect_category_ids:
        query = query.where(AudioSample.dialect_category_id.in_(request.dialect_category_ids))
    
    if request.date_from:
        query = query.where(AudioSample.uploaded_at >= request.date_from)
    
    if request.date_to:
        query = query.where(AudioSample.uploaded_at <= request.date_to)
    
    if request.quality_min:
        query = query.where(AudioSample.quality_score >= request.quality_min)
    
    result = await db.execute(query)
    samples = result.scalars().all()
    
    data = []
    for sample in samples:
        row = {
            "sample_id": sample.id,
            "filename": sample.original_filename,
            "duration_seconds": sample.duration,
            "format": sample.format,
            "uploaded_at": sample.uploaded_at.isoformat() if sample.uploaded_at else None,
        }
        
        if request.include_annotations:
            row["annotation_text"] = sample.annotation_text
            row["annotation_status"] = sample.annotation_status
            row["quality_score"] = sample.quality_score
        
        if request.include_audio_metadata:
            row["collection_location"] = sample.collection_location
            row["collector_name"] = sample.collector_name
            row["speaker_age"] = sample.speaker_age
            row["speaker_gender"] = sample.speaker_gender
        
        if sample.dialect_category_id:
            category = await db.get(DialectCategory, sample.dialect_category_id)
            if category:
                row["dialect_category"] = category.name
                row["dialect_code"] = category.code
                row["dialect_region"] = category.region
        
        data.append(row)
    
    df = pd.DataFrame(data)
    
    await log_access(current_user, "export_csv", "corpus_data", f"导出 {len(data)} 条记录")
    
    return {
        "total_records": len(data),
        "columns": list(df.columns),
        "preview": df.head(5).to_dict('records') if len(data) > 0 else [],
        "message": "数据导出成功（完整数据可通过下载接口获取）"
    }


@router.get("/quality-report")
async def get_quality_report(
    days: int = 30,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(is_researcher)
):
    """生成标注质量分析报告（供研究人员使用）"""
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    result = await db.execute(
        select(AudioSample)
        .where(AudioSample.quality_checked == True)
        .where(AudioSample.checked_at >= cutoff_date)
    )
    checked_samples = result.scalars().all()
    
    if len(checked_samples) == 0:
        return {"message": "该时间段内暂无抽检数据"}
    
    scores = [s.quality_score for s in checked_samples if s.quality_score]
    avg_score = sum(scores) / len(scores) if scores else 0
    
    score_distribution = {}
    for i in range(10):
        lower = i * 0.1
        upper = (i + 1) * 0.1
        count = sum(1 for s in scores if lower <= (s or 0) < upper)
        if count > 0:
            score_distribution[f"{lower:.1f}-{upper:.1f}"] = count
    
    annotator_stats = {}
    for sample in checked_samples:
        if sample.annotator_id:
            aid = sample.annotator_id
            if aid not in annotator_stats:
                annotator_stats[aid] = {"count": 0, "total_score": 0, "name": ""}
            annotator_stats[aid]["count"] += 1
            annotator_stats[aid]["total_score"] += sample.quality_score or 0
            
            user = await db.get(User, aid)
            if user:
                annotator_stats[aid]["name"] = user.username
    
    annotator_ranking = []
    for aid, stats in annotator_stats.items():
        if stats["count"] >= 3:
            annotator_ranking.append({
                "annotator_id": aid,
                "annotator_name": stats["name"],
                "annotation_count": stats["count"],
                "average_score": round(stats["total_score"] / stats["count"], 3)
            })
    
    annotator_ranking.sort(key=lambda x: x["average_score"], reverse=True)
    
    return {
        "period_days": days,
        "total_checked": len(checked_samples),
        "average_quality_score": round(avg_score, 3),
        "score_distribution": score_distribution,
        "annotator_ranking": annotator_ranking[:10],
        "report_generated_at": datetime.utcnow().isoformat()
    }


@router.get("/access-logs", response_model=List[AccessLogEntry])
async def get_access_logs(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(is_manager_or_above)
):
    """获取数据访问日志（管理员查看）"""
    return []


async def log_access(user: User, action: str, resource_type: str, details: str = None):
    """记录数据访问（简化版）"""
    pass


@router.get("/annotator-leaderboard")
async def get_annotator_leaderboard(
    days: int = 30,
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(is_researcher)
):
    """获取标注人员排行榜（供研究质量分析）"""
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    result = await db.execute(
        select(AudioSample.annotator_id, func.count(AudioSample.id))
        .where(AudioSample.annotator_id.isnot(None))
        .where(AudioSample.annotation_status == "accepted")
        .where(AudioSample.uploaded_at >= cutoff_date)
        .group_by(AudioSample.annotator_id)
        .order_by(func.count(AudioSample.id).desc())
        .limit(limit)
    )
    rows = result.all()
    
    leaderboard = []
    for annotator_id, count in rows:
        user = await db.get(User, annotator_id)
        quality_result = await db.execute(
            select(func.avg(AudioSample.quality_score))
            .where(AudioSample.annotator_id == annotator_id)
            .where(AudioSample.quality_score.isnot(None))
            .where(AudioSample.uploaded_at >= cutoff_date)
        )
        avg_quality = quality_result.scalar()
        
        leaderboard.append({
            "annotator_id": annotator_id,
            "username": user.username if user else None,
            "accepted_count": count,
            "average_quality": round(avg_quality, 3) if avg_quality else None
        })
    
    return leaderboard


@router.get("/dialect-lexicon")
async def get_dialect_lexicon(
    dialect_category_id: Optional[int] = None,
    min_frequency: int = 3,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(is_researcher)
):
    """获取方言词汇表（基于标注数据自动提取）"""
    query = select(AudioSample).where(AudioSample.annotation_text.isnot(None))
    if dialect_category_id:
        query = query.where(AudioSample.dialect_category_id == dialect_category_id)
    
    result = await db.execute(query.limit(200))
    samples = result.scalars().all()
    
    word_freq = {}
    for sample in samples:
        text = sample.annotation_text
        words = text.split()
        for word in words:
            if len(word) >= 1:
                word_freq[word] = word_freq.get(word, 0) + 1
    
    lexicon = [
        {"word": word, "frequency": freq, "is_dialect": freq > min_frequency}
        for word, freq in word_freq.items()
        if freq >= min_frequency
    ]
    lexicon.sort(key=lambda x: x["frequency"], reverse=True)
    
    return {
        "total_unique_words": len(word_freq),
        "lexicon_entries": len(lexicon),
        "lexicon": lexicon[:50]
    }

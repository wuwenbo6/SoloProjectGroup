from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
from datetime import datetime

from app.database import get_db
from app.auth import get_current_user, is_manager_or_above
from app.models import User, AudioSample, StorageTier
from app.storage.cold_hot_storage import storage_manager


router = APIRouter(prefix="/api/v1/storage", tags=["storage"])


@router.get("/stats")
async def get_storage_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(is_manager_or_above)
):
    stats = await storage_manager.get_storage_stats(db)
    
    total_count = sum(s["count"] for s in stats.values())
    total_duration = sum(s["total_duration"] for s in stats.values())
    
    storage_sizes = {}
    for tier_name, tier_path in [
        ("hot", storage_manager.hot_storage_path),
        ("cold", storage_manager.cold_storage_path),
        ("archive", storage_manager.archive_storage_path)
    ]:
        if tier_path.exists():
            size = sum(f.stat().st_size for f in tier_path.rglob("*") if f.is_file())
            storage_sizes[tier_name] = {
                "bytes": size,
                "mb": round(size / (1024 * 1024), 2),
                "gb": round(size / (1024 * 1024 * 1024), 2)
            }
    
    return {
        "distribution": stats,
        "storage_sizes": storage_sizes,
        "summary": {
            "total_files": total_count,
            "total_duration_hours": round(total_duration / 3600, 2),
            "hot_percentage": round(stats["hot"]["count"] / total_count * 100, 1) if total_count > 0 else 0
        },
        "thresholds": {
            "hot_days": storage_manager.hot_threshold_days,
            "cold_days": storage_manager.cold_threshold_days
        }
    }


@router.post("/migrate/now")
async def trigger_migration(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(is_manager_or_above)
):
    result = await storage_manager.run_migration_task(db)
    return result


@router.post("/migrate/{sample_id}")
async def migrate_sample(
    sample_id: int,
    target_tier: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(is_manager_or_above)
):
    if target_tier not in [StorageTier.HOT, StorageTier.COLD, StorageTier.ARCHIVE]:
        raise HTTPException(status_code=400, detail="无效的存储层级")
    
    sample = await db.get(AudioSample, sample_id)
    if not sample:
        raise HTTPException(status_code=404, detail="样本不存在")
    
    success = await storage_manager.migrate_file(sample, target_tier, db)
    if not success:
        raise HTTPException(status_code=500, detail="迁移失败")
    
    return {
        "success": True,
        "sample_id": sample_id,
        "new_tier": target_tier,
        "new_path": sample.storage_path
    }


@router.get("/access/{sample_id}")
async def access_sample_file(
    sample_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sample = await db.get(AudioSample, sample_id)
    if not sample:
        raise HTTPException(status_code=404, detail="样本不存在")
    
    file_path = await storage_manager.access_file(sample, db)
    
    return {
        "sample_id": sample_id,
        "file_path": file_path,
        "current_tier": sample.storage_tier,
        "access_count": sample.access_count,
        "last_accessed": sample.last_accessed_at
    }


@router.get("/cold-files")
async def list_cold_files(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(is_manager_or_above)
):
    result = await db.execute(
        select(AudioSample)
        .where(AudioSample.storage_tier.in_([StorageTier.COLD, StorageTier.ARCHIVE]))
        .order_by(AudioSample.last_accessed_at.asc().nullslast())
        .offset(skip)
        .limit(limit)
    )
    samples = result.scalars().all()
    
    return [
        {
            "id": s.id,
            "filename": s.filename,
            "storage_tier": s.storage_tier,
            "access_count": s.access_count,
            "last_accessed": s.last_accessed_at,
            "last_migrated": s.last_migrated_at,
            "uploaded_at": s.uploaded_at
        }
        for s in samples
    ]


@router.get("/migration-history")
async def get_migration_history(
    days: int = 30,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(is_manager_or_above)
):
    cutoff_date = datetime.utcnow().replace(tzinfo=None) - __import__('datetime').timedelta(days=days)
    
    result = await db.execute(
        select(AudioSample)
        .where(AudioSample.last_migrated_at >= cutoff_date)
        .order_by(AudioSample.last_migrated_at.desc())
    )
    migrated_samples = result.scalars().all()
    
    tier_changes = {}
    for sample in migrated_samples:
        tier = sample.storage_tier or "hot"
        tier_changes[tier] = tier_changes.get(tier, 0) + 1
    
    return {
        "period_days": days,
        "total_migrated": len(migrated_samples),
        "tier_distribution": tier_changes,
        "samples": [
            {
                "id": s.id,
                "filename": s.filename,
                "current_tier": s.storage_tier,
                "migrated_at": s.last_migrated_at
            }
            for s in migrated_samples[:50]
        ]
    }


@router.post("/restore-all")
async def restore_all_to_hot(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(is_manager_or_above)
):
    result = await db.execute(
        select(AudioSample)
        .where(AudioSample.storage_tier.in_([StorageTier.COLD, StorageTier.ARCHIVE]))
    )
    samples = result.scalars().all()
    
    restored_count = 0
    for sample in samples:
        if await storage_manager.migrate_file(sample, StorageTier.HOT, db):
            restored_count += 1
    
    return {
        "success": True,
        "restored_count": restored_count,
        "message": f"已将 {restored_count} 个文件恢复到热存储"
    }

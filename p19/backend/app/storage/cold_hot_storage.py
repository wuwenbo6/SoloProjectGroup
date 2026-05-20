import os
import shutil
import asyncio
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Tuple
import aiofiles
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.models import AudioSample
from app.core.config import settings


class StorageTier:
    HOT = "hot"
    COLD = "cold"
    ARCHIVE = "archive"


class ColdHotStorageManager:
    def __init__(self):
        self.hot_storage_path = Path(settings.HOT_STORAGE_PATH)
        self.cold_storage_path = Path(settings.COLD_STORAGE_PATH)
        self.archive_storage_path = Path(settings.ARCHIVE_STORAGE_PATH)
        
        self.hot_threshold_days = settings.HOT_THRESHOLD_DAYS or 30
        self.cold_threshold_days = settings.COLD_THRESHOLD_DAYS or 90
        
        self._init_storage()
    
    def _init_storage(self):
        for path in [self.hot_storage_path, self.cold_storage_path, self.archive_storage_path]:
            path.mkdir(parents=True, exist_ok=True)
    
    def get_storage_path(self, tier: str) -> Path:
        if tier == StorageTier.HOT:
            return self.hot_storage_path
        elif tier == StorageTier.COLD:
            return self.cold_storage_path
        elif tier == StorageTier.ARCHIVE:
            return self.archive_storage_path
        return self.hot_storage_path
    
    def determine_storage_tier(self, sample: AudioSample) -> str:
        now = datetime.utcnow()
        
        if sample.last_accessed_at:
            days_since_access = (now - sample.last_accessed_at).days
        else:
            days_since_access = (now - sample.uploaded_at).days
        
        access_count = sample.access_count or 0
        
        if days_since_access <= self.hot_threshold_days or access_count > 10:
            return StorageTier.HOT
        elif days_since_access <= self.cold_threshold_days or access_count > 3:
            return StorageTier.COLD
        else:
            return StorageTier.ARCHIVE
    
    async def migrate_file(
        self,
        sample: AudioSample,
        target_tier: str,
        db: AsyncSession
    ) -> bool:
        if sample.storage_tier == target_tier:
            return True
        
        source_path = self.get_storage_path(sample.storage_tier or StorageTier.HOT)
        target_path = self.get_storage_path(target_tier)
        
        source_file = source_path / sample.filename
        target_file = target_path / sample.filename
        
        if not source_file.exists():
            return False
        
        try:
            await asyncio.to_thread(shutil.move, str(source_file), str(target_file))
            
            sample.storage_tier = target_tier
            sample.storage_path = str(target_file)
            sample.last_migrated_at = datetime.utcnow()
            
            await db.commit()
            return True
        except Exception as e:
            print(f"文件迁移失败: {e}")
            return False
    
    async def access_file(self, sample: AudioSample, db: AsyncSession) -> Optional[str]:
        if sample.storage_tier in [StorageTier.COLD, StorageTier.ARCHIVE]:
            success = await self.migrate_file(sample, StorageTier.HOT, db)
            if not success:
                return None
        
        sample.access_count = (sample.access_count or 0) + 1
        sample.last_accessed_at = datetime.utcnow()
        await db.commit()
        
        return sample.storage_path or str(self.hot_storage_path / sample.filename)
    
    async def batch_migrate_cold(self, db: AsyncSession, limit: int = 100) -> int:
        cutoff_date = datetime.utcnow() - timedelta(days=self.hot_threshold_days)
        
        result = await db.execute(
            select(AudioSample)
            .where(AudioSample.storage_tier == StorageTier.HOT)
            .where(
                (AudioSample.last_accessed_at < cutoff_date) |
                (AudioSample.last_accessed_at.is_(None) & (AudioSample.uploaded_at < cutoff_date))
            )
            .where((AudioSample.access_count.is_(None)) | (AudioSample.access_count <= 10))
            .limit(limit)
        )
        samples = result.scalars().all()
        
        migrated_count = 0
        for sample in samples:
            if await self.migrate_file(sample, StorageTier.COLD, db):
                migrated_count += 1
        
        return migrated_count
    
    async def batch_migrate_archive(self, db: AsyncSession, limit: int = 50) -> int:
        cutoff_date = datetime.utcnow() - timedelta(days=self.cold_threshold_days)
        
        result = await db.execute(
            select(AudioSample)
            .where(AudioSample.storage_tier == StorageTier.COLD)
            .where(
                (AudioSample.last_accessed_at < cutoff_date) |
                (AudioSample.last_accessed_at.is_(None) & (AudioSample.uploaded_at < cutoff_date))
            )
            .where((AudioSample.access_count.is_(None)) | (AudioSample.access_count <= 3))
            .limit(limit)
        )
        samples = result.scalars().all()
        
        migrated_count = 0
        for sample in samples:
            if await self.migrate_file(sample, StorageTier.ARCHIVE, db):
                migrated_count += 1
        
        return migrated_count
    
    async def get_storage_stats(self, db: AsyncSession) -> dict:
        tiers = [StorageTier.HOT, StorageTier.COLD, StorageTier.ARCHIVE]
        stats = {}
        
        for tier in tiers:
            result = await db.execute(
                select(
                    func.count(AudioSample.id),
                    func.sum(AudioSample.duration)
                )
                .where(AudioSample.storage_tier == tier)
            )
            count, total_duration = result.first()
            
            stats[tier] = {
                "count": count or 0,
                "total_duration": float(total_duration or 0)
            }
        
        return stats
    
    async def run_migration_task(self, db: AsyncSession) -> dict:
        cold_migrated = await self.batch_migrate_cold(db, 100)
        archive_migrated = await self.batch_migrate_archive(db, 50)
        
        return {
            "cold_migrated": cold_migrated,
            "archive_migrated": archive_migrated,
            "total_migrated": cold_migrated + archive_migrated,
            "timestamp": datetime.utcnow().isoformat()
        }


storage_manager = ColdHotStorageManager()


async def run_storage_migration_background():
    from app.database import async_session
    
    while True:
        try:
            async with async_session() as db:
                result = await storage_manager.run_migration_task(db)
                print(f"存储迁移完成: {result}")
        except Exception as e:
            print(f"存储迁移任务失败: {e}")
        
        await asyncio.sleep(6 * 3600)

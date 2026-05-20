import asyncio
import uuid
import json
import numpy as np
from datetime import datetime
from typing import List, Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.models import AudioSample, FeatureCluster, ClusterStatus
from app.core.config import settings


class ClusteringTask:
    def __init__(self, task_id: str, sample_ids: List[int]):
        self.task_id = task_id
        self.sample_ids = sample_ids
        self.status = ClusterStatus.PENDING
        self.progress = 0
        self.result = None
        self.error = None
        self.created_at = datetime.utcnow()
        self.completed_at = None


class AsyncClusterManager:
    def __init__(self):
        self.tasks: Dict[str, ClusteringTask] = {}
        self.active_tasks: set = set()
        self.max_workers = settings.CLUSTER_MAX_WORKERS
        self.batch_size = settings.CLUSTER_BATCH_SIZE
    
    def create_task(self, sample_ids: List[int]) -> str:
        task_id = str(uuid.uuid4())
        task = ClusteringTask(task_id, sample_ids)
        self.tasks[task_id] = task
        return task_id
    
    async def submit_task(self, task_id: str, db: AsyncSession) -> Dict:
        if len(self.active_tasks) >= self.max_workers:
            return {
                "success": False,
                "task_id": task_id,
                "message": "工作队列已满，请稍后再试"
            }
        
        task = self.tasks.get(task_id)
        if not task:
            return {"success": False, "message": "任务不存在"}
        
        self.active_tasks.add(task_id)
        
        asyncio.create_task(self._run_clustering(task_id, db))
        
        return {
            "success": True,
            "task_id": task_id,
            "message": "聚类任务已启动"
        }
    
    async def _run_clustering(self, task_id: str, db: AsyncSession):
        task = self.tasks.get(task_id)
        if not task:
            return
        
        try:
            task.status = ClusterStatus.PROCESSING
            
            all_features = []
            valid_sample_ids = []
            
            for i in range(0, len(task.sample_ids), self.batch_size):
                batch_ids = task.sample_ids[i:i + self.batch_size]
                
                result = await db.execute(
                    select(AudioSample)
                    .where(AudioSample.id.in_(batch_ids))
                    .where(AudioSample.feature_vector.isnot(None))
                )
                samples = result.scalars().all()
                
                for sample in samples:
                    try:
                        feature = json.loads(sample.feature_vector)
                        all_features.append(feature)
                        valid_sample_ids.append(sample.id)
                    except json.JSONDecodeError:
                        continue
                
                task.progress = min(95, int((i + len(batch_ids)) / len(task.sample_ids) * 100))
                await asyncio.sleep(0.1)
            
            if len(all_features) < 2:
                task.status = ClusterStatus.COMPLETED
                task.progress = 100
                task.result = {"clusters_created": 0, "samples_processed": len(all_features)}
                task.completed_at = datetime.utcnow()
                return
            
            feature_array = np.array(all_features)
            
            clusters = await self._perform_clustering(feature_array, valid_sample_ids)
            
            await self._save_clusters(clusters, valid_sample_ids, db)
            
            task.status = ClusterStatus.COMPLETED
            task.progress = 100
            task.result = {
                "clusters_created": len(set(clusters)),
                "samples_processed": len(valid_sample_ids),
                "cluster_distribution": self._get_cluster_distribution(clusters)
            }
            task.completed_at = datetime.utcnow()
            
            await self._update_sample_clusters(valid_sample_ids, clusters, task_id, db)
            
        except Exception as e:
            task.status = ClusterStatus.FAILED
            task.error = str(e)
            task.completed_at = datetime.utcnow()
        finally:
            self.active_tasks.discard(task_id)
    
    async def _perform_clustering(self, features: np.ndarray, sample_ids: List[int]) -> List[int]:
        from sklearn.cluster import KMeans
        
        n_samples = len(features)
        n_clusters = min(max(2, int(n_samples / 5)), 20)
        
        if n_samples < n_clusters:
            n_clusters = max(2, n_samples // 2)
        
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        labels = kmeans.fit_predict(features)
        
        return labels.tolist()
    
    async def _save_clusters(self, labels: List[int], sample_ids: List[int], db: AsyncSession):
        label_to_cluster_id = {}
        
        unique_labels = set(labels)
        
        for label in unique_labels:
            indices = [i for i, l in enumerate(labels) if l == label]
            cluster_samples = [sample_ids[i] for i in indices]
            
            center_feature = await self._calculate_center_feature(indices, sample_ids, db)
            
            cluster = FeatureCluster(
                center_feature=json.dumps(center_feature) if center_feature else None,
                sample_count=len(cluster_samples),
                dialect_category_id=None
            )
            
            db.add(cluster)
            await db.flush()
            label_to_cluster_id[label] = cluster.id
        
        await db.commit()
        return label_to_cluster_id
    
    async def _calculate_center_feature(self, indices: List[int], sample_ids: List[int], db: AsyncSession) -> Optional[List[float]]:
        features = []
        
        for idx in indices:
            sample_id = sample_ids[idx]
            sample = await db.get(AudioSample, sample_id)
            if sample and sample.feature_vector:
                try:
                    feature = json.loads(sample.feature_vector)
                    features.append(feature)
                except json.JSONDecodeError:
                    continue
        
        if not features:
            return None
        
        return list(np.mean(features, axis=0))
    
    async def _update_sample_clusters(self, sample_ids: List[int], labels: List[int], task_id: str, db: AsyncSession):
        label_to_cluster_id = {}
        
        for sample_id, label in zip(sample_ids, labels):
            if label not in label_to_cluster_id:
                result = await db.execute(
                    select(FeatureCluster.id)
                    .where(FeatureCluster.sample_count > 0)
                    .limit(1)
                )
                cluster_id = result.scalar()
                if cluster_id:
                    label_to_cluster_id[label] = cluster_id
            
            cluster_id = label_to_cluster_id.get(label)
            if cluster_id:
                await db.execute(
                    update(AudioSample)
                    .where(AudioSample.id == sample_id)
                    .values(
                        cluster_id=cluster_id,
                        cluster_status=ClusterStatus.COMPLETED,
                        cluster_task_id=task_id
                    )
                )
        
        await db.commit()
    
    def _get_cluster_distribution(self, labels: List[int]) -> Dict[int, int]:
        distribution = {}
        for label in labels:
            distribution[label] = distribution.get(label, 0) + 1
        return distribution
    
    def get_task_status(self, task_id: str) -> Optional[Dict]:
        task = self.tasks.get(task_id)
        if not task:
            return None
        
        return {
            "task_id": task_id,
            "status": task.status,
            "progress": task.progress,
            "created_at": task.created_at,
            "completed_at": task.completed_at,
            "result": task.result,
            "error": task.error,
            "total_samples": len(task.sample_ids)
        }
    
    def get_all_tasks(self) -> List[Dict]:
        return [
            self.get_task_status(task_id)
            for task_id in self.tasks.keys()
        ]
    
    async def get_pending_samples(self, db: AsyncSession, limit: int = 100) -> List[int]:
        result = await db.execute(
            select(AudioSample.id)
            .where(AudioSample.cluster_status == ClusterStatus.PENDING)
            .where(AudioSample.feature_vector.isnot(None))
            .limit(limit)
        )
        return [r[0] for r in result.all()]
    
    def cleanup_old_tasks(self, max_age_hours: int = 24):
        cutoff_time = datetime.utcnow() - __import__('datetime').timedelta(hours=max_age_hours)
        
        task_ids_to_remove = [
            task_id for task_id, task in self.tasks.items()
            if task.completed_at and task.completed_at < cutoff_time
        ]
        
        for task_id in task_ids_to_remove:
            del self.tasks[task_id]


cluster_manager = AsyncClusterManager()


async def run_periodic_clustering(db: AsyncSession):
    while True:
        try:
            if len(cluster_manager.active_tasks) < cluster_manager.max_workers:
                pending_samples = await cluster_manager.get_pending_samples(db, 100)
                if pending_samples:
                    task_id = cluster_manager.create_task(pending_samples)
                    await cluster_manager.submit_task(task_id, db)
                    print(f"自动启动聚类任务: {task_id}, 样本数: {len(pending_samples)}")
            
            cluster_manager.cleanup_old_tasks()
            
        except Exception as e:
            print(f"周期性聚类任务失败: {e}")
        
        await asyncio.sleep(300)

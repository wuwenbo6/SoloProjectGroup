import numpy as np
import json
from typing import List, Optional, Dict
from sklearn.cluster import KMeans, DBSCAN
from sklearn.preprocessing import StandardScaler
from sklearn.metrics.pairwise import cosine_similarity
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..models import AudioSample, FeatureCluster, DialectCategory
from ..utils.audio_utils import extract_audio_features


class ClusteringService:
    def __init__(self):
        self.scaler = StandardScaler()
    
    @staticmethod
    def _vector_to_json(vector: np.ndarray) -> str:
        return json.dumps(vector.tolist())
    
    @staticmethod
    def _json_to_vector(json_str: str) -> np.ndarray:
        return np.array(json.loads(json_str))
    
    async def extract_and_save_features(
        self,
        db: AsyncSession,
        audio_sample: AudioSample,
        file_path: str
    ) -> Optional[np.ndarray]:
        features = extract_audio_features(file_path)
        if features is not None:
            audio_sample.feature_vector = self._vector_to_json(features)
            await db.commit()
            await db.refresh(audio_sample)
        return features
    
    async def _update_sample_cluster_ids(
        self,
        db: AsyncSession,
        samples: List[AudioSample],
        labels: np.ndarray,
        cluster_map: Dict[int, int]
    ):
        for j, sample in enumerate(samples):
            label = int(labels[j])
            if label in cluster_map:
                sample.cluster_id = cluster_map[label]
                db.add(sample)
        await db.commit()
    
    async def perform_kmeans_clustering(
        self,
        db: AsyncSession,
        n_clusters: int = 5,
        region: Optional[str] = None
    ) -> Dict:
        query = select(AudioSample).where(AudioSample.feature_vector.isnot(None))
        if region:
            query = query.where(AudioSample.collection_location.like(f"%{region}%"))
        
        result = await db.execute(query)
        samples = list(result.scalars().all())
        
        if len(samples) < n_clusters:
            raise ValueError(f"Not enough samples ({len(samples)}) for {n_clusters} clusters")
        
        feature_vectors = []
        sample_ids = []
        for sample in samples:
            if sample.feature_vector:
                vector = self._json_to_vector(sample.feature_vector)
                feature_vectors.append(vector)
                sample_ids.append(sample.id)
        
        X = np.array(feature_vectors)
        X_scaled = self.scaler.fit_transform(X)
        
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        labels = kmeans.fit_predict(X_scaled)
        
        clusters = []
        cluster_map = {}
        
        for i in range(n_clusters):
            cluster_samples = [sample_ids[j] for j, label in enumerate(labels) if label == i]
            centroid = kmeans.cluster_centers_[i]
            
            cluster = FeatureCluster(
                name=f"Cluster_{i+1}",
                centroid=self._vector_to_json(centroid),
                sample_count=len(cluster_samples)
            )
            db.add(cluster)
            await db.flush()
            clusters.append(cluster)
            cluster_map[i] = cluster.id
        
        await self._update_sample_cluster_ids(db, samples, labels, cluster_map)
        
        await db.commit()
        return {
            "clusters": clusters,
            "total_samples": len(samples),
            "sample_ids": sample_ids,
            "labels": labels.tolist()
        }
    
    async def perform_dbscan_clustering(
        self,
        db: AsyncSession,
        eps: float = 0.5,
        min_samples: int = 5
    ) -> Dict:
        result = await db.execute(
            select(AudioSample).where(AudioSample.feature_vector.isnot(None))
        )
        samples = list(result.scalars().all())
        
        if len(samples) < min_samples:
            raise ValueError(f"Not enough samples ({len(samples)}) for DBSCAN")
        
        feature_vectors = []
        sample_ids = []
        for sample in samples:
            if sample.feature_vector:
                vector = self._json_to_vector(sample.feature_vector)
                feature_vectors.append(vector)
                sample_ids.append(sample.id)
        
        X = np.array(feature_vectors)
        X_scaled = self.scaler.fit_transform(X)
        
        dbscan = DBSCAN(eps=eps, min_samples=min_samples)
        labels = dbscan.fit_predict(X_scaled)
        
        unique_labels = set(labels)
        clusters = []
        cluster_map = {}
        
        for label in unique_labels:
            if label == -1:
                continue
            
            mask = labels == label
            cluster_points = X_scaled[mask]
            centroid = np.mean(cluster_points, axis=0)
            
            cluster = FeatureCluster(
                name=f"DBSCAN_Cluster_{label}",
                centroid=self._vector_to_json(centroid),
                sample_count=len(cluster_points)
            )
            db.add(cluster)
            await db.flush()
            clusters.append(cluster)
            cluster_map[int(label)] = cluster.id
        
        await self._update_sample_cluster_ids(db, samples, labels, cluster_map)
        
        await db.commit()
        return {
            "clusters": clusters,
            "total_samples": len(samples),
            "sample_ids": sample_ids,
            "labels": labels.tolist(),
            "noise_count": int(np.sum(labels == -1))
        }
    
    async def find_similar_samples(
        self,
        db: AsyncSession,
        sample_id: int,
        top_k: int = 5
    ) -> List[Dict]:
        target_sample = await db.get(AudioSample, sample_id)
        if not target_sample or not target_sample.feature_vector:
            return []
        
        target_vector = self._json_to_vector(target_sample.feature_vector)
        
        result = await db.execute(
            select(AudioSample)
            .where(AudioSample.feature_vector.isnot(None))
            .where(AudioSample.id != sample_id)
        )
        samples = result.scalars().all()
        
        similarities = []
        for sample in samples:
            vector = self._json_to_vector(sample.feature_vector)
            similarity = cosine_similarity([target_vector], [vector])[0][0]
            similarities.append({
                "sample_id": sample.id,
                "sample_uuid": sample.uuid,
                "similarity": float(similarity),
                "filename": sample.original_filename
            })
        
        similarities.sort(key=lambda x: x["similarity"], reverse=True)
        return similarities[:top_k]
    
    async def classify_dialect(
        self,
        db: AsyncSession,
        sample_id: int
    ) -> Dict:
        sample = await db.get(AudioSample, sample_id)
        if not sample or not sample.feature_vector:
            return {"error": "Sample not found or no features"}
        
        sample_vector = self._json_to_vector(sample.feature_vector)
        
        result = await db.execute(
            select(DialectCategory).where(DialectCategory.feature_vector.isnot(None))
        )
        categories = result.scalars().all()
        
        if not categories:
            return {"error": "No dialect categories with features available"}
        
        best_match = None
        best_similarity = -1
        
        for category in categories:
            category_vector = self._json_to_vector(category.feature_vector)
            similarity = cosine_similarity([sample_vector], [category_vector])[0][0]
            
            if similarity > best_similarity:
                best_similarity = similarity
                best_match = category
        
        if best_match:
            sample.dialect_category_id = best_match.id
            sample.dialect_confidence = float(best_similarity)
            await db.commit()
            
            return {
                "category_id": best_match.id,
                "category_name": best_match.name,
                "confidence": float(best_similarity)
            }
        
        return {"error": "No matching category found"}


clustering_service = ClusteringService()

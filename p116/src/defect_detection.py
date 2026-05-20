import numpy as np
import open3d as o3d
from scipy import stats
from sklearn.cluster import DBSCAN
from scipy.spatial import KDTree
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
from enum import Enum


class DefectType(Enum):
    """缺损类型枚举"""
    MISSING_AREA = "missing_area"
    CRACK = "crack"
    DENT = "dent"
    ABRASION = "abrasion"
    ANOMALY = "anomaly"


@dataclass
class Defect:
    """缺损数据类"""
    defect_id: int
    defect_type: DefectType
    center: np.ndarray
    points: np.ndarray
    area: float
    depth: float
    severity: str
    confidence: float


class DefectDetector:
    """点云缺损检测类 - 改进版本"""
    
    def __init__(self):
        self.defects: List[Defect] = []
        self.point_cloud: Optional[o3d.geometry.PointCloud] = None
        self.reference_cloud: Optional[o3d.geometry.PointCloud] = None
        
    def set_point_cloud(self, pcd: o3d.geometry.PointCloud):
        """设置待检测点云"""
        self.point_cloud = pcd
        
    def set_reference(self, reference_pcd: o3d.geometry.PointCloud):
        """设置参考点云（用于对比检测）"""
        self.reference_cloud = reference_pcd
        
    def detect_defects(self,
                       method: str = 'statistical',
                       threshold: float = 2.5,
                       min_cluster_size: int = 30,
                       max_cluster_size: int = 5000,
                       eps: float = 0.1) -> Tuple[List[Defect], np.ndarray]:
        """
        检测点云中的缺损 - 改进版本
        
        Args:
            method: 检测方法 ('statistical', 'distance', 'curvature', 'reference')
            threshold: 检测阈值 (标准差倍数)
            min_cluster_size: 最小聚类大小
            max_cluster_size: 最大聚类大小
            eps: DBSCAN聚类半径
            
        Returns:
            (defects_list, defect_labels): 缺损列表和每个点的缺损标签
        """
        if self.point_cloud is None:
            raise ValueError("未设置点云数据")
            
        points = np.asarray(self.point_cloud.points)
        n_points = len(points)
        defect_labels = np.zeros(n_points, dtype=int)
        
        print(f"开始检测 {n_points} 个点的缺损...")
        
        anomaly_scores = np.zeros(n_points)
        
        if method == 'statistical':
            anomaly_scores = self._statistical_detection(points)
        elif method == 'distance':
            anomaly_scores = self._distance_detection(points)
        elif method == 'curvature':
            anomaly_scores = self._curvature_detection(points)
        elif method == 'reference':
            if self.reference_cloud is None:
                raise ValueError("参考对比方法需要设置参考点云")
            anomaly_scores = self._reference_detection(points)
        else:
            raise ValueError(f"未知的检测方法: {method}")
        
        valid_scores = anomaly_scores[np.isfinite(anomaly_scores)]
        score_mean = np.mean(valid_scores)
        score_std = np.std(valid_scores)
        
        print(f"  异常分数 - 均值: {score_mean:.3f}, 标准差: {score_std:.3f}")
        
        anomaly_threshold = score_mean + threshold * score_std
        anomaly_mask = anomaly_scores > anomaly_threshold
        
        anomaly_count = np.sum(anomaly_mask)
        print(f"  检测到 {anomaly_count} 个异常点 (阈值: {anomaly_threshold:.3f})")
        
        if anomaly_count > min_cluster_size:
            anomaly_indices = np.where(anomaly_mask)[0]
            anomaly_points = points[anomaly_mask]
            
            clusters = self._cluster_defects(
                anomaly_points,
                eps=eps,
                min_samples=min_cluster_size
            )
            
            unique_clusters = np.unique(clusters)
            unique_clusters = unique_clusters[unique_clusters != -1]
            
            print(f"  聚类得到 {len(unique_clusters)} 个候选缺损区域")
            
            defect_id = 1
            for cluster_id in unique_clusters:
                cluster_mask = clusters == cluster_id
                cluster_size = np.sum(cluster_mask)
                
                if not (min_cluster_size <= cluster_size <= max_cluster_size):
                    continue
                    
                cluster_points_idx = anomaly_indices[cluster_mask]
                cluster_points = points[cluster_points_idx]
                
                defect = self._analyze_defect(
                    defect_id=defect_id,
                    points=cluster_points,
                    all_points=points,
                    anomaly_scores=anomaly_scores[cluster_points_idx]
                )
                
                if defect is not None and defect.confidence > 0.3:
                    self.defects.append(defect)
                    defect_labels[cluster_points_idx] = defect_id
                    defect_id += 1
                    print(f"    缺损 #{defect_id-1}: {cluster_size} 个点, "
                          f"面积: {defect.area:.4f}, 深度: {defect.depth:.4f}, "
                          f"置信度: {defect.confidence:.2f}")
        
        return self.defects, defect_labels
    
    def _statistical_detection(self, points: np.ndarray) -> np.ndarray:
        """基于统计的异常检测 - 使用局部距离分布"""
        tree = KDTree(points)
        
        k = min(50, len(points) // 100)
        k = max(10, k)
        
        distances, _ = tree.query(points, k=k)
        avg_distances = np.mean(distances, axis=1)
        
        local_means = np.zeros_like(avg_distances)
        local_stds = np.zeros_like(avg_distances)
        
        indices = tree.query_ball_point(points, r=np.mean(avg_distances) * 2)
        
        for i, idx_list in enumerate(indices):
            if len(idx_list) > 5:
                local_dists = avg_distances[idx_list]
                local_means[i] = np.mean(local_dists)
                local_stds[i] = np.std(local_dists)
            else:
                local_means[i] = avg_distances[i]
                local_stds[i] = np.std(avg_distances)
        
        with np.errstate(divide='ignore', invalid='ignore'):
            z_scores = np.abs((avg_distances - local_means) / (local_stds + 1e-8))
        
        z_scores[~np.isfinite(z_scores)] = 0
        
        return z_scores
    
    def _distance_detection(self, points: np.ndarray) -> np.ndarray:
        """基于局部距离变化的检测"""
        tree = KDTree(points)
        
        k = min(30, len(points) // 200)
        k = max(10, k)
        
        distances, _ = tree.query(points, k=k)
        
        mean_dist = np.mean(distances, axis=1)
        std_dist = np.std(distances, axis=1)
        
        global_mean = np.mean(mean_dist)
        global_std = np.std(mean_dist)
        
        feature1 = np.abs(mean_dist - global_mean) / (global_std + 1e-8)
        
        feature2 = std_dist / (global_mean + 1e-8)
        
        combined_score = feature1 * 0.7 + feature2 * 0.3
        
        return combined_score
    
    def _curvature_detection(self, points: np.ndarray) -> np.ndarray:
        """基于曲率的检测"""
        pcd = o3d.geometry.PointCloud()
        pcd.points = o3d.utility.Vector3dVector(points)
        pcd.estimate_normals(search_param=o3d.geometry.KDTreeSearchParamKNN(30))
        pcd.orient_normals_consistent_tangent_plane(k=15)
        
        normals = np.asarray(pcd.normals)
        
        tree = KDTree(points)
        curvatures = np.zeros(len(points))
        
        k = 30
        for i in range(len(points)):
            _, indices = tree.query(points[i], k=k)
            neighbor_normals = normals[indices]
            
            normal_var = np.var(neighbor_normals, axis=0)
            curvature = np.sum(normal_var)
            curvatures[i] = curvature
        
        mean_curvature = np.mean(curvatures)
        std_curvature = np.std(curvatures)
        
        z_scores = np.abs((curvatures - mean_curvature) / (std_curvature + 1e-8))
        
        return z_scores
    
    def _reference_detection(self, points: np.ndarray) -> np.ndarray:
        """基于参考点云的对比检测"""
        ref_points = np.asarray(self.reference_cloud.points)
        tree = KDTree(ref_points)
        
        distances, _ = tree.query(points, k=5)
        avg_distances = np.mean(distances, axis=1)
        
        mean_dist = np.mean(avg_distances)
        std_dist = np.std(avg_distances)
        
        z_scores = np.abs((avg_distances - mean_dist) / (std_dist + 1e-8))
        
        return z_scores
    
    def _cluster_defects(self, points: np.ndarray, eps: float, min_samples: int) -> np.ndarray:
        """使用DBSCAN聚类缺损点"""
        if len(points) < min_samples:
            return np.array([-1] * len(points))
            
        clustering = DBSCAN(eps=eps, min_samples=min_samples).fit(points)
        return clustering.labels_
    
    def _analyze_defect(self,
                         defect_id: int,
                         points: np.ndarray,
                         all_points: np.ndarray,
                         anomaly_scores: np.ndarray) -> Optional[Defect]:
        """分析缺损特征 - 改进版本"""
        if len(points) < 5:
            return None
            
        center = np.mean(points, axis=0)
        
        area = self._estimate_defect_area(points)
        
        depth = self._estimate_defect_depth(points, all_points)
        
        defect_type = self._classify_defect_type(points, depth, area)
        
        severity = self._calculate_severity(depth, area, len(points))
        
        confidence = np.mean(anomaly_scores) / (np.max(anomaly_scores) + 1e-8)
        confidence = min(1.0, confidence + len(points) / 1000)
        
        return Defect(
            defect_id=defect_id,
            defect_type=defect_type,
            center=center,
            points=points,
            area=area,
            depth=depth,
            severity=severity,
            confidence=float(confidence)
        )
    
    def _estimate_defect_area(self, points: np.ndarray) -> float:
        """估算缺损面积"""
        if len(points) < 3:
            return 0.0
            
        hull = o3d.geometry.PointCloud()
        hull.points = o3d.utility.Vector3dVector(points)
        
        try:
            convex_hull, _ = hull.compute_convex_hull()
            area = convex_hull.get_surface_area()
            return area
        except:
            centered = points - np.mean(points, axis=0)
            cov = np.cov(centered.T)
            eigenvalues, _ = np.linalg.eig(cov)
            eigenvalues = np.sort(eigenvalues)[::-1]
            area = np.pi * np.sqrt(eigenvalues[0] * eigenvalues[1] + 1e-8)
            return float(area)
    
    def _estimate_defect_depth(self, defect_points: np.ndarray, all_points: np.ndarray) -> float:
        """估算缺损深度"""
        from scipy.spatial import KDTree
        
        tree = KDTree(all_points)
        
        defect_center = np.mean(defect_points, axis=0)
        
        distances, indices = tree.query(defect_center, k=100)
        neighborhood = all_points[indices]
        
        neighborhood_center = np.mean(neighborhood, axis=0)
        
        normal = defect_center - neighborhood_center
        if np.linalg.norm(normal) > 1e-8:
            normal = normal / np.linalg.norm(normal)
            
            projections = np.dot(defect_points - neighborhood_center, normal)
            depth = np.max(projections) - np.min(projections)
            
            return float(depth)
        else:
            return 0.0
    
    def _classify_defect_type(self, points: np.ndarray, depth: float, area: float) -> DefectType:
        """分类缺损类型"""
        if len(points) < 3:
            return DefectType.ANOMALY
            
        centered = points - np.mean(points, axis=0)
        cov = np.cov(centered.T)
        eigenvalues, _ = np.linalg.eig(cov)
        eigenvalues = np.sort(eigenvalues)[::-1]
        
        if eigenvalues[1] > 1e-8:
            aspect_ratio = np.sqrt(eigenvalues[0] / eigenvalues[1])
        else:
            aspect_ratio = 1.0
            
        volume_ratio = depth / (np.sqrt(area) + 1e-8)
        
        if aspect_ratio > 8.0 and volume_ratio < 0.5:
            return DefectType.CRACK
        elif volume_ratio > 0.8:
            return DefectType.DENT
        elif area > 1.0 and volume_ratio < 0.2:
            return DefectType.MISSING_AREA
        elif volume_ratio < 0.1:
            return DefectType.ABRASION
        else:
            return DefectType.ANOMALY
    
    def _calculate_severity(self, depth: float, area: float, num_points: int) -> str:
        """计算缺损严重程度"""
        severity_score = 0
        
        if depth > 1.0:
            severity_score += 3
        elif depth > 0.5:
            severity_score += 2
        elif depth > 0.2:
            severity_score += 1
        
        if area > 2.0:
            severity_score += 3
        elif area > 1.0:
            severity_score += 2
        elif area > 0.5:
            severity_score += 1
            
        if severity_score >= 5:
            return "critical"
        elif severity_score >= 3:
            return "high"
        elif severity_score >= 1:
            return "medium"
        else:
            return "low"
    
    def get_defect_summary(self) -> Dict:
        """获取缺损检测摘要"""
        if not self.defects:
            return {
                'total_defects': 0,
                'severity_distribution': {},
                'type_distribution': {},
                'total_defect_area': 0.0,
                'defects': []
            }
            
        severity_dist = {}
        type_dist = {}
        total_area = 0.0
        
        for defect in self.defects:
            severity_dist[defect.severity] = severity_dist.get(defect.severity, 0) + 1
            type_dist[defect.defect_type.value] = type_dist.get(defect.defect_type.value, 0) + 1
            total_area += defect.area
            
        return {
            'total_defects': len(self.defects),
            'severity_distribution': severity_dist,
            'type_distribution': type_dist,
            'total_defect_area': float(total_area),
            'defects': [
                {
                    'id': d.defect_id,
                    'type': d.defect_type.value,
                    'severity': d.severity,
                    'area': float(d.area),
                    'depth': float(d.depth),
                    'confidence': float(d.confidence),
                    'center': d.center.tolist(),
                    'num_points': len(d.points)
                }
                for d in self.defects
            ]
        }
    
    def get_defect_point_cloud(self, defect_id: int) -> Optional[o3d.geometry.PointCloud]:
        """获取指定缺损的点云"""
        for defect in self.defects:
            if defect.defect_id == defect_id:
                pcd = o3d.geometry.PointCloud()
                pcd.points = o3d.utility.Vector3dVector(defect.points)
                return pcd
        return None

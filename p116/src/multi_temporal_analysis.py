import numpy as np
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from pathlib import Path
import warnings

try:
    import open3d as o3d
    OPEN3D_AVAILABLE = True
except ImportError:
    OPEN3D_AVAILABLE = False
    warnings.warn("Open3D not available, some functions will be limited")


@dataclass
class PointCloudMetadata:
    """点云元数据"""
    file_path: str
    scan_date: str
    scan_id: str
    resolution: float
    num_points: int
    description: str = ""


@dataclass
class ChangeRegion:
    """变化区域数据类"""
    region_id: int
    center: np.ndarray
    volume_change: float
    area: float
    max_deformation: float
    avg_deformation: float
    change_type: str
    confidence: float
    points_count: int


@dataclass
class RegistrationResult:
    """配准结果数据类"""
    success: bool
    transformation: np.ndarray
    fitness: float
    rmse: float
    correspondences: int


class MultiTemporalAnalyzer:
    """
    多期对比分析类
    
    对不同时期的点云进行配准、差异检测、变化分析
    """
    
    def __init__(self, voxel_size: float = 0.05):
        """
        初始化多期对比分析器
        
        Args:
            voxel_size: 体素降采样大小
        """
        self.voxel_size = voxel_size
        self.clouds: Dict[str, o3d.geometry.PointCloud] = {}
        self.metadata: Dict[str, PointCloudMetadata] = {}
        self.change_maps: Dict[str, np.ndarray] = {}
        self.change_regions: List[ChangeRegion] = []
        self.registration_results: Dict[str, RegistrationResult] = {}
        
    def add_point_cloud(self,
                         identifier: str,
                         point_cloud,
                         metadata: Optional[PointCloudMetadata] = None):
        """
        添加点云到分析器
        
        Args:
            identifier: 点云标识符（如 '2023_base', '2024_monitor'）
            point_cloud: Open3D点云对象或numpy数组
            metadata: 点云元数据
        """
        if isinstance(point_cloud, np.ndarray):
            pcd = o3d.geometry.PointCloud()
            pcd.points = o3d.utility.Vector3dVector(point_cloud)
        else:
            pcd = point_cloud
        
        pcd_down = pcd.voxel_down_sample(self.voxel_size)
        
        if not pcd_down.has_normals():
            pcd_down.estimate_normals(
                search_param=o3d.geometry.KDTreeSearchParamHybrid(
                    radius=self.voxel_size * 2, max_nn=30
                )
            )
        
        self.clouds[identifier] = pcd_down
        
        if metadata is None:
            metadata = PointCloudMetadata(
                file_path=f"{identifier}.ply",
                scan_date=identifier.split('_')[0],
                scan_id=identifier,
                resolution=self.voxel_size,
                num_points=len(pcd_down.points)
            )
        self.metadata[identifier] = metadata
        
        print(f"已添加点云 '{identifier}': {len(pcd_down.points)} 个点")
    
    def preprocess_point_cloud(self, identifier: str) -> o3d.geometry.PointCloud:
        """
        预处理点云用于配准
        
        Args:
            identifier: 点云标识符
            
        Returns:
            预处理后的点云
        """
        if identifier not in self.clouds:
            raise ValueError(f"未找到点云 '{identifier}'")
            
        pcd = self.clouds[identifier]
        
        pcd_cl, _ = pcd.remove_statistical_outlier(nb_neighbors=20, std_ratio=2.0)
        
        return pcd_cl
    
    def register_point_clouds(self,
                               source_id: str,
                               target_id: str,
                               method: str = 'icp',
                               max_correspondence_distance: Optional[float] = None) -> RegistrationResult:
        """
        配准两个点云
        
        Args:
            source_id: 源点云标识符
            target_id: 目标点云标识符
            method: 配准方法 ('icp', 'gicp', 'color_icp')
            max_correspondence_distance: 最大对应距离
            
        Returns:
            配准结果
        """
        if max_correspondence_distance is None:
            max_correspondence_distance = self.voxel_size * 1.5
        
        source = self.preprocess_point_cloud(source_id)
        target = self.preprocess_point_cloud(target_id)
        
        print(f"正在配准 '{source_id}' -> '{target_id}'...")
        
        try:
            if method == 'gicp':
                result = o3d.pipelines.registration.registration_generalized_icp(
                    source, target, max_correspondence_distance,
                    estimation_method=o3d.pipelines.registration.TransformationEstimationForGeneralizedICP()
                )
            elif method == 'color_icp' and source.has_colors() and target.has_colors():
                result = o3d.pipelines.registration.registration_colored_icp(
                    source, target, max_correspondence_distance
                )
            else:
                result = o3d.pipelines.registration.registration_icp(
                    source, target, max_correspondence_distance,
                    estimation_method=o3d.pipelines.registration.TransformationEstimationPointToPlane()
                )
            
            reg_result = RegistrationResult(
                success=True,
                transformation=result.transformation,
                fitness=result.fitness,
                rmse=result.inlier_rmse,
                correspondences=len(result.correspondence_set)
            )
            
            key = f"{source_id}_to_{target_id}"
            self.registration_results[key] = reg_result
            
            print(f"  配准完成: 拟合度={result.fitness:.4f}, RMSE={result.inlier_rmse:.4f}")
            
            return reg_result
            
        except Exception as e:
            print(f"  配准失败: {e}")
            return RegistrationResult(
                success=False,
                transformation=np.eye(4),
                fitness=0,
                rmse=float('inf'),
                correspondences=0
            )
    
    def compute_cloud_distance(self,
                                source_id: str,
                                target_id: str,
                                transformation: Optional[np.ndarray] = None,
                                max_distance: float = 0.5) -> Tuple[np.ndarray, np.ndarray]:
        """
        计算两个点云之间的距离
        
        Args:
            source_id: 源点云标识符
            target_id: 目标点云标识符
            transformation: 可选的变换矩阵
            max_distance: 最大距离阈值
            
        Returns:
            (距离数组, 点坐标数组)
        """
        from scipy.spatial import KDTree
        
        source = self.clouds[source_id]
        target = self.clouds[target_id]
        
        if transformation is not None:
            source.transform(transformation)
        
        source_points = np.asarray(source.points)
        target_points = np.asarray(target.points)
        
        tree = KDTree(target_points)
        distances, indices = tree.query(source_points, k=1)
        
        distances = np.clip(distances, 0, max_distance)
        
        key = f"{source_id}_vs_{target_id}"
        self.change_maps[key] = distances
        
        return distances, source_points
    
    def detect_changes(self,
                        source_id: str,
                        target_id: str,
                        threshold_low: float = 0.01,
                        threshold_high: float = 0.05,
                        min_cluster_size: int = 50) -> Tuple[np.ndarray, List[ChangeRegion]]:
        """
        检测点云之间的变化
        
        Args:
            source_id: 源点云标识符
            target_id: 目标点云标识符
            threshold_low: 轻微变化阈值
            threshold_high: 显著变化阈值
            min_cluster_size: 最小聚类大小
            
        Returns:
            (变化标签数组, 变化区域列表)
        """
        key = f"{source_id}_vs_{target_id}"
        
        if key not in self.change_maps:
            reg_key = f"{source_id}_to_{target_id}"
            if reg_key in self.registration_results:
                transformation = self.registration_results[reg_key].transformation
                distances, points = self.compute_cloud_distance(source_id, target_id, transformation)
            else:
                distances, points = self.compute_cloud_distance(source_id, target_id)
        else:
            distances = self.change_maps[key]
            points = np.asarray(self.clouds[source_id].points)
        
        change_labels = np.zeros(len(points), dtype=int)
        
        erosion_mask = distances < -threshold_low
        deposition_mask = distances > threshold_low
        
        change_labels[erosion_mask] = -1
        change_labels[deposition_mask] = 1
        
        significant_mask = np.abs(distances) > threshold_high
        change_labels[significant_mask] = change_labels[significant_mask] * 2
        
        regions = self._cluster_change_regions(
            points, change_labels, distances, min_cluster_size
        )
        
        self.change_regions = regions
        
        return change_labels, regions
    
    def _cluster_change_regions(self,
                                 points: np.ndarray,
                                 change_labels: np.ndarray,
                                 distances: np.ndarray,
                                 min_cluster_size: int) -> List[ChangeRegion]:
        """
        聚类变化区域
        
        Args:
            points: 点坐标
            change_labels: 变化标签
            distances: 距离数组
            min_cluster_size: 最小聚类大小
            
        Returns:
            变化区域列表
        """
        from sklearn.cluster import DBSCAN
        
        regions = []
        region_id = 1
        
        for label_type in [-2, -1, 1, 2]:
            mask = change_labels == label_type
            if not np.any(mask):
                continue
                
            change_points = points[mask]
            change_distances = distances[mask]
            
            if len(change_points) < min_cluster_size:
                continue
            
            clustering = DBSCAN(eps=self.voxel_size * 3, min_samples=min_cluster_size)
            cluster_labels = clustering.fit_predict(change_points)
            
            for cluster_id in np.unique(cluster_labels):
                if cluster_id == -1:
                    continue
                    
                cluster_mask = cluster_labels == cluster_id
                cluster_points = change_points[cluster_mask]
                cluster_distances = change_distances[cluster_mask]
                
                if len(cluster_points) < min_cluster_size:
                    continue
                
                center = np.mean(cluster_points, axis=0)
                volume_change = np.sum(cluster_distances) * self.voxel_size ** 2
                area = len(cluster_points) * self.voxel_size ** 2
                max_def = np.max(np.abs(cluster_distances))
                avg_def = np.mean(np.abs(cluster_distances))
                
                if label_type < 0:
                    change_type = "erosion" if abs(label_type) == 1 else "significant_erosion"
                else:
                    change_type = "deposition" if label_type == 1 else "significant_deposition"
                
                confidence = min(0.95, 0.5 + avg_def / (threshold_high * 2))
                
                regions.append(ChangeRegion(
                    region_id=region_id,
                    center=center,
                    volume_change=volume_change * np.sign(label_type),
                    area=area,
                    max_deformation=max_def,
                    avg_deformation=avg_def,
                    change_type=change_type,
                    confidence=confidence,
                    points_count=len(cluster_points)
                ))
                
                region_id += 1
        
        return regions
    
    def compute_change_statistics(self, source_id: str, target_id: str) -> Dict:
        """
        计算变化统计信息
        
        Args:
            source_id: 源点云标识符
            target_id: 目标点云标识符
            
        Returns:
            统计信息字典
        """
        key = f"{source_id}_vs_{target_id}"
        
        if key not in self.change_maps:
            raise ValueError(f"未找到变化图，请先运行 detect_changes()")
            
        distances = self.change_maps[key]
        
        total_points = len(distances)
        changed_count = np.sum(np.abs(distances) > 0.01)
        positive_count = np.sum(distances > 0.01)
        negative_count = np.sum(distances < -0.01)
        
        positive_distances = distances[distances > 0.01]
        negative_distances = distances[distances < -0.01]
        
        stats = {
            'source_id': source_id,
            'target_id': target_id,
            'total_points': total_points,
            'changed_points': int(changed_count),
            'changed_percentage': changed_count / total_points * 100,
            'positive_changes': {
                'count': int(positive_count),
                'percentage': positive_count / total_points * 100,
                'mean_distance': float(np.mean(positive_distances)) if len(positive_distances) > 0 else 0,
                'max_distance': float(np.max(positive_distances)) if len(positive_distances) > 0 else 0,
                'total_volume': float(np.sum(positive_distances) * self.voxel_size ** 2)
            },
            'negative_changes': {
                'count': int(negative_count),
                'percentage': negative_count / total_points * 100,
                'mean_distance': float(np.mean(np.abs(negative_distances))) if len(negative_distances) > 0 else 0,
                'max_distance': float(np.max(np.abs(negative_distances))) if len(negative_distances) > 0 else 0,
                'total_volume': float(np.sum(np.abs(negative_distances)) * self.voxel_size ** 2)
            },
            'net_change': float(np.sum(distances) * self.voxel_size ** 2),
            'rmse': float(np.sqrt(np.mean(distances ** 2))),
            'change_regions': len(self.change_regions)
        }
        
        return stats
    
    def get_change_summary(self) -> Dict:
        """获取整体变化摘要"""
        summary = {
            'num_clouds': len(self.clouds),
            'num_registrations': len(self.registration_results),
            'num_change_maps': len(self.change_maps),
            'change_regions': len(self.change_regions),
            'clouds_info': {k: {'num_points': len(v.points)} for k, v in self.clouds.items()},
            'registration_results': {
                k: {'fitness': v.fitness, 'rmse': v.rmse}
                for k, v in self.registration_results.items()
            }
        }
        
        if self.change_regions:
            total_erosion = sum(r.volume_change for r in self.change_regions if 'erosion' in r.change_type)
            total_deposition = sum(r.volume_change for r in self.change_regions if 'deposition' in r.change_type)
            
            summary['change_summary'] = {
                'total_erosion_volume': total_erosion,
                'total_deposition_volume': total_deposition,
                'net_volume_change': total_erosion + total_deposition,
                'critical_regions': sum(1 for r in self.change_regions if 'significant' in r.change_type)
            }
        
        return summary
    
    def export_aligned_cloud(self, source_id: str, target_id: str, output_path: str):
        """
        导出对齐后的点云
        
        Args:
            source_id: 源点云标识符
            target_id: 目标点云标识符
            output_path: 输出路径
        """
        key = f"{source_id}_to_{target_id}"
        
        if key not in self.registration_results:
            print(f"警告: 未找到配准结果，使用原始点云")
            source = self.clouds[source_id]
        else:
            source = self.clouds[source_id]
            transformation = self.registration_results[key].transformation
            source = source.transform(transformation)
        
        o3d.io.write_point_cloud(output_path, source)
        print(f"已导出对齐点云到: {output_path}")

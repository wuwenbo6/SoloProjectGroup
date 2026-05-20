import numpy as np
import open3d as o3d
from typing import Tuple, List, Dict, Optional
from scipy.spatial import cKDTree
from sklearn.cluster import DBSCAN


class WearAnalyzer:
    def __init__(self):
        self.wear_regions = []
        self.wear_metrics = {}

    def compute_distance_to_reference(self, measured_pcd: o3d.geometry.PointCloud,
                                      reference_pcd: o3d.geometry.PointCloud,
                                      signed: bool = True,
                                      bilateral_filter: bool = True) -> np.ndarray:
        measured_points = np.asarray(measured_pcd.points)
        reference_points = np.asarray(reference_pcd.points)

        reference_tree = cKDTree(reference_points)
        distances, indices = reference_tree.query(measured_points, k=5)
        
        distances = np.mean(distances, axis=1)

        if signed and measured_pcd.has_normals() and reference_pcd.has_normals():
            measured_normals = np.asarray(measured_pcd.normals)
            reference_normals = np.asarray(reference_pcd.normals)
            
            vectors = measured_points - reference_points[indices[:, 0]]
            dot_products = np.einsum('ij,ij->i', vectors, reference_normals[indices[:, 0]])
            distances = np.sign(dot_products) * distances

        if bilateral_filter:
            distances = self._bilateral_filter_distances(measured_points, distances)
        
        return distances

    def _bilateral_filter_distances(self, points: np.ndarray, distances: np.ndarray,
                                    spatial_sigma: float = 0.02,
                                    range_sigma: float = 0.005) -> np.ndarray:
        filtered_distances = np.copy(distances)
        tree = cKDTree(points)
        
        for i in range(len(points)):
            idx = tree.query_ball_point(points[i], 2 * spatial_sigma)
            if len(idx) > 1:
                neighbors = points[idx]
                neighbor_distances = distances[idx]
                
                spatial_weights = np.exp(-np.sum((neighbors - points[i])**2, axis=1) / (2 * spatial_sigma**2))
                range_weights = np.exp(-(neighbor_distances - distances[i])**2 / (2 * range_sigma**2))
                
                total_weights = spatial_weights * range_weights
                total_weights /= np.sum(total_weights)
                
                filtered_distances[i] = np.sum(total_weights * neighbor_distances)
        
        return filtered_distances

    def detect_wear_regions(self, measured_pcd: o3d.geometry.PointCloud,
                            reference_pcd: o3d.geometry.PointCloud,
                            wear_threshold: float = -0.01,
                            min_cluster_size: int = 50,
                            eps: float = 0.05,
                            max_wear_depth: float = -0.1) -> Tuple[List[o3d.geometry.PointCloud], np.ndarray, np.ndarray]:
        distances = self.compute_distance_to_reference(measured_pcd, reference_pcd)
        
        valid_mask = (distances >= max_wear_depth) & (distances <= 0.05)
        
        wear_mask = (distances < wear_threshold) & valid_mask
        
        if not np.any(wear_mask):
            return [], distances, wear_mask
        
        wear_points = np.asarray(measured_pcd.points)[wear_mask]
        wear_distances = distances[wear_mask]
        
        clustering = DBSCAN(eps=eps, min_samples=10).fit(wear_points)
        labels = clustering.labels_
        
        unique_labels, counts = np.unique(labels[labels != -1], return_counts=True)
        
        wear_regions = []
        all_indices = np.where(wear_mask)[0]
        
        for label, count in zip(unique_labels, counts):
            if count >= min_cluster_size:
                cluster_mask = labels == label
                cluster_indices = all_indices[cluster_mask]
                cluster_distances = wear_distances[cluster_mask]
                
                mean_depth = np.mean(cluster_distances)
                std_depth = np.std(cluster_distances)
                
                if mean_depth < wear_threshold * 0.5 and std_depth < abs(wear_threshold):
                    region_pcd = measured_pcd.select_by_index(cluster_indices)
                    wear_regions.append(region_pcd)
        
        return wear_regions, distances, wear_mask

    def compute_wear_metrics(self, wear_regions: List[o3d.geometry.PointCloud],
                             distances: np.ndarray,
                             wear_mask: np.ndarray) -> Dict:
        wear_distances = distances[wear_mask]
        
        metrics = {
            'total_wear_area_points': np.sum(wear_mask),
            'total_points': len(wear_mask),
            'wear_ratio': np.sum(wear_mask) / len(wear_mask) if len(wear_mask) > 0 else 0,
            'num_wear_regions': len(wear_regions),
            'max_wear_depth': np.min(wear_distances) if np.any(wear_mask) else 0.0,
            'mean_wear_depth': np.mean(wear_distances) if np.any(wear_mask) else 0.0,
            'std_wear_depth': np.std(wear_distances) if np.any(wear_mask) else 0.0,
            'wear_volumes': [],
            'wear_areas': [],
            'region_metrics': []
        }

        if len(wear_regions) == 0:
            metrics['total_wear_volume'] = 0.0
            return metrics

        from sklearn.neighbors import KDTree
        all_wear_points = []
        region_start_indices = [0]
        
        for region in wear_regions:
            region_points = np.asarray(region.points)
            all_wear_points.append(region_points)
            region_start_indices.append(region_start_indices[-1] + len(region_points))
        
        all_wear_points = np.vstack(all_wear_points)
        tree = KDTree(all_wear_points)
        
        original_wear_points = np.asarray([np.asarray(pcd.points) for pcd in wear_regions], dtype=object)
        original_wear_indices = np.where(wear_mask)[0]

        for i, region in enumerate(wear_regions):
            region_points = np.asarray(region.points)
            
            distances_to_region, indices = tree.query(region_points, k=1)
            region_distances = wear_distances[indices.flatten()]
            
            region_metrics = {
                'region_id': i,
                'num_points': len(region_points),
                'max_depth': float(np.min(region_distances)),
                'mean_depth': float(np.mean(region_distances)),
                'std_depth': float(np.std(region_distances)),
                'volume': float(self._estimate_region_volume(region_points, region_distances)),
                'bounds': self._get_region_bounds(region_points)
            }
            
            metrics['region_metrics'].append(region_metrics)
            metrics['wear_volumes'].append(region_metrics['volume'])
            metrics['wear_areas'].append(len(region_points))

        metrics['total_wear_volume'] = float(np.sum(metrics['wear_volumes'])) if metrics['wear_volumes'] else 0.0

        return metrics

    def _estimate_region_volume(self, points: np.ndarray, depths: np.ndarray) -> float:
        if len(points) < 4:
            return 0.0
        
        try:
            from scipy.spatial import ConvexHull
            hull = ConvexHull(points[:, :2])
            area = hull.volume
            avg_depth = np.mean(np.abs(depths))
            volume = area * avg_depth
            return volume
        except:
            return 0.0

    def _get_region_bounds(self, points: np.ndarray) -> Dict:
        min_bound = np.min(points, axis=0)
        max_bound = np.max(points, axis=0)
        center = np.mean(points, axis=0)
        return {
            'min': min_bound.tolist(),
            'max': max_bound.tolist(),
            'center': center.tolist(),
            'size': (max_bound - min_bound).tolist()
        }

    def visualize_wear_regions(self, measured_pcd: o3d.geometry.PointCloud,
                               reference_pcd: o3d.geometry.PointCloud,
                               wear_regions: List[o3d.geometry.PointCloud],
                               distances: np.ndarray) -> List[o3d.geometry.PointCloud]:
        measured_colors = np.zeros((len(measured_pcd.points), 3))
        
        norm_dist = (distances - np.min(distances)) / (np.max(distances) - np.min(distances) + 1e-8)
        
        for i in range(len(measured_colors)):
            if distances[i] < -0.01:
                measured_colors[i] = [1, 0, 0]
            elif distances[i] < -0.005:
                measured_colors[i] = [1, 0.5, 0]
            elif distances[i] > 0.01:
                measured_colors[i] = [0, 0, 1]
            else:
                measured_colors[i] = [0.7, 0.7, 0.7]
        
        measured_colored = o3d.geometry.PointCloud(measured_pcd)
        measured_colored.colors = o3d.utility.Vector3dVector(measured_colors)
        
        reference_colored = o3d.geometry.PointCloud(reference_pcd)
        reference_colored.paint_uniform_color([0, 1, 0])
        
        return [measured_colored, reference_colored]

    def create_wear_heatmap(self, point_cloud: o3d.geometry.PointCloud,
                            distances: np.ndarray) -> o3d.geometry.PointCloud:
        colors = np.zeros((len(distances), 3))
        
        normalized = np.clip(distances, -0.05, 0.05)
        normalized = (normalized + 0.05) / 0.1
        
        for i, val in enumerate(normalized):
            if val < 0.3:
                colors[i] = [1, 0, 0]
            elif val < 0.5:
                colors[i] = [1, 1, 0]
            elif val < 0.7:
                colors[i] = [0, 1, 0]
            else:
                colors[i] = [0, 0, 1]
        
        heatmap_pcd = o3d.geometry.PointCloud(point_cloud)
        heatmap_pcd.colors = o3d.utility.Vector3dVector(colors)
        
        return heatmap_pcd

    def analyze_wear_without_reference(self, point_cloud: o3d.geometry.PointCloud,
                                       curvature_threshold: float = 0.1,
                                       depth_threshold: float = 0.01) -> Tuple[List[o3d.geometry.PointCloud], Dict]:
        if not point_cloud.has_normals():
            raise ValueError("Point cloud must have normals for reference-free analysis")
        
        points = np.asarray(point_cloud.points)
        normals = np.asarray(point_cloud.normals)
        
        curvatures = self._compute_curvature(point_cloud)
        
        high_curvature_mask = curvatures > curvature_threshold
        
        if not np.any(high_curvature_mask):
            return [], {'message': 'No significant wear regions detected'}
        
        high_curvature_points = points[high_curvature_mask]
        
        clustering = DBSCAN(eps=0.05, min_samples=10).fit(high_curvature_points)
        labels = clustering.labels_
        
        wear_regions = []
        all_indices = np.where(high_curvature_mask)[0]
        
        unique_labels, counts = np.unique(labels[labels != -1], return_counts=True)
        
        for label, count in zip(unique_labels, counts):
            if count >= 20:
                cluster_indices = all_indices[labels == label]
                region_pcd = point_cloud.select_by_index(cluster_indices)
                wear_regions.append(region_pcd)
        
        metrics = {
            'num_wear_regions': len(wear_regions),
            'curvature_threshold': curvature_threshold,
            'total_wear_points': np.sum(high_curvature_mask),
            'wear_ratio': np.sum(high_curvature_mask) / len(points)
        }
        
        return wear_regions, metrics

    def _compute_curvature(self, point_cloud: o3d.geometry.PointCloud) -> np.ndarray:
        points = np.asarray(point_cloud.points)
        normals = np.asarray(point_cloud.normals)
        
        curvatures = np.zeros(len(points))
        tree = cKDTree(points)
        
        for i in range(len(points)):
            _, idx = tree.query(points[i], k=20)
            neighbors = points[idx]
            centered = neighbors - np.mean(neighbors, axis=0)
            cov = np.dot(centered.T, centered) / len(neighbors)
            eigenvalues, _ = np.linalg.eigh(cov)
            curvatures[i] = eigenvalues[0] / (eigenvalues.sum() + 1e-8)
        
        return curvatures


__all__ = ['WearAnalyzer']

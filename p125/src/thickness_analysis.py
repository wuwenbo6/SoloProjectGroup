import numpy as np
import open3d as o3d
from typing import Tuple, Dict, Optional, List
from scipy.spatial import cKDTree
from scipy.interpolate import griddata


class ThicknessAnalyzer:
    def __init__(self):
        self.thickness_values = None
        self.thickness_stats = {}

    def compute_thickness_to_plane(self, point_cloud: o3d.geometry.PointCloud,
                                    plane_model: Optional[np.ndarray] = None,
                                    fit_plane: bool = True,
                                    absolute: bool = False) -> np.ndarray:
        if plane_model is None and fit_plane:
            try:
                plane_model, inliers = point_cloud.segment_plane(
                    distance_threshold=0.01, ransac_n=3, num_iterations=1000
                )
            except:
                points = np.asarray(point_cloud.points)
                center = np.mean(points, axis=0)
                plane_model = np.array([0, 0, 1, -center[2]])
        
        if plane_model is None:
            raise ValueError("Either provide a plane_model or set fit_plane=True")
        
        a, b, c, d = plane_model
        points = np.asarray(point_cloud.points)
        
        norm_factor = np.sqrt(a**2 + b**2 + c**2)
        if norm_factor < 1e-8:
            raise ValueError("Invalid plane model: normal vector magnitude too small")
        
        distances = (a * points[:, 0] + b * points[:, 1] + c * points[:, 2] + d) / norm_factor
        
        if absolute:
            distances = np.abs(distances)
        
        self.thickness_values = distances
        return distances

    def compute_thickness_between_point_clouds(self, outer_pcd: o3d.geometry.PointCloud,
                                               inner_pcd: o3d.geometry.PointCloud,
                                               direction: Optional[np.ndarray] = None,
                                               max_thickness: float = 0.5) -> np.ndarray:
        outer_points = np.asarray(outer_pcd.points)
        inner_points = np.asarray(inner_pcd.points)
        
        if len(outer_points) == 0 or len(inner_points) == 0:
            return np.zeros(len(outer_points))
        
        inner_tree = cKDTree(inner_points)
        
        if direction is not None:
            direction = direction / np.linalg.norm(direction)
            thickness_values = np.zeros(len(outer_points))
            
            for i, point in enumerate(outer_points):
                ray_direction = direction
                distances, indices = inner_tree.query(point, k=10)
                
                vectors = inner_points[indices] - point
                projections = np.dot(vectors, ray_direction)
                positive_proj = projections[projections > 1e-6]
                
                if len(positive_proj) > 0:
                    thickness_values[i] = np.min(positive_proj)
                else:
                    thickness_values[i] = np.min(distances)
        else:
            thickness_values, _ = inner_tree.query(outer_points, k=1)
        
        thickness_values = np.clip(thickness_values, 0, max_thickness)
        
        self.thickness_values = thickness_values
        return thickness_values

    def compute_thickness_using_normals(self, point_cloud: o3d.geometry.PointCloud,
                                        inner_surface_pcd: o3d.geometry.PointCloud) -> np.ndarray:
        if not point_cloud.has_normals():
            raise ValueError("Point cloud must have normals computed")
        
        points = np.asarray(point_cloud.points)
        normals = np.asarray(point_cloud.normals)
        inner_points = np.asarray(inner_surface_pcd.points)
        
        inner_tree = cKDTree(inner_points)
        
        thickness_values = np.zeros(len(points))
        
        for i, (point, normal) in enumerate(zip(points, normals)):
            ray_origin = point
            ray_direction = -normal
            
            distances, indices = inner_tree.query(ray_origin, k=20)
            
            vectors = inner_points[indices] - ray_origin
            projections = np.dot(vectors, ray_direction)
            
            valid_projections = projections[projections > 1e-6]
            
            if len(valid_projections) > 0:
                thickness_values[i] = np.min(valid_projections)
            else:
                thickness_values[i] = np.min(distances)
        
        self.thickness_values = thickness_values
        return thickness_values

    def compute_thickness_statistics(self, thickness_values: Optional[np.ndarray] = None) -> Dict:
        values = thickness_values if thickness_values is not None else self.thickness_values
        if values is None:
            raise ValueError("No thickness values computed")
        
        valid_values = values[values > 0]
        
        if len(valid_values) == 0:
            stats = {
                'mean_thickness': 0.0,
                'median_thickness': 0.0,
                'min_thickness': 0.0,
                'max_thickness': 0.0,
                'std_thickness': 0.0,
                'percentile_25': 0.0,
                'percentile_75': 0.0,
                'total_points': len(values),
                'valid_points': 0
            }
        else:
            stats = {
                'mean_thickness': float(np.mean(valid_values)),
                'median_thickness': float(np.median(valid_values)),
                'min_thickness': float(np.min(valid_values)),
                'max_thickness': float(np.max(valid_values)),
                'std_thickness': float(np.std(valid_values)),
                'percentile_25': float(np.percentile(valid_values, 25)),
                'percentile_75': float(np.percentile(valid_values, 75)),
                'total_points': int(len(values)),
                'valid_points': int(len(valid_values))
            }
        
        self.thickness_stats = stats
        return stats

    def find_thin_regions(self, point_cloud: o3d.geometry.PointCloud,
                          thickness_values: np.ndarray,
                          thickness_threshold: float,
                          min_cluster_size: int = 50,
                          eps: float = 0.05) -> Tuple[List[o3d.geometry.PointCloud], np.ndarray]:
        if len(thickness_values) != len(point_cloud.points):
            raise ValueError("thickness_values length must match point_cloud size")
        
        thin_mask = thickness_values < thickness_threshold
        
        if not np.any(thin_mask):
            return [], thin_mask
        
        thin_indices = np.where(thin_mask)[0]
        
        if len(thin_indices) < min_cluster_size:
            return [], thin_mask
        
        points = np.asarray(point_cloud.points)[thin_mask]
        
        from sklearn.cluster import DBSCAN
        clustering = DBSCAN(eps=eps, min_samples=10).fit(points)
        labels = clustering.labels_
        
        thin_regions = []
        unique_labels, counts = np.unique(labels[labels != -1], return_counts=True)
        
        for label, count in zip(unique_labels, counts):
            if count >= min_cluster_size:
                cluster_mask = labels == label
                region_indices = thin_indices[cluster_mask]
                region_pcd = point_cloud.select_by_index(region_indices)
                thin_regions.append(region_pcd)
        
        return thin_regions, thin_mask

    def create_thickness_heatmap(self, point_cloud: o3d.geometry.PointCloud,
                                 thickness_values: np.ndarray,
                                 color_map: str = 'jet') -> o3d.geometry.PointCloud:
        colors = np.zeros((len(thickness_values), 3))
        
        valid_mask = thickness_values > 0
        if np.any(valid_mask):
            valid_thickness = thickness_values[valid_mask]
            min_thick = np.min(valid_thickness)
            max_thick = np.max(valid_thickness)
            
            normalized = np.zeros_like(thickness_values)
            normalized[valid_mask] = (valid_thickness - min_thick) / (max_thick - min_thick + 1e-8)
            
            for i, val in enumerate(normalized):
                if not valid_mask[i]:
                    colors[i] = [0.5, 0.5, 0.5]
                elif val < 0.2:
                    colors[i] = [1, 0, 0]
                elif val < 0.4:
                    colors[i] = [1, 0.5, 0]
                elif val < 0.6:
                    colors[i] = [1, 1, 0]
                elif val < 0.8:
                    colors[i] = [0, 1, 0]
                else:
                    colors[i] = [0, 0, 1]
        else:
            colors[:] = [0.5, 0.5, 0.5]
        
        heatmap_pcd = o3d.geometry.PointCloud(point_cloud)
        heatmap_pcd.colors = o3d.utility.Vector3dVector(colors)
        
        return heatmap_pcd

    def generate_thickness_profile(self, thickness_values: np.ndarray,
                                   num_bins: int = 50) -> Dict:
        valid_values = thickness_values[thickness_values > 0]
        
        if len(valid_values) == 0:
            return {'histogram': [], 'bin_edges': []}
        
        hist, bin_edges = np.histogram(valid_values, bins=num_bins)
        bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2
        
        profile = {
            'histogram': hist.tolist(),
            'bin_edges': bin_edges.tolist(),
            'bin_centers': bin_centers.tolist(),
            'cumulative': np.cumsum(hist / len(valid_values)).tolist()
        }
        
        return profile

    def estimate_remaining_life(self, thickness_values: np.ndarray,
                                original_thickness: float,
                                wear_rate: float,
                                critical_thickness_ratio: float = 0.3) -> Dict:
        current_thickness = np.mean(thickness_values[thickness_values > 0])
        critical_thickness = original_thickness * critical_thickness_ratio
        
        worn_thickness = original_thickness - current_thickness
        remaining_thickness = current_thickness - critical_thickness
        
        if wear_rate > 0 and remaining_thickness > 0:
            remaining_life_units = remaining_thickness / wear_rate
        else:
            remaining_life_units = 0
        
        wear_percentage = (worn_thickness / original_thickness) * 100
        remaining_percentage = (remaining_thickness / original_thickness) * 100
        
        life_estimation = {
            'original_thickness': original_thickness,
            'current_thickness': current_thickness,
            'critical_thickness': critical_thickness,
            'worn_thickness': worn_thickness,
            'remaining_thickness': remaining_thickness,
            'wear_percentage': wear_percentage,
            'remaining_percentage': remaining_percentage,
            'wear_rate': wear_rate,
            'remaining_life_units': remaining_life_units,
            'status': self._get_life_status(remaining_percentage)
        }
        
        return life_estimation

    def _get_life_status(self, remaining_percentage: float) -> str:
        if remaining_percentage <= 0:
            return 'EXPIRED'
        elif remaining_percentage <= 10:
            return 'CRITICAL'
        elif remaining_percentage <= 25:
            return 'WARNING'
        elif remaining_percentage <= 50:
            return 'CAUTION'
        else:
            return 'GOOD'

    def compute_local_thickness_variation(self, point_cloud: o3d.geometry.PointCloud,
                                          thickness_values: np.ndarray,
                                          radius: float = 0.1) -> np.ndarray:
        points = np.asarray(point_cloud.points)
        tree = cKDTree(points)
        
        variations = np.zeros(len(points))
        
        for i, point in enumerate(points):
            indices = tree.query_ball_point(point, radius)
            if len(indices) > 1:
                local_thicknesses = thickness_values[indices]
                variations[i] = np.std(local_thicknesses)
            else:
                variations[i] = 0
        
        return variations

    def fit_thickness_surface(self, point_cloud: o3d.geometry.PointCloud,
                              thickness_values: np.ndarray,
                              grid_resolution: int = 100) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        points = np.asarray(point_cloud.points)
        
        x_min, x_max = np.min(points[:, 0]), np.max(points[:, 0])
        y_min, y_max = np.min(points[:, 1]), np.max(points[:, 1])
        
        xi = np.linspace(x_min, x_max, grid_resolution)
        yi = np.linspace(y_min, y_max, grid_resolution)
        xi, yi = np.meshgrid(xi, yi)
        
        zi = griddata(points[:, :2], thickness_values, (xi, yi), method='cubic')
        
        return xi, yi, zi


__all__ = ['ThicknessAnalyzer']

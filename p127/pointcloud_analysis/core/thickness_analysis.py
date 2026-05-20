import numpy as np
import open3d as o3d
from scipy.spatial import KDTree
from sklearn.cluster import DBSCAN
from typing import Tuple, Optional, List
from ..utils.helpers import point_cloud_to_array


class ThicknessAnalyzer:
    def __init__(self, point_cloud: Optional[o3d.geometry.PointCloud] = None):
        self.point_cloud = point_cloud
        self.thickness_values = None
        self.inner_surface_points = None
        self.outer_surface_points = None

    def set_point_cloud(self, point_cloud: o3d.geometry.PointCloud) -> None:
        self.point_cloud = point_cloud
        self.thickness_values = None
        self.inner_surface_points = None
        self.outer_surface_points = None

    def compute_thickness_by_normal(self, max_distance: float = 0.1, 
                                     min_distance: float = 0.001,
                                     num_samples: int = 100) -> np.ndarray:
        if self.point_cloud is None:
            raise ValueError("请先设置点云")

        points = point_cloud_to_array(self.point_cloud)
        normals = np.asarray(self.point_cloud.normals)
        if len(normals) == 0:
            self.point_cloud.estimate_normals()
            normals = np.asarray(self.point_cloud.normals)

        kdtree = KDTree(points)
        self.thickness_values = np.full(len(points), np.nan)

        for i, (point, normal) in enumerate(zip(points, normals)):
            best_thickness = np.nan
            
            for direction in [normal, -normal]:
                sample_distances = np.linspace(min_distance, max_distance, num_samples)
                sample_points = point + direction * sample_distances[:, np.newaxis]
                
                distances, indices = kdtree.query(sample_points, k=1)
                valid_mask = distances < min_distance * 2
                
                if np.any(valid_mask):
                    first_hit_idx = np.argmax(valid_mask)
                    thickness = sample_distances[first_hit_idx]
                    
                    if np.isnan(best_thickness) or thickness < best_thickness:
                        best_thickness = thickness
            
            self.thickness_values[i] = best_thickness

        valid_mask = ~np.isnan(self.thickness_values)
        if np.any(valid_mask):
            mean_thickness = np.mean(self.thickness_values[valid_mask])
            std_thickness = np.std(self.thickness_values[valid_mask])
            outlier_mask = self.thickness_values > mean_thickness + 3 * std_thickness
            self.thickness_values[outlier_mask] = np.nan

        return self.thickness_values

    def compute_thickness_bidirectional(self, max_distance: float = 0.1) -> np.ndarray:
        if self.point_cloud is None:
            raise ValueError("请先设置点云")

        points = point_cloud_to_array(self.point_cloud)
        normals = np.asarray(self.point_cloud.normals)
        if len(normals) == 0:
            self.point_cloud.estimate_normals()
            normals = np.asarray(self.point_cloud.normals)

        kdtree = KDTree(points)
        self.thickness_values = np.full(len(points), np.nan)

        for i, (point, normal) in enumerate(zip(points, normals)):
            thickness_forward = self._ray_march(point, normal, kdtree, max_distance)
            thickness_backward = self._ray_march(point, -normal, kdtree, max_distance)
            
            valid_thicknesses = []
            if not np.isnan(thickness_forward):
                valid_thicknesses.append(thickness_forward)
            if not np.isnan(thickness_backward):
                valid_thicknesses.append(thickness_backward)
            
            if len(valid_thicknesses) > 0:
                self.thickness_values[i] = np.mean(valid_thicknesses)

        return self.thickness_values

    def _ray_march(self, origin: np.ndarray, direction: np.ndarray, 
                   kdtree: KDTree, max_distance: float, step_size: float = 0.0005) -> float:
        direction = direction / (np.linalg.norm(direction) + 1e-10)
        current_point = origin.copy()
        
        for t in np.arange(step_size * 2, max_distance, step_size):
            current_point = origin + direction * t
            distance, _ = kdtree.query(current_point, k=1)
            
            if distance < step_size * 1.5:
                return t

        return np.nan

    def compute_thickness_by_surface_separation(self, axis: int = 2,
                                                 num_layers: int = 100,
                                                 min_points_per_layer: int = 5) -> np.ndarray:
        if self.point_cloud is None:
            raise ValueError("请先设置点云")

        points = point_cloud_to_array(self.point_cloud)
        coords = points[:, axis]

        min_coord, max_coord = coords.min(), coords.max()
        layer_thickness = (max_coord - min_coord) / num_layers

        self.thickness_values = np.full(len(points), np.nan)
        self.outer_surface_indices = []
        self.inner_surface_indices = []

        for i in range(num_layers):
            layer_min = min_coord + i * layer_thickness
            layer_max = layer_min + layer_thickness
            layer_mask = (coords >= layer_min) & (coords < layer_max)

            if np.sum(layer_mask) >= min_points_per_layer:
                layer_points = points[layer_mask]
                layer_center = np.mean(layer_points, axis=0)
                
                radial_vectors = layer_points - layer_center
                radial_distances = np.linalg.norm(radial_vectors, axis=1)
                
                sorted_indices = np.argsort(radial_distances)
                original_indices = np.where(layer_mask)[0]
                
                num_surface_points = max(3, len(sorted_indices) // 10)
                
                outer_indices = original_indices[sorted_indices[-num_surface_points:]]
                inner_indices = original_indices[sorted_indices[:num_surface_points]]
                
                self.outer_surface_indices.extend(outer_indices.tolist())
                self.inner_surface_indices.extend(inner_indices.tolist())
                
                layer_thickness_value = np.mean(radial_distances[sorted_indices[-num_surface_points:]]) - \
                                        np.mean(radial_distances[sorted_indices[:num_surface_points]])
                
                self.thickness_values[original_indices] = max(0, layer_thickness_value)

        return self.thickness_values

    def compute_thickness_between_surfaces(self, outer_points: np.ndarray,
                                           inner_points: np.ndarray) -> np.ndarray:
        if len(outer_points) == 0 or len(inner_points) == 0:
            return np.array([])
            
        kdtree_outer = KDTree(outer_points)
        distances, _ = kdtree_outer.query(inner_points)
        return distances

    def cluster_worn_areas(self, thickness_threshold: float = 0.005,
                           eps: float = 0.05, min_samples: int = 10) -> Tuple[List[np.ndarray], np.ndarray]:
        if self.thickness_values is None:
            self.compute_thickness_by_normal()

        points = point_cloud_to_array(self.point_cloud)
        valid_mask = ~np.isnan(self.thickness_values)
        
        valid_thickness = self.thickness_values[valid_mask]
        if len(valid_thickness) == 0:
            return [], np.zeros(len(points), dtype=bool)
        
        median_thickness = np.median(valid_thickness)
        relative_threshold = min(thickness_threshold, median_thickness * 0.7)
        
        thin_mask = self.thickness_values < relative_threshold
        combined_mask = valid_mask & thin_mask

        thin_points = points[combined_mask]

        if len(thin_points) < min_samples:
            return [], np.zeros(len(points), dtype=bool)

        clustering = DBSCAN(eps=eps, min_samples=min_samples).fit(thin_points)
        labels = clustering.labels_

        clusters = []
        cluster_mask = np.zeros(len(points), dtype=bool)

        for label in set(labels):
            if label != -1:
                cluster_points = thin_points[labels == label]
                clusters.append(cluster_points)
                original_indices = np.where(combined_mask)[0][labels == label]
                cluster_mask[original_indices] = True

        return clusters, cluster_mask

    def get_thickness_statistics(self) -> dict:
        if self.thickness_values is None:
            return {
                'num_points': 0,
                'num_valid_points': 0,
                'max_thickness': 0,
                'min_thickness': 0,
                'mean_thickness': 0,
                'median_thickness': 0,
                'std_thickness': 0,
                'percentile_25': 0,
                'percentile_75': 0
            }

        valid_thickness = self.thickness_values[~np.isnan(self.thickness_values)]
        
        if len(valid_thickness) == 0:
            return {
                'num_points': len(self.thickness_values),
                'num_valid_points': 0,
                'max_thickness': 0,
                'min_thickness': 0,
                'mean_thickness': 0,
                'median_thickness': 0,
                'std_thickness': 0,
                'percentile_25': 0,
                'percentile_75': 0
            }

        return {
            'num_points': len(self.thickness_values),
            'num_valid_points': len(valid_thickness),
            'max_thickness': float(np.max(valid_thickness)),
            'min_thickness': float(np.min(valid_thickness)),
            'mean_thickness': float(np.mean(valid_thickness)),
            'median_thickness': float(np.median(valid_thickness)),
            'std_thickness': float(np.std(valid_thickness)),
            'percentile_25': float(np.percentile(valid_thickness, 25)),
            'percentile_75': float(np.percentile(valid_thickness, 75))
        }

    def get_thickness_distribution(self, num_bins: int = 50) -> Tuple[np.ndarray, np.ndarray]:
        if self.thickness_values is None:
            return np.array([]), np.array([])

        valid_thickness = self.thickness_values[~np.isnan(self.thickness_values)]
        
        if len(valid_thickness) == 0:
            return np.array([]), np.array([])
            
        hist, bin_edges = np.histogram(valid_thickness, bins=num_bins)
        bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2

        return hist, bin_centers

    def create_thickness_colored_cloud(self) -> o3d.geometry.PointCloud:
        if self.thickness_values is None:
            raise ValueError("请先计算厚度值")

        points = point_cloud_to_array(self.point_cloud)
        valid_mask = ~np.isnan(self.thickness_values)

        pcd = o3d.geometry.PointCloud()
        pcd.points = o3d.utility.Vector3dVector(points)

        colors = np.full((len(points), 3), 0.5)
        valid_thickness = self.thickness_values[valid_mask]

        if len(valid_thickness) > 0:
            min_t = np.min(valid_thickness)
            max_t = np.max(valid_thickness)
            
            if max_t > min_t:
                normalized = (valid_thickness - min_t) / (max_t - min_t)
            else:
                normalized = np.ones_like(valid_thickness) * 0.5

            color_vals = np.zeros((len(valid_thickness), 3))
            for i, val in enumerate(normalized):
                if val < 0.25:
                    color_vals[i] = [1, 0, 0]
                elif val < 0.5:
                    color_vals[i] = [1, 0.5, 0]
                elif val < 0.75:
                    color_vals[i] = [1, 1, 0]
                else:
                    color_vals[i] = [0, 1, 0]
            
            colors[valid_mask] = color_vals

        pcd.colors = o3d.utility.Vector3dVector(colors)
        return pcd

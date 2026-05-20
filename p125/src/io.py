import os
import numpy as np
import open3d as o3d
from typing import Optional, Tuple, List


class PointCloudIO:
    SUPPORTED_FORMATS = ['.ply', '.pcd', '.xyz', '.xyzn', '.xyzrgb', '.pts']

    def __init__(self):
        self.point_cloud = None
        self.file_path = None
        self.file_format = None

    def load_point_cloud(self, file_path: str, format: Optional[str] = None) -> o3d.geometry.PointCloud:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        self.file_path = file_path
        _, ext = os.path.splitext(file_path)
        self.file_format = ext.lower()

        if self.file_format not in self.SUPPORTED_FORMATS:
            raise ValueError(f"Unsupported format: {self.file_format}. Supported formats: {self.SUPPORTED_FORMATS}")

        self.point_cloud = o3d.io.read_point_cloud(file_path)
        
        if self.point_cloud.is_empty():
            raise RuntimeError(f"Failed to load point cloud from {file_path}")

        return self.point_cloud

    def save_point_cloud(self, point_cloud: o3d.geometry.PointCloud, output_path: str, 
                         write_ascii: bool = False) -> bool:
        _, ext = os.path.splitext(output_path)
        ext = ext.lower()

        if ext not in self.SUPPORTED_FORMATS:
            raise ValueError(f"Unsupported format: {ext}. Supported formats: {self.SUPPORTED_FORMATS}")

        success = o3d.io.write_point_cloud(output_path, point_cloud, write_ascii=write_ascii)
        return success

    def get_point_cloud_info(self, point_cloud: Optional[o3d.geometry.PointCloud] = None) -> dict:
        pc = point_cloud if point_cloud is not None else self.point_cloud
        if pc is None:
            raise ValueError("No point cloud loaded")

        info = {
            "num_points": len(pc.points),
            "has_normals": pc.has_normals(),
            "has_colors": pc.has_colors(),
            "has_covariances": pc.has_covariances(),
            "bounds": self._get_bounds(pc),
            "center": self._get_center(pc)
        }
        return info

    def _get_bounds(self, point_cloud: o3d.geometry.PointCloud) -> Tuple[np.ndarray, np.ndarray]:
        points = np.asarray(point_cloud.points)
        min_bound = np.min(points, axis=0)
        max_bound = np.max(points, axis=0)
        return min_bound, max_bound

    def _get_center(self, point_cloud: o3d.geometry.PointCloud) -> np.ndarray:
        points = np.asarray(point_cloud.points)
        return np.mean(points, axis=0)

    def convert_to_array(self, point_cloud: Optional[o3d.geometry.PointCloud] = None) -> np.ndarray:
        pc = point_cloud if point_cloud is not None else self.point_cloud
        if pc is None:
            raise ValueError("No point cloud loaded")
        return np.asarray(pc.points)

    def create_from_array(self, points: np.ndarray, colors: Optional[np.ndarray] = None,
                          normals: Optional[np.ndarray] = None) -> o3d.geometry.PointCloud:
        pcd = o3d.geometry.PointCloud()
        pcd.points = o3d.utility.Vector3dVector(points)
        
        if colors is not None:
            pcd.colors = o3d.utility.Vector3dVector(colors)
        
        if normals is not None:
            pcd.normals = o3d.utility.Vector3dVector(normals)
        
        return pcd

    def generate_sample_point_cloud(self, num_points: int = 10000, 
                                    add_noise: bool = True,
                                    create_wear: bool = True) -> o3d.geometry.PointCloud:
        theta = np.random.uniform(0, 2*np.pi, num_points)
        phi = np.random.uniform(0, np.pi, num_points)
        r = 1.0

        x = r * np.sin(phi) * np.cos(theta)
        y = r * np.sin(phi) * np.sin(theta)
        z = r * np.cos(phi)

        points = np.column_stack([x, y, z])

        if add_noise:
            noise = np.random.normal(0, 0.01, points.shape)
            points += noise

        if create_wear:
            wear_center = np.array([0.5, 0.5, 0.5])
            wear_center = wear_center / np.linalg.norm(wear_center)
            distances = np.dot(points, wear_center)
            wear_mask = distances > 0.7
            
            wear_depth = 0.15 * (distances[wear_mask] - 0.7) / 0.3
            points[wear_mask] -= wear_depth[:, np.newaxis] * wear_center

        colors = np.ones((num_points, 3)) * 0.7
        if create_wear:
            colors[wear_mask] = [0.9, 0.3, 0.3]

        pcd = self.create_from_array(points, colors=colors)
        
        pcd.estimate_normals(search_param=o3d.geometry.KDTreeSearchParamHybrid(radius=0.1, max_nn=30))
        
        return pcd


__all__ = ['PointCloudIO']

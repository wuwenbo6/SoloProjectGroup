import numpy as np
import open3d as o3d
from scipy.spatial import KDTree
from typing import Tuple, Optional
from ..utils.helpers import point_cloud_to_array, downsample_point_cloud, compute_normals


class WearDetector:
    def __init__(self, reference_cloud: Optional[o3d.geometry.PointCloud] = None,
                 test_cloud: Optional[o3d.geometry.PointCloud] = None):
        self.reference_cloud = reference_cloud
        self.test_cloud = test_cloud
        self.registered_test_cloud = None
        self.distances = None
        self.signed_distances = None
        self.wear_mask = None
        self.registration_transform = np.eye(4)

    def set_point_clouds(self, reference_cloud: o3d.geometry.PointCloud,
                         test_cloud: o3d.geometry.PointCloud) -> None:
        self.reference_cloud = reference_cloud
        self.test_cloud = test_cloud
        self.registered_test_cloud = None
        self.distances = None
        self.signed_distances = None
        self.wear_mask = None

    def preprocess(self, voxel_size: float = 0.01) -> Tuple[o3d.geometry.PointCloud, o3d.geometry.PointCloud]:
        ref_down = downsample_point_cloud(self.reference_cloud, voxel_size)
        test_down = downsample_point_cloud(self.test_cloud, voxel_size)

        ref_down = compute_normals(ref_down, radius=voxel_size * 2, max_nn=30)
        test_down = compute_normals(test_down, radius=voxel_size * 2, max_nn=30)

        return ref_down, test_down

    def register_point_clouds(self, voxel_size: float = 0.01, max_iterations: int = 200000) -> np.ndarray:
        ref_down, test_down = self.preprocess(voxel_size)

        ref_center = np.mean(np.asarray(ref_down.points), axis=0)
        test_center = np.mean(np.asarray(test_down.points), axis=0)
        initial_transform = np.eye(4)
        initial_transform[:3, 3] = ref_center - test_center
        self.registration_transform = initial_transform

        threshold = voxel_size * 2.0
        result_icp = o3d.pipelines.registration.registration_icp(
            test_down, ref_down, threshold, self.registration_transform,
            o3d.pipelines.registration.TransformationEstimationPointToPoint(),
            o3d.pipelines.registration.ICPConvergenceCriteria(
                max_iteration=max_iterations,
                relative_fitness=1e-8,
                relative_rmse=1e-8
            )
        )

        self.registration_transform = result_icp.transformation
        self.registered_test_cloud = o3d.geometry.PointCloud(self.test_cloud)
        self.registered_test_cloud.transform(self.registration_transform)

        return self.registration_transform

    def compute_distances(self) -> np.ndarray:
        if self.registered_test_cloud is None:
            self.register_point_clouds()

        ref_points = point_cloud_to_array(self.reference_cloud)
        test_points = point_cloud_to_array(self.registered_test_cloud)

        kdtree = KDTree(ref_points)
        self.distances, indices = kdtree.query(test_points)

        ref_normals = np.asarray(self.reference_cloud.normals)
        if len(ref_normals) == 0:
            self.reference_cloud.estimate_normals()
            ref_normals = np.asarray(self.reference_cloud.normals)

        test_to_ref = ref_points[indices] - test_points
        dot_products = np.einsum('ij,ij->i', test_to_ref, ref_normals[indices])
        
        sign = np.where(dot_products < 0, -1, 1)
        self.signed_distances = self.distances * sign

        return self.distances

    def detect_wear(self, threshold: float = 0.005, wear_direction: str = 'negative') -> Tuple[np.ndarray, np.ndarray]:
        if self.signed_distances is None:
            self.compute_distances()

        if wear_direction == 'negative':
            wear_values = np.where(self.signed_distances < -threshold, 
                                   np.abs(self.signed_distances), 0)
        elif wear_direction == 'positive':
            wear_values = np.where(self.signed_distances > threshold, 
                                   self.signed_distances, 0)
        else:
            wear_values = np.where(np.abs(self.signed_distances) > threshold,
                                   np.abs(self.signed_distances), 0)

        self.wear_mask = wear_values > threshold

        return wear_values, self.wear_mask

    def get_wear_statistics(self) -> dict:
        if self.signed_distances is None or self.wear_mask is None:
            return {}

        wear_values = np.abs(self.signed_distances[self.wear_mask])

        return {
            'total_points': len(self.signed_distances),
            'wear_points': int(np.sum(self.wear_mask)),
            'wear_percentage': float(np.sum(self.wear_mask) / len(self.signed_distances) * 100),
            'max_wear': float(np.max(wear_values)) if len(wear_values) > 0 else 0,
            'min_wear': float(np.min(wear_values)) if len(wear_values) > 0 else 0,
            'mean_wear': float(np.mean(wear_values)) if len(wear_values) > 0 else 0,
            'std_wear': float(np.std(wear_values)) if len(wear_values) > 0 else 0
        }

    def get_wear_point_cloud(self, only_wear: bool = True) -> o3d.geometry.PointCloud:
        if self.registered_test_cloud is None or self.wear_mask is None:
            raise ValueError("请先运行磨损检测")

        indices = np.where(self.wear_mask)[0] if only_wear else np.arange(len(self.wear_mask))
        wear_cloud = self.registered_test_cloud.select_by_index(indices.tolist())

        if len(indices) > 0:
            distances_for_color = np.abs(self.signed_distances[indices])
            max_dist = np.max(distances_for_color) if np.max(distances_for_color) > 0 else 1
            colors = plt.cm.jet(distances_for_color / max_dist)
            wear_cloud.colors = o3d.utility.Vector3dVector(colors[:, :3])

        return wear_cloud

    def apply_wear_simulation(self, reference_cloud: o3d.geometry.PointCloud,
                              wear_depth: float = 0.02, wear_radius: float = 0.3,
                              wear_center: Optional[np.ndarray] = None) -> o3d.geometry.PointCloud:
        points = point_cloud_to_array(reference_cloud)
        if wear_center is None:
            wear_center = np.mean(points, axis=0)

        distances = np.linalg.norm(points - wear_center, axis=1)
        wear_mask = distances < wear_radius

        normals = np.asarray(reference_cloud.normals)
        if len(normals) == 0:
            reference_cloud.estimate_normals()
            normals = np.asarray(reference_cloud.normals)

        wear_factor = (1 - distances[wear_mask] / wear_radius) ** 2
        points[wear_mask] -= normals[wear_mask] * wear_depth * wear_factor[:, np.newaxis]

        worn_cloud = o3d.geometry.PointCloud()
        worn_cloud.points = o3d.utility.Vector3dVector(points)
        worn_cloud.normals = o3d.utility.Vector3dVector(normals)

        return worn_cloud


import matplotlib.pyplot as plt

import numpy as np
import open3d as o3d
from typing import Optional, Tuple
from sklearn.cluster import DBSCAN


class PointCloudPreprocessor:
    def __init__(self):
        pass

    def remove_outliers(self, point_cloud: o3d.geometry.PointCloud,
                        nb_neighbors: int = 20,
                        std_ratio: float = 2.0) -> Tuple[o3d.geometry.PointCloud, np.ndarray]:
        cl, ind = point_cloud.remove_statistical_outlier(nb_neighbors=nb_neighbors,
                                                         std_ratio=std_ratio)
        return cl, ind

    def remove_radius_outliers(self, point_cloud: o3d.geometry.PointCloud,
                               nb_points: int = 16,
                               radius: float = 0.05) -> Tuple[o3d.geometry.PointCloud, np.ndarray]:
        cl, ind = point_cloud.remove_radius_outlier(nb_points=nb_points, radius=radius)
        return cl, ind

    def downsample(self, point_cloud: o3d.geometry.PointCloud,
                   voxel_size: float = 0.01) -> o3d.geometry.PointCloud:
        downpcd = point_cloud.voxel_down_sample(voxel_size=voxel_size)
        return downpcd

    def compute_normals(self, point_cloud: o3d.geometry.PointCloud,
                        radius: float = 0.1,
                        max_nn: int = 30,
                        orient_normals: bool = True) -> o3d.geometry.PointCloud:
        point_cloud.estimate_normals(
            search_param=o3d.geometry.KDTreeSearchParamHybrid(radius=radius, max_nn=max_nn))
        
        if orient_normals:
            point_cloud.orient_normals_consistent_tangent_plane(k=10)
        
        return point_cloud

    def uniform_sample(self, point_cloud: o3d.geometry.PointCloud,
                       num_samples: int) -> o3d.geometry.PointCloud:
        if len(point_cloud.points) <= num_samples:
            return point_cloud
        
        indices = np.random.choice(len(point_cloud.points), num_samples, replace=False)
        sampled = point_cloud.select_by_index(indices)
        return sampled

    def cluster_points(self, point_cloud: o3d.geometry.PointCloud,
                       eps: float = 0.05,
                       min_samples: int = 10) -> Tuple[np.ndarray, int]:
        points = np.asarray(point_cloud.points)
        clustering = DBSCAN(eps=eps, min_samples=min_samples).fit(points)
        labels = clustering.labels_
        n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
        return labels, n_clusters

    def get_largest_cluster(self, point_cloud: o3d.geometry.PointCloud,
                            labels: np.ndarray) -> o3d.geometry.PointCloud:
        unique_labels, counts = np.unique(labels[labels != -1], return_counts=True)
        if len(unique_labels) == 0:
            return point_cloud
        
        largest_label = unique_labels[np.argmax(counts)]
        largest_cluster_indices = np.where(labels == largest_label)[0]
        largest_cluster = point_cloud.select_by_index(largest_cluster_indices)
        return largest_cluster

    def align_point_clouds(self, source: o3d.geometry.PointCloud,
                           target: o3d.geometry.PointCloud,
                           max_correspondence_distance: float = 0.05,
                           max_iteration: int = 2000) -> Tuple[o3d.geometry.PointCloud, np.ndarray]:
        source_centered = o3d.geometry.PointCloud(source)
        target_centered = o3d.geometry.PointCloud(target)
        
        source_center = source_centered.get_center()
        target_center = target_centered.get_center()
        
        translation = target_center - source_center
        trans_init = np.identity(4)
        trans_init[:3, 3] = translation
        
        source_centered.translate(translation)
        
        threshold = max_correspondence_distance
        
        if source_centered.has_normals() and target_centered.has_normals():
            estimation_method = o3d.pipelines.registration.TransformationEstimationPointToPlane()
        else:
            estimation_method = o3d.pipelines.registration.TransformationEstimationPointToPoint()
        
        reg_p2p = o3d.pipelines.registration.registration_icp(
            source_centered, target_centered, threshold, np.identity(4),
            estimation_method,
            o3d.pipelines.registration.ICPConvergenceCriteria(
                max_iteration=max_iteration,
                relative_fitness=1e-8,
                relative_rmse=1e-8
            ))
        
        final_transformation = trans_init @ reg_p2p.transformation
        
        source_transformed = source.transform(final_transformation)
        return source_transformed, final_transformation

    def crop_point_cloud(self, point_cloud: o3d.geometry.PointCloud,
                         min_bound: np.ndarray,
                         max_bound: np.ndarray) -> o3d.geometry.PointCloud:
        bbox = o3d.geometry.AxisAlignedBoundingBox(min_bound, max_bound)
        cropped = point_cloud.crop(bbox)
        return cropped

    def translate(self, point_cloud: o3d.geometry.PointCloud,
                  translation: np.ndarray) -> o3d.geometry.PointCloud:
        translated = point_cloud.translate(translation)
        return translated

    def scale(self, point_cloud: o3d.geometry.PointCloud,
              scale: float,
              center: Optional[np.ndarray] = None) -> o3d.geometry.PointCloud:
        if center is None:
            center = point_cloud.get_center()
        scaled = point_cloud.scale(scale, center=center)
        return scaled

    def rotate(self, point_cloud: o3d.geometry.PointCloud,
               rotation_matrix: np.ndarray,
               center: Optional[np.ndarray] = None) -> o3d.geometry.PointCloud:
        if center is None:
            center = point_cloud.get_center()
        rotated = point_cloud.rotate(rotation_matrix, center=center)
        return rotated

    def fit_plane(self, point_cloud: o3d.geometry.PointCloud,
                  distance_threshold: float = 0.01,
                  ransac_n: int = 3,
                  num_iterations: int = 1000) -> Tuple[np.ndarray, np.ndarray]:
        plane_model, inliers = point_cloud.segment_plane(distance_threshold=distance_threshold,
                                                         ransac_n=ransac_n,
                                                         num_iterations=num_iterations)
        [a, b, c, d] = plane_model
        return plane_model, inliers

    def clean_point_cloud(self, point_cloud: o3d.geometry.PointCloud,
                          voxel_size: float = 0.01,
                          remove_outliers: bool = True) -> o3d.geometry.PointCloud:
        cleaned = self.downsample(point_cloud, voxel_size=voxel_size)
        
        if remove_outliers:
            cleaned, _ = self.remove_outliers(cleaned)
        
        if not cleaned.has_normals():
            cleaned = self.compute_normals(cleaned)
        
        return cleaned


__all__ = ['PointCloudPreprocessor']

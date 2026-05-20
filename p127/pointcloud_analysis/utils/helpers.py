import numpy as np
import open3d as o3d


def point_cloud_to_array(point_cloud):
    return np.asarray(point_cloud.points)


def array_to_point_cloud(array):
    pcd = o3d.geometry.PointCloud()
    pcd.points = o3d.utility.Vector3dVector(array)
    return pcd


def downsample_point_cloud(point_cloud, voxel_size=0.01):
    return point_cloud.voxel_down_sample(voxel_size=voxel_size)


def compute_normals(point_cloud, radius=0.1, max_nn=30):
    point_cloud.estimate_normals(
        search_param=o3d.geometry.KDTreeSearchParamHybrid(radius=radius, max_nn=max_nn)
    )
    return point_cloud


def remove_outliers(point_cloud, nb_neighbors=20, std_ratio=2.0):
    cl, ind = point_cloud.remove_statistical_outlier(
        nb_neighbors=nb_neighbors, std_ratio=std_ratio
    )
    return point_cloud.select_by_index(ind)


def get_point_cloud_bounds(point_cloud):
    points = point_cloud_to_array(point_cloud)
    min_bound = np.min(points, axis=0)
    max_bound = np.max(points, axis=0)
    return min_bound, max_bound

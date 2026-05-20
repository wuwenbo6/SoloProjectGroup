import os
import numpy as np
import open3d as o3d
from typing import Optional, Tuple


class PointCloudImporter:
    SUPPORTED_FORMATS = ['.ply', '.pcd', '.xyz', '.pts', '.txt']

    def __init__(self):
        self.point_cloud = None
        self.file_path = None
        self.file_format = None

    def load(self, file_path: str) -> o3d.geometry.PointCloud:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")

        self.file_path = file_path
        _, ext = os.path.splitext(file_path)
        self.file_format = ext.lower()

        if self.file_format not in self.SUPPORTED_FORMATS:
            raise ValueError(f"不支持的文件格式: {ext}. 支持的格式: {self.SUPPORTED_FORMATS}")

        if self.file_format in ['.xyz', '.pts', '.txt']:
            self.point_cloud = self._load_ascii(file_path)
        else:
            self.point_cloud = o3d.io.read_point_cloud(file_path)

        if len(self.point_cloud.points) == 0:
            raise ValueError("点云数据为空")

        return self.point_cloud

    def _load_ascii(self, file_path: str) -> o3d.geometry.PointCloud:
        data = np.loadtxt(file_path, skiprows=0)
        if data.shape[1] < 3:
            raise ValueError("ASCII文件至少需要3列坐标数据")

        pcd = o3d.geometry.PointCloud()
        pcd.points = o3d.utility.Vector3dVector(data[:, :3])

        if data.shape[1] >= 6:
            colors = data[:, 3:6]
            if colors.max() > 1.0:
                colors = colors / 255.0
            pcd.colors = o3d.utility.Vector3dVector(colors)

        return pcd

    def get_info(self) -> dict:
        if self.point_cloud is None:
            return {}

        points = np.asarray(self.point_cloud.points)
        has_colors = len(self.point_cloud.colors) > 0
        has_normals = len(self.point_cloud.normals) > 0

        return {
            'file_path': self.file_path,
            'file_format': self.file_format,
            'num_points': len(points),
            'has_colors': has_colors,
            'has_normals': has_normals,
            'min_bounds': points.min(axis=0).tolist(),
            'max_bounds': points.max(axis=0).tolist(),
            'center': points.mean(axis=0).tolist()
        }

    def save(self, output_path: str, point_cloud: Optional[o3d.geometry.PointCloud] = None) -> None:
        pcd = point_cloud if point_cloud is not None else self.point_cloud
        if pcd is None:
            raise ValueError("没有可保存的点云数据")

        o3d.io.write_point_cloud(output_path, pcd)

    def generate_sample(self, num_points: int = 10000, shape: str = 'sphere') -> o3d.geometry.PointCloud:
        if shape == 'sphere':
            points = self._generate_sphere_points(num_points)
        elif shape == 'cube':
            points = self._generate_cube_points(num_points)
        elif shape == 'cylinder':
            points = self._generate_cylinder_points(num_points)
        else:
            raise ValueError(f"不支持的形状: {shape}")

        self.point_cloud = o3d.geometry.PointCloud()
        self.point_cloud.points = o3d.utility.Vector3dVector(points)
        return self.point_cloud

    def _generate_sphere_points(self, num_points: int, radius: float = 1.0) -> np.ndarray:
        phi = np.random.uniform(0, 2 * np.pi, num_points)
        costheta = np.random.uniform(-1, 1, num_points)
        u = np.random.uniform(0, 1, num_points)

        theta = np.arccos(costheta)
        r = radius * np.cbrt(u)

        x = r * np.sin(theta) * np.cos(phi)
        y = r * np.sin(theta) * np.sin(phi)
        z = r * np.cos(theta)

        return np.column_stack((x, y, z))

    def _generate_cube_points(self, num_points: int, size: float = 1.0) -> np.ndarray:
        return np.random.uniform(-size/2, size/2, (num_points, 3))

    def _generate_cylinder_points(self, num_points: int, radius: float = 0.5, height: float = 1.0) -> np.ndarray:
        theta = np.random.uniform(0, 2 * np.pi, num_points)
        r = radius * np.sqrt(np.random.uniform(0, 1, num_points))
        z = np.random.uniform(-height/2, height/2, num_points)

        x = r * np.cos(theta)
        y = r * np.sin(theta)

        return np.column_stack((x, y, z))

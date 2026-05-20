import numpy as np
import open3d as o3d
import os
from typing import Optional, Tuple, List
from pathlib import Path


class PointCloudImporter:
    """点云导入类，支持多种格式的点云文件导入"""
    
    SUPPORTED_FORMATS = {'.ply', '.pcd', '.xyz', '.pts', '.txt', '.las', '.laz'}
    
    def __init__(self):
        self.point_cloud = None
        self.file_path = None
        self.file_format = None
        
    def import_file(self, file_path: str) -> Tuple[bool, str]:
        """
        导入点云文件
        
        Args:
            file_path: 点云文件路径
            
        Returns:
            (success, message): 导入是否成功及消息
        """
        self.file_path = file_path
        path = Path(file_path)
        self.file_format = path.suffix.lower()
        
        if not path.exists():
            return False, f"文件不存在: {file_path}"
            
        if self.file_format not in self.SUPPORTED_FORMATS:
            return False, f"不支持的文件格式: {self.file_format}"
        
        try:
            if self.file_format in ['.ply', '.pcd']:
                return self._import_open3d(file_path)
            elif self.file_format in ['.xyz', '.pts', '.txt']:
                return self._import_text(file_path)
            elif self.file_format in ['.las', '.laz']:
                return self._import_las(file_path)
            else:
                return False, f"未实现的格式处理器: {self.file_format}"
        except Exception as e:
            return False, f"导入失败: {str(e)}"
    
    def _import_open3d(self, file_path: str) -> Tuple[bool, str]:
        """使用Open3D导入PLY/PCD格式文件"""
        self.point_cloud = o3d.io.read_point_cloud(file_path)
        if len(self.point_cloud.points) == 0:
            return False, "点云为空"
        return True, f"成功导入 {len(self.point_cloud.points)} 个点"
    
    def _import_text(self, file_path: str) -> Tuple[bool, str]:
        """导入文本格式的点云文件"""
        data = np.loadtxt(file_path, skiprows=0)
        if data.ndim == 1:
            data = data.reshape(1, -1)
        
        points = data[:, :3]
        self.point_cloud = o3d.geometry.PointCloud()
        self.point_cloud.points = o3d.utility.Vector3dVector(points)
        
        if data.shape[1] >= 6:
            colors = data[:, 3:6]
            if colors.max() > 1.0:
                colors = colors / 255.0
            self.point_cloud.colors = o3d.utility.Vector3dVector(colors)
        
        return True, f"成功导入 {len(points)} 个点"
    
    def _import_las(self, file_path: str) -> Tuple[bool, str]:
        """导入LAS/LAZ格式的点云文件"""
        try:
            import laspy
        except ImportError:
            return False, "需要安装laspy库: pip install laspy"
        
        las = laspy.read(file_path)
        points = np.vstack((las.x, las.y, las.z)).transpose()
        
        self.point_cloud = o3d.geometry.PointCloud()
        self.point_cloud.points = o3d.utility.Vector3dVector(points)
        
        if hasattr(las, 'red') and hasattr(las, 'green') and hasattr(las, 'blue'):
            colors = np.vstack((las.red, las.green, las.blue)).transpose()
            colors = colors / 65535.0
            self.point_cloud.colors = o3d.utility.Vector3dVector(colors)
        
        return True, f"成功导入 {len(points)} 个点"
    
    def get_point_cloud(self) -> Optional[o3d.geometry.PointCloud]:
        """获取导入的点云对象"""
        return self.point_cloud
    
    def get_point_cloud_array(self) -> Optional[np.ndarray]:
        """获取点云坐标数组"""
        if self.point_cloud is None:
            return None
        return np.asarray(self.point_cloud.points)
    
    def get_colors(self) -> Optional[np.ndarray]:
        """获取点云颜色数组"""
        if self.point_cloud is None or not self.point_cloud.has_colors():
            return None
        return np.asarray(self.point_cloud.colors)
    
    def get_normals(self) -> Optional[np.ndarray]:
        """获取点云法向量"""
        if self.point_cloud is None or not self.point_cloud.has_normals():
            return None
        return np.asarray(self.point_cloud.normals)
    
    def compute_normals(self, radius: float = 0.1, max_nn: int = 30):
        """计算点云法向量"""
        if self.point_cloud is not None:
            self.point_cloud.estimate_normals(
                search_param=o3d.geometry.KDTreeSearchParamHybrid(
                    radius=radius, max_nn=max_nn
                )
            )
    
    def get_statistics(self) -> dict:
        """获取点云统计信息"""
        if self.point_cloud is None:
            return {}
        
        points = self.get_point_cloud_array()
        stats = {
            'num_points': len(points),
            'file_path': self.file_path,
            'file_format': self.file_format,
            'has_colors': self.point_cloud.has_colors(),
            'has_normals': self.point_cloud.has_normals(),
            'bbox_min': np.min(points, axis=0).tolist(),
            'bbox_max': np.max(points, axis=0).tolist(),
            'center': np.mean(points, axis=0).tolist(),
            'extent': (np.max(points, axis=0) - np.min(points, axis=0)).tolist()
        }
        return stats
    
    def downsample(self, voxel_size: float = 0.05):
        """点云下采样"""
        if self.point_cloud is not None:
            self.point_cloud = self.point_cloud.voxel_down_sample(voxel_size)
    
    def remove_outliers(self, nb_neighbors: int = 20, std_ratio: float = 2.0):
        """移除离群点"""
        if self.point_cloud is not None:
            cl, ind = self.point_cloud.remove_statistical_outlier(
                nb_neighbors=nb_neighbors, std_ratio=std_ratio
            )
            self.point_cloud = cl
    
    def save_point_cloud(self, output_path: str):
        """保存点云到文件"""
        if self.point_cloud is not None:
            o3d.io.write_point_cloud(output_path, self.point_cloud)

import numpy as np
import open3d as o3d
from scipy.spatial import KDTree
from scipy import stats
from typing import Optional, Tuple, Dict, List
from dataclasses import dataclass
from enum import Enum


class ThicknessMethod(Enum):
    """厚度计算方法枚举"""
    NORMAL_PROJECTION = "normal_projection"
    OPPOSITE_SEARCH = "opposite_search"
    RAY_CASTING = "ray_casting"
    MESH_DISTANCE = "mesh_distance"


@dataclass
class ThicknessResult:
    """厚度分析结果数据类"""
    point_index: int
    thickness: float
    confidence: float
    direction: np.ndarray
    exit_point: Optional[np.ndarray]


class ThicknessAnalyzer:
    """点云厚度分析类"""
    
    def __init__(self):
        self.point_cloud: Optional[o3d.geometry.PointCloud] = None
        self.thickness_results: List[ThicknessResult] = []
        self.thickness_values: Optional[np.ndarray] = None
        
    def set_point_cloud(self, pcd: o3d.geometry.PointCloud):
        """设置待分析点云"""
        self.point_cloud = pcd
        
    def compute_thickness(self,
                          method: str = 'normal_projection',
                          max_thickness: float = 100.0,
                          min_thickness: float = 0.1,
                          search_radius: float = 0.5,
                          normal_k: int = 30) -> Tuple[np.ndarray, np.ndarray]:
        """
        计算点云厚度
        
        Args:
            method: 计算方法 ('normal_projection', 'opposite_search', 'ray_casting', 'mesh_distance')
            max_thickness: 最大厚度阈值
            min_thickness: 最小厚度阈值
            search_radius: 搜索半径
            normal_k: 法向量计算邻域大小
            
        Returns:
            (thickness_values, confidence_values): 厚度数组和置信度数组
        """
        if self.point_cloud is None:
            raise ValueError("未设置点云数据")
            
        points = np.asarray(self.point_cloud.points)
        n_points = len(points)
        
        if not self.point_cloud.has_normals():
            self.point_cloud.estimate_normals(
                search_param=o3d.geometry.KDTreeSearchParamKNN(normal_k)
            )
            self.point_cloud.orient_normals_consistent_tangent_plane(k=10)
            
        normals = np.asarray(self.point_cloud.normals)
        
        self.thickness_values = np.zeros(n_points)
        confidence_values = np.zeros(n_points)
        
        if method == 'normal_projection':
            self._compute_normal_projection(points, normals, max_thickness, min_thickness)
        elif method == 'opposite_search':
            self._compute_opposite_search(points, normals, max_thickness, min_thickness, search_radius)
        elif method == 'ray_casting':
            self._compute_ray_casting(points, normals, max_thickness, min_thickness)
        elif method == 'mesh_distance':
            self._compute_mesh_distance(points, max_thickness, min_thickness)
        else:
            raise ValueError(f"未知的厚度计算方法: {method}")
        
        confidence_values = self._calculate_confidence(points, normals)
        
        return self.thickness_values, confidence_values
    
    def _compute_normal_projection(self,
                                    points: np.ndarray,
                                    normals: np.ndarray,
                                    max_thickness: float,
                                    min_thickness: float):
        """基于法向量投影的厚度计算 - 简化且更可靠的版本"""
        tree = KDTree(points)
        n_points = len(points)
        
        print(f"正在计算 {n_points} 个点的厚度...")
        
        for i in range(n_points):
            origin = points[i]
            normal = normals[i]
            
            if np.linalg.norm(normal) < 0.1:
                self.thickness_values[i] = 0.0
                continue
            
            normal = normal / np.linalg.norm(normal)
            
            thickness = self._find_thickness_along_direction(
                origin, -normal, tree, max_thickness, min_thickness
            )
            
            if thickness < min_thickness:
                thickness = self._find_thickness_along_direction(
                    origin, normal, tree, max_thickness, min_thickness
                )
            
            self.thickness_values[i] = thickness
            
            if i > 0 and i % 1000 == 0:
                print(f"  已处理 {i}/{n_points} 个点...")
    
    def _find_thickness_along_direction(self,
                                         origin: np.ndarray,
                                         direction: np.ndarray,
                                         tree: KDTree,
                                         max_thickness: float,
                                         min_thickness: float) -> float:
        """沿指定方向查找厚度"""
        step = max_thickness / 100.0
        best_thickness = 0.0
        min_distance = float('inf')
        
        for t in np.arange(min_thickness, max_thickness, step):
            test_point = origin + direction * t
            distance, _ = tree.query(test_point, k=1)
            
            if distance < min_distance:
                min_distance = distance
                best_thickness = t
            
            if distance < step * 2:
                return t
        
        return best_thickness if min_distance < step * 5 else 0.0
    
    def _compute_opposite_search(self,
                                  points: np.ndarray,
                                  normals: np.ndarray,
                                  max_thickness: float,
                                  min_thickness: float,
                                  search_radius: float):
        """基于对面搜索的厚度计算"""
        tree = KDTree(points)
        n_points = len(points)
        
        print(f"正在计算 {n_points} 个点的厚度...")
        
        for i in range(n_points):
            origin = points[i]
            normal = normals[i]
            
            if np.linalg.norm(normal) < 0.1:
                self.thickness_values[i] = 0.0
                continue
            
            normal = normal / np.linalg.norm(normal)
            
            search_directions = [normal, -normal]
            valid_thicknesses = []
            
            for direction in search_directions:
                search_center = origin + direction * (max_thickness / 2)
                indices = tree.query_ball_point(search_center, max_thickness * 0.6)
                
                if len(indices) < 3:
                    continue
                
                candidate_points = points[indices]
                candidate_normals = normals[indices]
                
                dot_products = np.abs(np.dot(candidate_normals, -direction))
                opposite_mask = dot_products > 0.5
                
                if np.sum(opposite_mask) < 2:
                    continue
                
                opposite_points = candidate_points[opposite_mask]
                
                projections = np.dot(opposite_points - origin, direction)
                valid_projections = projections[(projections > min_thickness) & 
                                                (projections < max_thickness)]
                
                if len(valid_projections) > 0:
                    valid_thicknesses.append(np.median(valid_projections))
            
            if valid_thicknesses:
                self.thickness_values[i] = np.min(valid_thicknesses)
            else:
                self.thickness_values[i] = 0.0
            
            if i > 0 and i % 1000 == 0:
                print(f"  已处理 {i}/{n_points} 个点...")
    
    def _compute_ray_casting(self,
                              points: np.ndarray,
                              normals: np.ndarray,
                              max_thickness: float,
                              min_thickness: float):
        """基于光线投射的厚度计算"""
        try:
            mesh = self._point_cloud_to_mesh(self.point_cloud)
            if mesh is None:
                self._compute_normal_projection(points, normals, max_thickness, min_thickness)
                return
            
            mesh = o3d.t.geometry.TriangleMesh.from_legacy(mesh)
            scene = o3d.t.geometry.RaycastingScene()
            scene.add_triangles(mesh)
            
            n_points = len(points)
            print(f"正在计算 {n_points} 个点的厚度...")
            
            for i in range(n_points):
                origin = points[i]
                normal = normals[i]
                
                if np.linalg.norm(normal) < 0.1:
                    self.thickness_values[i] = 0.0
                    continue
                
                normal = normal / np.linalg.norm(normal)
                
                rays = []
                for direction in [normal, -normal]:
                    rays.append(np.concatenate([origin, direction]))
                
                rays_tensor = o3d.core.Tensor(rays, dtype=o3d.core.float32)
                ans = scene.cast_rays(rays_tensor)
                distances = ans['t_hit'].numpy()
                
                valid_distances = []
                for d in distances:
                    if d != float('inf') and min_thickness < d < max_thickness:
                        valid_distances.append(d)
                
                if valid_distances:
                    self.thickness_values[i] = np.min(valid_distances)
                else:
                    self.thickness_values[i] = 0.0
                
                if i > 0 and i % 1000 == 0:
                    print(f"  已处理 {i}/{n_points} 个点...")
                    
        except Exception as e:
            print(f"光线投射方法失败 ({str(e)})，切换到法向量投影方法...")
            self._compute_normal_projection(points, normals, max_thickness, min_thickness)
    
    def _compute_mesh_distance(self,
                                points: np.ndarray,
                                max_thickness: float,
                                min_thickness: float):
        """基于网格距离的厚度计算 - 使用泊松重建"""
        print("正在重建网格...")
        mesh = self._point_cloud_to_mesh(self.point_cloud)
        
        if mesh is None:
            print("网格重建失败，使用简化方法...")
            self._compute_simple_thickness(points, max_thickness, min_thickness)
            return
        
        try:
            mesh = o3d.t.geometry.TriangleMesh.from_legacy(mesh)
            scene = o3d.t.geometry.RaycastingScene()
            scene.add_triangles(mesh)
            
            print("计算有符号距离...")
            distances = scene.compute_signed_distance(o3d.core.Tensor(points, dtype=o3d.core.float32))
            distances = distances.numpy()
            
            self.thickness_values = np.abs(distances) * 2
            
            invalid_mask = (self.thickness_values < min_thickness) | (self.thickness_values > max_thickness)
            self.thickness_values[invalid_mask] = 0.0
            
        except Exception as e:
            print(f"网格距离方法失败 ({str(e)})，使用简化方法...")
            self._compute_simple_thickness(points, max_thickness, min_thickness)
    
    def _compute_simple_thickness(self,
                                   points: np.ndarray,
                                   max_thickness: float,
                                   min_thickness: float):
        """简化的厚度计算方法 - 基于局部点云分布"""
        print("使用简化厚度计算...")
        tree = KDTree(points)
        n_points = len(points)
        
        for i in range(n_points):
            distances, indices = tree.query(points[i], k=50)
            avg_distance = np.mean(distances[1:])
            
            local_points = points[indices]
            centered = local_points - np.mean(local_points, axis=0)
            cov = np.cov(centered.T)
            eigenvalues, _ = np.linalg.eig(cov)
            eigenvalues = np.sort(eigenvalues)[::-1]
            
            if eigenvalues[0] > 0:
                thickness_est = np.sqrt(eigenvalues[2]) * 5
                if min_thickness < thickness_est < max_thickness:
                    self.thickness_values[i] = thickness_est
                else:
                    self.thickness_values[i] = 0.0
            else:
                self.thickness_values[i] = 0.0
    
    def _point_cloud_to_mesh(self, pcd: o3d.geometry.PointCloud) -> Optional[o3d.geometry.TriangleMesh]:
        """将点云转换为网格 - 更可靠的版本"""
        try:
            pcd_copy = o3d.geometry.PointCloud(pcd)
            
            if not pcd_copy.has_normals():
                pcd_copy.estimate_normals()
            
            pcd_copy.orient_normals_consistent_tangent_plane(k=15)
            
            with o3d.utility.VerbosityContextManager(o3d.utility.VerbosityLevel.Error):
                mesh, densities = o3d.geometry.TriangleMesh.create_from_point_cloud_poisson(
                    pcd_copy, depth=8, width=0, scale=1.1, linear_fit=False
                )
            
            bbox = pcd_copy.get_axis_aligned_bounding_box()
            mesh = mesh.crop(bbox)
            
            mesh.remove_duplicated_triangles()
            mesh.remove_duplicated_vertices()
            mesh.remove_degenerate_triangles()
            
            return mesh
        except Exception as e:
            print(f"网格重建警告: {e}")
            return None
    
    def _calculate_confidence(self, points: np.ndarray, normals: np.ndarray) -> np.ndarray:
        """计算每个点厚度的置信度"""
        n_points = len(points)
        confidence = np.ones(n_points) * 0.5
        
        valid_mask = self.thickness_values > 0
        valid_thickness = self.thickness_values[valid_mask]
        
        if len(valid_thickness) > 10:
            median_t = np.median(valid_thickness)
            mad = np.median(np.abs(valid_thickness - median_t))
            
            for i in range(n_points):
                if self.thickness_values[i] > 0:
                    deviation = abs(self.thickness_values[i] - median_t) / (mad + 1e-6)
                    confidence[i] = max(0.1, 1.0 - deviation * 0.1)
                else:
                    confidence[i] = 0.1
        
        return confidence
    
    def get_thickness_statistics(self) -> Dict:
        """获取厚度统计信息"""
        if self.thickness_values is None:
            return {}
            
        valid_thickness = self.thickness_values[self.thickness_values > 0]
        
        if len(valid_thickness) == 0:
            return {
                'mean': 0,
                'median': 0,
                'min': 0,
                'max': 0,
                'std': 0,
                'percentile_25': 0,
                'percentile_75': 0,
                'valid_points': 0,
                'total_points': len(self.thickness_values)
            }
            
        return {
            'mean': float(np.mean(valid_thickness)),
            'median': float(np.median(valid_thickness)),
            'min': float(np.min(valid_thickness)),
            'max': float(np.max(valid_thickness)),
            'std': float(np.std(valid_thickness)),
            'percentile_25': float(np.percentile(valid_thickness, 25)),
            'percentile_75': float(np.percentile(valid_thickness, 75)),
            'valid_points': int(len(valid_thickness)),
            'total_points': int(len(self.thickness_values))
        }
    
    def analyze_thickness_distribution(self, bins: int = 20) -> Dict:
        """分析厚度分布"""
        if self.thickness_values is None:
            return {}
            
        valid_thickness = self.thickness_values[self.thickness_values > 0]
        
        if len(valid_thickness) == 0:
            return {}
            
        hist, bin_edges = np.histogram(valid_thickness, bins=bins)
        
        return {
            'histogram': hist.tolist(),
            'bin_edges': bin_edges.tolist(),
            'distribution_type': self._identify_distribution_type(valid_thickness)
        }
    
    def _identify_distribution_type(self, data: np.ndarray) -> str:
        """识别数据分布类型"""
        if len(data) < 20:
            return "insufficient_data"
            
        try:
            stat, p_normal = stats.normaltest(data)
            
            if p_normal > 0.05:
                return "normal"
            else:
                skewness = stats.skew(data)
                if abs(skewness) < 0.5:
                    return "approximately_symmetric"
                elif skewness > 0:
                    return "right_skewed"
                else:
                    return "left_skewed"
        except:
            return "unknown"
    
    def find_thin_areas(self, threshold_ratio: float = 0.5) -> Tuple[np.ndarray, np.ndarray]:
        """找出薄区域"""
        if self.thickness_values is None:
            return np.array([]), np.array([])
            
        valid_thickness = self.thickness_values[self.thickness_values > 0]
        if len(valid_thickness) == 0:
            return np.array([]), np.array([])
            
        median_thickness = np.median(valid_thickness)
        threshold = median_thickness * threshold_ratio
        
        thin_mask = (self.thickness_values > 0) & (self.thickness_values < threshold)
        thin_indices = np.where(thin_mask)[0]
        
        return thin_indices, self.thickness_values[thin_indices]
    
    def find_thick_areas(self, threshold_ratio: float = 1.5) -> Tuple[np.ndarray, np.ndarray]:
        """找出厚区域"""
        if self.thickness_values is None:
            return np.array([]), np.array([])
            
        valid_thickness = self.thickness_values[self.thickness_values > 0]
        if len(valid_thickness) == 0:
            return np.array([]), np.array([])
            
        median_thickness = np.median(valid_thickness)
        threshold = median_thickness * threshold_ratio
        
        thick_mask = (self.thickness_values > 0) & (self.thickness_values > threshold)
        thick_indices = np.where(thick_mask)[0]
        
        return thick_indices, self.thickness_values[thick_indices]
    
    def get_colored_point_cloud(self, colormap: str = 'jet') -> o3d.geometry.PointCloud:
        """获取按厚度着色的点云"""
        if self.thickness_values is None:
            return self.point_cloud
            
        pcd = o3d.geometry.PointCloud()
        pcd.points = self.point_cloud.points
        
        valid_thickness = self.thickness_values[self.thickness_values > 0]
        if len(valid_thickness) == 0:
            colors = np.zeros((len(self.thickness_values), 3))
            colors[:] = [0.5, 0.5, 0.5]
        else:
            min_t = np.min(valid_thickness)
            max_t = np.max(valid_thickness)
            
            norm_thickness = (self.thickness_values - min_t) / (max_t - min_t + 1e-6)
            norm_thickness = np.clip(norm_thickness, 0, 1)
            
            from matplotlib import cm
            cmap = cm.get_cmap(colormap)
            colors = cmap(norm_thickness)[:, :3]
            
            zero_mask = self.thickness_values == 0
            colors[zero_mask] = [0.5, 0.5, 0.5]
            
        pcd.colors = o3d.utility.Vector3dVector(colors)
        
        return pcd

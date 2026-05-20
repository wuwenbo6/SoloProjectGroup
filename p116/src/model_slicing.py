import numpy as np
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from pathlib import Path
import warnings

try:
    import open3d as o3d
    OPEN3D_AVAILABLE = True
except ImportError:
    OPEN3D_AVAILABLE = False
    warnings.warn("Open3D not available, some functions will be limited")


@dataclass
class SliceProfile:
    """切片轮廓数据类"""
    profile_id: int
    points: np.ndarray
    thickness_values: np.ndarray
    defect_values: np.ndarray
    bounding_box: Tuple[float, float, float, float]
    center_point: np.ndarray
    area: float
    perimeter: float


@dataclass
class SliceResult:
    """切片结果数据类"""
    slice_index: int
    slice_position: float
    slice_normal: np.ndarray
    thickness: float
    profiles: List[SliceProfile]
    point_count: int
    stats: Dict


@dataclass
class CrossSectionAnalysis:
    """横截面分析结果"""
    max_thickness: float
    min_thickness: float
    avg_thickness: float
    thickness_variance: float
    defect_density: float
    profile_smoothness: float
    symmetry_score: float


class PointCloudSlicer:
    """
    点云切片类
    
    将3D点云按指定方向和间隔进行切片，
    生成2D截面数据用于分析和导出
    """
    
    AXIS_VECTORS = {
        'x': np.array([1, 0, 0]),
        'y': np.array([0, 1, 0]),
        'z': np.array([0, 0, 1])
    }
    
    def __init__(self, point_cloud, slice_thickness: float = 0.05):
        """
        初始化点云切片器
        
        Args:
            point_cloud: Open3D点云对象或numpy数组
            slice_thickness: 切片厚度
        """
        if isinstance(point_cloud, np.ndarray):
            self.pcd = o3d.geometry.PointCloud()
            self.pcd.points = o3d.utility.Vector3dVector(point_cloud)
        else:
            self.pcd = point_cloud
        
        self.slice_thickness = slice_thickness
        self.points = np.asarray(self.pcd.points)
        
        self.thickness_values = None
        self.defect_labels = None
        
        self.slices: List[SliceResult] = []
        
        print(f"初始化切片器: {len(self.points)} 个点, 切片厚度: {slice_thickness}")
    
    def set_thickness_values(self, thickness_values: np.ndarray):
        """设置厚度值数组"""
        if len(thickness_values) != len(self.points):
            raise ValueError(f"厚度值数量 ({len(thickness_values)}) 与点云数量 ({len(self.points)}) 不匹配")
        self.thickness_values = thickness_values
    
    def set_defect_labels(self, defect_labels: np.ndarray):
        """设置缺损标签数组"""
        if len(defect_labels) != len(self.points):
            raise ValueError(f"缺损标签数量 ({len(defect_labels)}) 与点云数量 ({len(self.points)}) 不匹配")
        self.defect_labels = defect_labels
    
    def get_bounding_box(self) -> Tuple[np.ndarray, np.ndarray]:
        """
        获取点云包围盒
        
        Returns:
            (最小点, 最大点)
        """
        min_point = np.min(self.points, axis=0)
        max_point = np.max(self.points, axis=0)
        return min_point, max_point
    
    def calculate_slice_count(self, axis: str) -> int:
        """
        计算沿指定轴的切片数量
        
        Args:
            axis: 切片轴 ('x', 'y', 'z')
            
        Returns:
            切片数量
        """
        axis_idx = {'x': 0, 'y': 1, 'z': 2}[axis]
        min_p, max_p = self.get_bounding_box()
        range_length = max_p[axis_idx] - min_p[axis_idx]
        return max(1, int(np.ceil(range_length / self.slice_thickness)))
    
    def slice_along_axis(self,
                          axis: str = 'z',
                          num_slices: Optional[int] = None,
                          start_position: Optional[float] = None,
                          end_position: Optional[float] = None) -> List[SliceResult]:
        """
        沿指定轴切片
        
        Args:
            axis: 切片轴 ('x', 'y', 'z')
            num_slices: 切片数量（None时根据厚度自动计算）
            start_position: 起始位置（None时使用点云最小值）
            end_position: 结束位置（None时使用点云最大值）
            
        Returns:
            切片结果列表
        """
        axis_idx = {'x': 0, 'y': 1, 'z': 2}[axis]
        normal = self.AXIS_VECTORS[axis]
        
        min_p, max_p = self.get_bounding_box()
        
        if start_position is None:
            start_position = min_p[axis_idx]
        if end_position is None:
            end_position = max_p[axis_idx]
        
        if num_slices is None:
            num_slices = max(1, int(np.ceil(
                (end_position - start_position) / self.slice_thickness
            )))
        
        actual_thickness = (end_position - start_position) / num_slices
        print(f"沿 {axis.upper()} 轴切片: {num_slices} 个切片, 实际厚度: {actual_thickness:.4f}")
        
        self.slices = []
        
        for i in range(num_slices):
            slice_center = start_position + (i + 0.5) * actual_thickness
            slice_min = slice_center - actual_thickness / 2
            slice_max = slice_center + actual_thickness / 2
            
            mask = (self.points[:, axis_idx] >= slice_min) & \
                   (self.points[:, axis_idx] < slice_max)
            
            slice_points = self.points[mask]
            
            if len(slice_points) < 3:
                continue
            
            slice_thickness = slice_max - slice_min
            center_point = np.mean(slice_points, axis=0)
            
            thickness_values_slice = None
            if self.thickness_values is not None:
                thickness_values_slice = self.thickness_values[mask]
            
            defect_values_slice = None
            if self.defect_labels is not None:
                defect_values_slice = self.defect_labels[mask]
            
            profiles = self._extract_profiles(
                slice_points, axis, thickness_values_slice, defect_values_slice
            )
            
            stats = self._calculate_slice_stats(
                slice_points, thickness_values_slice, defect_values_slice
            )
            
            bbox_min = np.min(slice_points, axis=0)
            bbox_max = np.max(slice_points, axis=0)
            bbox = (bbox_min[0], bbox_min[1], bbox_max[0], bbox_max[1])
            
            self.slices.append(SliceResult(
                slice_index=i,
                slice_position=slice_center,
                slice_normal=normal,
                thickness=slice_thickness,
                profiles=profiles,
                point_count=len(slice_points),
                stats=stats
            ))
        
        print(f"成功生成 {len(self.slices)} 个有效切片")
        return self.slices
    
    def _extract_profiles(self,
                           points: np.ndarray,
                           axis: str,
                           thickness_values: Optional[np.ndarray],
                           defect_values: Optional[np.ndarray]) -> List[SliceProfile]:
        """
        提取切片内的轮廓
        
        Args:
            points: 切片内的点
            axis: 切片轴
            thickness_values: 厚度值
            defect_values: 缺损值
            
        Returns:
            轮廓列表
        """
        plane_axes = [a for a in ['x', 'y', 'z'] if a != axis]
        axis_idx1 = {'x': 0, 'y': 1, 'z': 2}[plane_axes[0]]
        axis_idx2 = {'x': 0, 'y': 1, 'z': 2}[plane_axes[1]]
        
        plane_points = points[:, [axis_idx1, axis_idx2]]
        
        profiles = []
        
        if len(plane_points) < 10:
            return profiles
        
        try:
            from sklearn.cluster import DBSCAN
            
            clustering = DBSCAN(eps=self.slice_thickness * 2, min_samples=5)
            labels = clustering.fit_predict(plane_points)
            
            for label in np.unique(labels):
                if label == -1:
                    continue
                    
                mask = labels == label
                profile_points = plane_points[mask]
                
                if len(profile_points) < 5:
                    continue
                
                thickness_profile = None
                if thickness_values is not None:
                    thickness_profile = thickness_values[mask]
                
                defect_profile = None
                if defect_values is not None:
                    defect_profile = defect_values[mask]
                
                bbox_min = np.min(profile_points, axis=0)
                bbox_max = np.max(profile_points, axis=0)
                bbox = (bbox_min[0], bbox_min[1], bbox_max[0], bbox_max[1])
                
                area = (bbox_max[0] - bbox_min[0]) * (bbox_max[1] - bbox_min[1])
                
                perimeter = 2 * ((bbox_max[0] - bbox_min[0]) + (bbox_max[1] - bbox_min[1]))
                
                center_point = np.mean(profile_points, axis=0)
                
                profiles.append(SliceProfile(
                    profile_id=int(label),
                    points=profile_points,
                    thickness_values=thickness_profile,
                    defect_values=defect_profile,
                    bounding_box=bbox,
                    center_point=center_point,
                    area=area,
                    perimeter=perimeter
                ))
        
        except Exception as e:
            pass
        
        return profiles
    
    def _calculate_slice_stats(self,
                                points: np.ndarray,
                                thickness_values: Optional[np.ndarray],
                                defect_values: Optional[np.ndarray]) -> Dict:
        """
        计算切片统计信息
        
        Args:
            points: 切片内的点
            thickness_values: 厚度值
            defect_values: 缺损值
            
        Returns:
            统计信息字典
        """
        stats = {
            'point_count': len(points),
            'center': np.mean(points, axis=0).tolist(),
            'extent': (np.max(points, axis=0) - np.min(points, axis=0)).tolist()
        }
        
        if thickness_values is not None:
            valid_thickness = thickness_values[thickness_values > 0]
            if len(valid_thickness) > 0:
                stats['thickness'] = {
                    'mean': float(np.mean(valid_thickness)),
                    'median': float(np.median(valid_thickness)),
                    'min': float(np.min(valid_thickness)),
                    'max': float(np.max(valid_thickness)),
                    'std': float(np.std(valid_thickness)),
                    'valid_ratio': len(valid_thickness) / len(thickness_values)
                }
        
        if defect_values is not None:
            defect_count = np.sum(defect_values > 0)
            stats['defects'] = {
                'count': int(defect_count),
                'ratio': defect_count / len(defect_values),
                'max_label': int(np.max(defect_values))
            }
        
        return stats
    
    def analyze_cross_section(self, slice_index: int) -> CrossSectionAnalysis:
        """
        分析指定横截面
        
        Args:
            slice_index: 切片索引
            
        Returns:
            横截面分析结果
        """
        if slice_index < 0 or slice_index >= len(self.slices):
            raise ValueError(f"切片索引 {slice_index} 超出范围 (0-{len(self.slices)-1})")
        
        slice_result = self.slices[slice_index]
        
        max_t = 0
        min_t = float('inf')
        all_t = []
        
        for profile in slice_result.profiles:
            if profile.thickness_values is not None:
                valid_t = profile.thickness_values[profile.thickness_values > 0]
                if len(valid_t) > 0:
                    all_t.extend(valid_t)
        
        if all_t:
            max_t = max(all_t)
            min_t = min(all_t)
            avg_t = np.mean(all_t)
            var_t = np.var(all_t)
        else:
            max_t = 0
            min_t = 0
            avg_t = 0
            var_t = 0
        
        defect_density = 0
        if slice_result.stats and 'defects' in slice_result.stats:
            defect_density = slice_result.stats['defects']['ratio']
        
        smoothness = self._calculate_profile_smoothness(slice_result)
        symmetry = self._calculate_symmetry(slice_result)
        
        return CrossSectionAnalysis(
            max_thickness=max_t,
            min_thickness=min_t,
            avg_thickness=avg_t,
            thickness_variance=var_t,
            defect_density=defect_density,
            profile_smoothness=smoothness,
            symmetry_score=symmetry
        )
    
    def _calculate_profile_smoothness(self, slice_result: SliceResult) -> float:
        """计算轮廓平滑度"""
        if not slice_result.profiles:
            return 0
        
        total_smoothness = 0
        for profile in slice_result.profiles:
            if len(profile.points) > 10:
                try:
                    hull = np.mean(np.std(profile.points, axis=0))
                    smoothness = 1 / (1 + hull)
                    total_smoothness += smoothness
                except:
                    pass
        
        return total_smoothness / len(slice_result.profiles) if slice_result.profiles else 0
    
    def _calculate_symmetry(self, slice_result: SliceResult) -> float:
        """计算对称性分数"""
        if not slice_result.profiles or len(slice_result.profiles) == 0:
            return 0
        
        all_points = np.vstack([p.points for p in slice_result.profiles])
        
        if len(all_points) < 10:
            return 0
        
        center = np.mean(all_points, axis=0)
        
        centered = all_points - center
        
        cov = np.cov(centered.T)
        eigenvalues, _ = np.linalg.eig(cov)
        eigenvalues = np.sort(eigenvalues)[::-1]
        
        if eigenvalues[0] > 0:
            symmetry = 1 - abs(eigenvalues[0] - eigenvalues[1]) / (eigenvalues[0] + 1e-8)
            return max(0, min(1, symmetry))
        
        return 0
    
    def get_slice_summary(self) -> Dict:
        """
        获取切片摘要
        
        Returns:
            摘要信息字典
        """
        if not self.slices:
            return {}
        
        total_points = sum(s.point_count for s in self.slices)
        total_profiles = sum(len(s.profiles) for s in self.slices)
        
        thickness_trend = []
        for s in self.slices:
            if 'thickness' in s.stats and 'mean' in s.stats['thickness']:
                thickness_trend.append(s.stats['thickness']['mean'])
        
        defect_trend = []
        for s in self.slices:
            if 'defects' in s.stats:
                defect_trend.append(s.stats['defects']['ratio'])
        
        return {
            'num_slices': len(self.slices),
            'slice_thickness': self.slice_thickness,
            'total_points': total_points,
            'total_profiles': total_profiles,
            'avg_points_per_slice': total_points / len(self.slices),
            'thickness_trend': thickness_trend,
            'defect_trend': defect_trend,
            'slices_info': [
                {
                    'index': s.slice_index,
                    'position': s.slice_position,
                    'points': s.point_count,
                    'profiles': len(s.profiles)
                }
                for s in self.slices
            ]
        }
    
    def export_slice_csv(self, output_dir: str, slice_index: Optional[int] = None):
        """
        导出切片数据为CSV
        
        Args:
            output_dir: 输出目录
            slice_index: 指定切片索引（None时导出所有切片）
        """
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        slices_to_export = []
        if slice_index is not None:
            if 0 <= slice_index < len(self.slices):
                slices_to_export.append(self.slices[slice_index])
        else:
            slices_to_export = self.slices
        
        for s in slices_to_export:
            filename = output_path / f"slice_{s.slice_index:04d}_{s.slice_position:.4f}.csv"
            
            all_profile_points = []
            for profile in s.profiles:
                for i, point in enumerate(profile.points):
                    row = [
                        profile.profile_id,
                        point[0], point[1],
                        s.slice_position
                    ]
                    
                    if profile.thickness_values is not None:
                        row.append(profile.thickness_values[i])
                    if profile.defect_values is not None:
                        row.append(profile.defect_values[i])
                    
                    all_profile_points.append(row)
            
            if all_profile_points:
                import csv
                with open(filename, 'w', newline='') as f:
                    writer = csv.writer(f)
                    header = ['profile_id', 'x', 'y', 'slice_position']
                    if self.thickness_values is not None:
                        header.append('thickness')
                    if self.defect_labels is not None:
                        header.append('defect')
                    writer.writerow(header)
                    writer.writerows(all_profile_points)
                
                print(f"已导出切片 {s.slice_index}: {filename}")
    
    def export_slice_summary(self, output_path: str):
        """
        导出切片摘要
        
        Args:
            output_path: 输出文件路径
        """
        summary = self.get_slice_summary()
        
        import json
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2, ensure_ascii=False)
        
        print(f"切片摘要已导出: {output_path}")

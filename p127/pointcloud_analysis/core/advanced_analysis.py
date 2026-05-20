import numpy as np
import open3d as o3d
from scipy import interpolate
from scipy.spatial import KDTree
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import PolynomialFeatures
from datetime import datetime
from typing import Dict, List, Tuple, Optional
from ..utils.helpers import point_cloud_to_array


class WeatheringPredictor:
    """风化趋势预测器"""
    
    def __init__(self):
        self.history_data = []
        self.prediction_model = None
        
    def add_history_record(self, date: datetime, wear_stats: Dict, thickness_stats: Dict):
        """添加历史记录"""
        record = {
            'date': date,
            'timestamp': date.timestamp(),
            'wear_percentage': wear_stats.get('wear_percentage', 0),
            'max_wear_depth': wear_stats.get('max_wear', 0),
            'mean_wear_depth': wear_stats.get('mean_wear', 0),
            'mean_thickness': thickness_stats.get('mean_thickness', 0),
            'min_thickness': thickness_stats.get('min_thickness', 0)
        }
        self.history_data.append(record)
        self.history_data.sort(key=lambda x: x['timestamp'])
        
    def predict(self, days_ahead: int = 365, method: str = 'linear') -> Dict:
        """预测未来风化趋势"""
        if len(self.history_data) < 2:
            return {'error': '需要至少2个历史数据点进行预测'}
            
        timestamps = np.array([r['timestamp'] for r in self.history_data]).reshape(-1, 1)
        base_time = timestamps[0, 0]
        times = (timestamps - base_time) / (24 * 3600)  # 转换为天数
        
        predict_time = times[-1, 0] + days_ahead
        predictions = {}
        
        for feature in ['wear_percentage', 'max_wear_depth', 'mean_wear_depth', 'mean_thickness', 'min_thickness']:
            values = np.array([r[feature] for r in self.history_data])
            
            if method == 'linear':
                model = LinearRegression()
                model.fit(times, values)
                pred = model.predict([[predict_time]])[0]
                predictions[feature] = {
                    'predicted_value': float(pred),
                    'rate': float(model.coef_[0]),
                    'intercept': float(model.intercept_)
                }
            elif method == 'polynomial':
                poly = PolynomialFeatures(degree=2)
                X_poly = poly.fit_transform(times)
                model = LinearRegression()
                model.fit(X_poly, values)
                pred = model.predict(poly.transform([[predict_time]]))[0]
                predictions[feature] = {
                    'predicted_value': float(pred)
                }
        
        remaining_days = self._estimate_remaining_life(predictions)
        
        return {
            'predictions': predictions,
            'days_ahead': days_ahead,
            'remaining_life_days': remaining_days,
            'history_count': len(self.history_data),
            'method': method
        }
    
    def _estimate_remaining_life(self, predictions: Dict) -> float:
        """估算剩余使用寿命"""
        if 'mean_thickness' not in predictions:
            return float('inf')
            
        pred = predictions['mean_thickness']
        current_thickness = pred['predicted_value']
        rate = pred.get('rate', 0)
        
        if rate >= 0:
            return float('inf')
            
        min_allowable = current_thickness * 0.3
        remaining_thickness = current_thickness - min_allowable
        
        if remaining_thickness <= 0:
            return 0
            
        return abs(remaining_thickness / rate)
    
    def generate_trend_chart_data(self) -> Dict:
        """生成趋势图表数据"""
        if len(self.history_data) < 2:
            return {}
            
        times = [(r['date'].strftime('%Y-%m-%d'), r['timestamp']) for r in self.history_data]
        wear_data = [r['wear_percentage'] for r in self.history_data]
        thickness_data = [r['mean_thickness'] for r in self.history_data]
        
        return {
            'labels': [t[0] for t in times],
            'wear_percentage': wear_data,
            'mean_thickness': thickness_data
        }


class MultiPeriodComparator:
    """多期数据对比分析器"""
    
    def __init__(self):
        self.periods = []
        self.aligned_clouds = {}
        
    def add_period(self, period_name: str, point_cloud: o3d.geometry.PointCloud,
                   wear_values: np.ndarray, thickness_values: np.ndarray):
        """添加一个周期的数据"""
        self.periods.append({
            'name': period_name,
            'point_cloud': point_cloud,
            'wear_values': wear_values,
            'thickness_values': thickness_values,
            'timestamp': datetime.now()
        })
    
    def compare_periods(self, period1_idx: int, period2_idx: int) -> Dict:
        """对比两个周期的数据"""
        if period1_idx >= len(self.periods) or period2_idx >= len(self.periods):
            return {'error': '周期索引超出范围'}
            
        p1 = self.periods[period1_idx]
        p2 = self.periods[period2_idx]
        
        points1 = point_cloud_to_array(p1['point_cloud'])
        points2 = point_cloud_to_array(p2['point_cloud'])
        
        wear_diff = np.nanmean(p2['wear_values']) - np.nanmean(p1['wear_values'])
        thickness_diff = np.nanmean(p2['thickness_values']) - np.nanmean(p1['thickness_values'])
        
        max_wear1 = np.nanmax(p1['wear_values']) if len(p1['wear_values']) > 0 else 0
        max_wear2 = np.nanmax(p2['wear_values']) if len(p2['wear_values']) > 0 else 0
        
        return {
            'period1': p1['name'],
            'period2': p2['name'],
            'wear_increase_percentage': float(wear_diff),
            'thickness_decrease_percentage': float(-thickness_diff),
            'max_wear_increase': float(max_wear2 - max_wear1),
            'point_count_change': int(len(points2) - len(points1)),
            'deterioration_rate': self._calculate_deterioration_rate(p1, p2)
        }
    
    def _calculate_deterioration_rate(self, p1: Dict, p2: Dict) -> float:
        """计算劣化率"""
        time_diff = (p2['timestamp'] - p1['timestamp']).days
        if time_diff <= 0:
            return 0
            
        wear1 = np.nanmean(p1['wear_values'])
        wear2 = np.nanmean(p2['wear_values'])
        
        return float((wear2 - wear1) / time_diff * 365)
    
    def get_comparison_summary(self) -> Dict:
        """获取所有周期的对比摘要"""
        if len(self.periods) < 2:
            return {'error': '需要至少2个周期进行对比'}
            
        summaries = []
        for i in range(1, len(self.periods)):
            comparison = self.compare_periods(i-1, i)
            summaries.append(comparison)
            
        overall_trend = self._calculate_overall_trend()
        
        return {
            'period_count': len(self.periods),
            'comparisons': summaries,
            'overall_trend': overall_trend
        }
    
    def _calculate_overall_trend(self) -> Dict:
        """计算整体趋势"""
        wear_trends = []
        thickness_trends = []
        
        for period in self.periods:
            wear_trends.append(np.nanmean(period['wear_values']))
            thickness_trends.append(np.nanmean(period['thickness_values']))
        
        return {
            'wear_acceleration': float(np.polyfit(range(len(wear_trends)), wear_trends, 1)[0]),
            'thickness_degradation': float(np.polyfit(range(len(thickness_trends)), thickness_trends, 1)[0])
        }


class RepairEstimator:
    """维修量估算器"""
    
    def __init__(self, material_density: float = 2400.0):  # kg/m³, 混凝土密度
        self.material_density = material_density
        self.repair_threshold = 0.01  # 1cm磨损深度需要修复
        
    def set_repair_threshold(self, threshold: float):
        """设置修复阈值"""
        self.repair_threshold = threshold
        
    def estimate_repair_volume(self, point_cloud: o3d.geometry.PointCloud,
                                wear_values: np.ndarray, wear_mask: np.ndarray) -> Dict:
        """估算修复体积"""
        if not np.any(wear_mask):
            return {
                'repair_volume': 0,
                'repair_area': 0,
                'repair_points_count': 0
            }
            
        points = point_cloud_to_array(point_cloud)
        wear_points = points[wear_mask]
        wear_depths = wear_values[wear_mask]
        
        if len(wear_points) < 3:
            return {
                'repair_volume': 0,
                'repair_area': 0,
                'repair_points_count': len(wear_points)
            }
        
        area = self._calculate_point_cloud_area(wear_points)
        volume = float(np.mean(wear_depths) * area)
        
        return {
            'repair_volume_m3': float(volume),
            'repair_area_m2': float(area),
            'repair_points_count': int(np.sum(wear_mask)),
            'max_depth_m': float(np.max(wear_depths)),
            'mean_depth_m': float(np.mean(wear_depths)),
            'material_weight_kg': float(volume * self.material_density)
        }
    
    def _calculate_point_cloud_area(self, points: np.ndarray) -> float:
        """计算点云面积"""
        if len(points) < 3:
            return 0
            
        try:
            hull = o3d.geometry.PointCloud()
            hull.points = o3d.utility.Vector3dVector(points)
            hull, _ = hull.remove_statistical_outlier(nb_neighbors=20, std_ratio=2.0)
            
            if len(hull.points) < 3:
                return 0
                
            hull.estimate_normals()
            mesh, _ = o3d.geometry.TriangleMesh.create_from_point_cloud_alpha_shape(
                hull, alpha=0.1
            )
            
            if mesh is not None and len(mesh.triangles) > 0:
                return float(mesh.get_surface_area())
        except:
            pass
        
        if len(points) >= 3:
            centroid = np.mean(points, axis=0)
            distances = np.linalg.norm(points - centroid, axis=1)
            radius = np.mean(distances)
            return np.pi * radius * radius * 0.5
        
        return 0
    
    def estimate_repair_cost(self, volume_estimate: Dict, 
                             material_cost_per_m3: float = 500.0,
                             labor_cost_per_m2: float = 100.0) -> Dict:
        """估算维修成本"""
        volume = volume_estimate.get('repair_volume_m3', 0)
        area = volume_estimate.get('repair_area_m2', 0)
        
        material_cost = volume * material_cost_per_m3
        labor_cost = area * labor_cost_per_m2
        total_cost = material_cost + labor_cost
        
        return {
            'material_cost': float(material_cost),
            'labor_cost': float(labor_cost),
            'total_cost': float(total_cost),
            'material_cost_per_m3': material_cost_per_m3,
            'labor_cost_per_m2': labor_cost_per_m2
        }
    
    def generate_repair_plan(self, wear_values: np.ndarray, 
                             wear_mask: np.ndarray, points: np.ndarray) -> Dict:
        """生成修复方案"""
        if not np.any(wear_mask):
            return {'recommendation': '无需修复', 'priority': 'low'}
            
        wear_depths = wear_values[wear_mask]
        max_depth = np.max(wear_depths)
        mean_depth = np.mean(wear_depths)
        wear_percentage = np.sum(wear_mask) / len(wear_mask) * 100
        
        if max_depth > 0.05 or wear_percentage > 30:
            priority = 'critical'
            recommendation = '需要立即进行重大维修，考虑更换受损部件'
        elif max_depth > 0.02 or wear_percentage > 15:
            priority = 'high'
            recommendation = '建议尽快进行中度修复，重点处理深度磨损区域'
        elif max_depth > self.repair_threshold or wear_percentage > 5:
            priority = 'medium'
            recommendation = '建议进行常规维护和局部修复'
        else:
            priority = 'low'
            recommendation = '磨损轻微，可延长检查周期'
        
        return {
            'priority': priority,
            'recommendation': recommendation,
            'max_depth_m': float(max_depth),
            'wear_percentage': float(wear_percentage),
            'estimated_timeline_days': self._estimate_timeline(priority)
        }
    
    def _estimate_timeline(self, priority: str) -> int:
        """估算维修工期"""
        timelines = {
            'critical': 14,
            'high': 7,
            'medium': 3,
            'low': 1
        }
        return timelines.get(priority, 1)


class PointCloudSlicer:
    """点云切片分析器"""
    
    def __init__(self, point_cloud: Optional[o3d.geometry.PointCloud] = None):
        self.point_cloud = point_cloud
        
    def set_point_cloud(self, point_cloud: o3d.geometry.PointCloud):
        """设置点云"""
        self.point_cloud = point_cloud
        
    def create_slice(self, axis: str = 'z', position: float = 0.0, 
                     thickness: float = 0.01) -> Tuple[np.ndarray, Dict]:
        """创建切片"""
        if self.point_cloud is None:
            raise ValueError("请先设置点云")
            
        points = point_cloud_to_array(self.point_cloud)
        
        axis_idx = {'x': 0, 'y': 1, 'z': 2}[axis.lower()]
        
        mask = np.abs(points[:, axis_idx] - position) < thickness / 2
        slice_points = points[mask]
        
        if len(slice_points) == 0:
            return np.array([]), {'error': '该位置没有点云数据'}
        
        other_axes = [i for i in range(3) if i != axis_idx]
        slice_2d = slice_points[:, other_axes]
        
        stats = {
            'axis': axis,
            'position': position,
            'thickness': thickness,
            'point_count': len(slice_points),
            'bounds': {
                'min': np.min(slice_2d, axis=0).tolist(),
                'max': np.max(slice_2d, axis=0).tolist(),
                'center': np.mean(slice_2d, axis=0).tolist()
            },
            'area_estimate': self._estimate_slice_area(slice_2d)
        }
        
        return slice_points, stats
    
    def create_multiple_slices(self, axis: str = 'z', num_slices: int = 10,
                               thickness: float = 0.01) -> List[Dict]:
        """创建多个切片"""
        if self.point_cloud is None:
            raise ValueError("请先设置点云")
            
        points = point_cloud_to_array(self.point_cloud)
        axis_idx = {'x': 0, 'y': 1, 'z': 2}[axis.lower()]
        
        min_pos = np.min(points[:, axis_idx])
        max_pos = np.max(points[:, axis_idx])
        positions = np.linspace(min_pos + thickness/2, max_pos - thickness/2, num_slices)
        
        slices = []
        for pos in positions:
            slice_points, stats = self.create_slice(axis, pos, thickness)
            if len(slice_points) > 0:
                slices.append({
                    'position': float(pos),
                    'points': slice_points,
                    'stats': stats
                })
        
        return slices
    
    def _estimate_slice_area(self, slice_2d: np.ndarray) -> float:
        """估算切片面积"""
        if len(slice_2d) < 3:
            return 0
            
        try:
            from scipy.spatial import ConvexHull
            hull = ConvexHull(slice_2d)
            return float(hull.area)
        except:
            bounds = np.ptp(slice_2d, axis=0)
            return float(bounds[0] * bounds[1] * 0.5)
    
    def analyze_slice_profile(self, slice_points: np.ndarray, 
                              profile_axis: str = 'x') -> Dict:
        """分析切片轮廓"""
        if len(slice_points) == 0:
            return {'error': '切片为空'}
            
        axis_idx = {'x': 0, 'y': 1}[profile_axis.lower()]
        other_axis = 1 if axis_idx == 0 else 0
        
        sorted_indices = np.argsort(slice_points[:, axis_idx])
        sorted_points = slice_points[sorted_indices]
        
        profile_values = sorted_points[:, other_axis]
        
        return {
            'profile_axis': profile_axis,
            'min_value': float(np.min(profile_values)),
            'max_value': float(np.max(profile_values)),
            'mean_value': float(np.mean(profile_values)),
            'std_deviation': float(np.std(profile_values)),
            'roughness': float(np.mean(np.abs(np.diff(profile_values))))
        }
    
    def detect_wear_in_slice(self, slice_points: np.ndarray,
                             reference_slice: np.ndarray) -> Dict:
        """检测切片中的磨损"""
        if len(slice_points) == 0 or len(reference_slice) == 0:
            return {'error': '切片数据不足'}
            
        kdtree = KDTree(reference_slice[:, :2])
        distances, _ = kdtree.query(slice_points[:, :2])
        
        wear_mask = distances > np.mean(distances) + 2 * np.std(distances)
        
        return {
            'wear_points_count': int(np.sum(wear_mask)),
            'wear_points_percentage': float(np.sum(wear_mask) / len(wear_mask) * 100),
            'max_wear_distance': float(np.max(distances[wear_mask])) if np.any(wear_mask) else 0,
            'mean_wear_distance': float(np.mean(distances[wear_mask])) if np.any(wear_mask) else 0
        }
    
    def export_slice_to_csv(self, slice_points: np.ndarray, 
                            output_path: str, stats: Optional[Dict] = None):
        """导出切片数据到CSV"""
        header = 'x,y,z'
        if stats:
            header += f"\n# Slice stats: {stats}"
            
        np.savetxt(output_path, slice_points, delimiter=',', header=header, comments='')
        
        return output_path

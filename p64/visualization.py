"""
结果可视化模块 - 参数变化曲线绘制
Visualization Module - Parameter Curve Plotting
"""

import numpy as np
import matplotlib.pyplot as plt
from matplotlib.gridspec import GridSpec
from typing import Optional, List, Tuple, Any
import warnings


class VisualizationError(Exception):
    """可视化异常类"""
    pass


class FiringVisualizer:
    """烧制过程可视化 - 带数据校验和坐标轴修复"""
    
    # 基于古法烧制经验的合理范围
    DATA_RANGES = {
        'time': (0, 1440),
        'temperature': (20, 1450),
        'humidity': (0, 100),
        'oxygen': (0, 21),
        'co2': (0, 20),
        'reduction': (0, 1),
        'shrinkage': (-50, 10),
        'stress': (-1e9, 1e9),
        'porosity': (0, 1),
        'density': (1000, 3500)
    }
    
    def __init__(self, style: str = 'seaborn-v0_8', auto_fix_axes: bool = True):
        try:
            plt.style.use(style)
        except:
            warnings.warn(f"样式 {style} 不可用，使用默认样式")
            plt.style.use('default')
        
        self.fig = None
        self.axes = None
        self.auto_fix_axes = auto_fix_axes
        self.validation_warnings = []
    
    def _validate_and_clean_data(self, time: np.ndarray, values: np.ndarray,
                                 data_type: str) -> Tuple[np.ndarray, np.ndarray]:
        """校验并清理数据"""
        # 转换为numpy数组
        time = np.asarray(time, dtype=np.float64).flatten()
        values = np.asarray(values, dtype=np.float64).flatten()
        
        # 检查长度匹配
        if len(time) != len(values):
            min_len = min(len(time), len(values))
            warnings.warn(f"时间与{data_type}数据长度不一致，截断到长度 {min_len}")
            time = time[:min_len]
            values = values[:min_len]
        
        # 检查数据点数量
        if len(time) < 2:
            raise VisualizationError(f"数据点太少，至少需要2个点才能绘制曲线")
        
        # 处理NaN和Inf
        valid_mask = ~(np.isnan(values) | np.isinf(values))
        valid_time_mask = ~(np.isnan(time) | np.isinf(time))
        valid_mask = valid_mask & valid_time_mask
        
        if np.sum(valid_mask) < 2:
            raise VisualizationError(f"有效数据点太少，无法绘制{data_type}曲线")
        
        if np.sum(valid_mask) < len(values):
            invalid_count = len(values) - np.sum(valid_mask)
            warnings.warn(f"{data_type}包含 {invalid_count} 个无效值，已过滤")
            time = time[valid_mask]
            values = values[valid_mask]
        
        # 时间排序
        sort_idx = np.argsort(time)
        if not np.array_equal(sort_idx, np.arange(len(time))):
            warnings.warn("时间序列未排序，已自动排序")
            time = time[sort_idx]
            values = values[sort_idx]
        
        # 数据范围检查和裁剪
        if data_type in self.DATA_RANGES:
            min_val, max_val = self.DATA_RANGES[data_type]
            out_of_range_mask = (values < min_val) | (values > max_val)
            if np.any(out_of_range_mask):
                out_count = np.sum(out_of_range_mask)
                if self.auto_fix_axes:
                    warnings.warn(f"{data_type}有 {out_count} 个点超出合理范围 [{min_val}, {max_val}]，已裁剪")
                    values = np.clip(values, min_val, max_val)
                else:
                    warnings.warn(f"{data_type}有 {out_count} 个点超出合理范围 [{min_val}, {max_val}]")
        
        # 时间范围检查
        time_min, time_max = self.DATA_RANGES['time']
        if np.any(time < time_min) or np.any(time > time_max):
            warnings.warn(f"时间超出合理范围 [{time_min}, {time_max}] 分钟")
        
        return time, values
    
    def _setup_axes_limits(self, ax: plt.Axes, x_data: np.ndarray, y_data: np.ndarray,
                          y_padding: float = 0.05) -> plt.Axes:
        """设置坐标轴范围，避免错乱"""
        # X轴范围
        x_min, x_max = np.min(x_data), np.max(x_data)
        x_range = x_max - x_min
        if x_range < 1e-10:
            x_range = 1.0
        ax.set_xlim(x_min - x_range * 0.02, x_max + x_range * 0.02)
        
        # Y轴范围
        y_min, y_max = np.min(y_data), np.max(y_data)
        y_range = y_max - y_min
        if y_range < 1e-10:
            y_range = abs(y_min) * 0.1 if y_min != 0 else 1.0
        ax.set_ylim(y_min - y_range * y_padding, y_max + y_range * y_padding)
        
        return ax
    
    def plot_temperature_curve(self, time: np.ndarray, temperature: np.ndarray,
                               title: str = 'Temperature Curve',
                               ax: Optional[plt.Axes] = None) -> plt.Axes:
        """绘制温度曲线"""
        try:
            time, temperature = self._validate_and_clean_data(time, temperature, 'temperature')
            
            if ax is None:
                _, ax = plt.subplots(figsize=(10, 6))
            
            ax.plot(time, temperature, 'r-', linewidth=2, label='Temperature')
            ax.set_xlabel('Time (min)')
            ax.set_ylabel('Temperature (°C)')
            ax.set_title(title)
            ax.legend()
            ax.grid(True, alpha=0.3)
            
            self._setup_axes_limits(ax, time, temperature)
            
            return ax
            
        except Exception as e:
            raise VisualizationError(f"绘制温度曲线失败: {e}") from e
    
    def plot_humidity_curve(self, time: np.ndarray, humidity: np.ndarray,
                            title: str = 'Humidity Curve',
                            ax: Optional[plt.Axes] = None) -> plt.Axes:
        """绘制湿度曲线"""
        try:
            time, humidity = self._validate_and_clean_data(time, humidity, 'humidity')
            
            if ax is None:
                _, ax = plt.subplots(figsize=(10, 6))
            
            ax.plot(time, humidity, 'b-', linewidth=2, label='Humidity')
            ax.set_xlabel('Time (min)')
            ax.set_ylabel('Humidity (%)')
            ax.set_title(title)
            ax.legend()
            ax.grid(True, alpha=0.3)
            
            self._setup_axes_limits(ax, time, humidity)
            
            return ax
            
        except Exception as e:
            raise VisualizationError(f"绘制湿度曲线失败: {e}") from e
    
    def plot_atmosphere_curve(self, time: np.ndarray, oxygen: np.ndarray,
                              co2: np.ndarray, reduction: Optional[np.ndarray] = None,
                              title: str = 'Atmosphere Curves',
                              ax: Optional[plt.Axes] = None) -> plt.Axes:
        """绘制气氛曲线"""
        try:
            time, oxygen = self._validate_and_clean_data(time, oxygen, 'oxygen')
            time, co2 = self._validate_and_clean_data(time, co2, 'co2')
            
            if ax is None:
                _, ax = plt.subplots(figsize=(12, 6))
            
            ax.plot(time, oxygen, 'g-', linewidth=2, label='O₂ (%)')
            ax.plot(time, co2, 'm-', linewidth=2, label='CO₂ (%)')
            
            all_y_data = np.concatenate([oxygen, co2])
            
            if reduction is not None:
                time_reduced, reduction = self._validate_and_clean_data(time, reduction, 'reduction')
                reduction_pct = reduction * 100
                
                ax2 = ax.twinx()
                ax2.plot(time_reduced, reduction_pct, 'orange', linewidth=2, 
                         linestyle='--', label='Reduction Atmosphere (%)')
                ax2.set_ylabel('Reduction Level (%)')
                
                # 设置右侧Y轴范围
                self._setup_axes_limits(ax2, time_reduced, reduction_pct)
                
                lines1, labels1 = ax.get_legend_handles_labels()
                lines2, labels2 = ax2.get_legend_handles_labels()
                ax.legend(lines1 + lines2, labels1 + labels2, loc='best')
            else:
                ax.legend()
            
            ax.set_xlabel('Time (min)')
            ax.set_ylabel('Gas Concentration (%)')
            ax.set_title(title)
            ax.grid(True, alpha=0.3)
            
            self._setup_axes_limits(ax, time, all_y_data)
            
            return ax
            
        except Exception as e:
            raise VisualizationError(f"绘制气氛曲线失败: {e}") from e
    
    def plot_shrinkage_curve(self, time: np.ndarray, radial_shrinkage: np.ndarray,
                             axial_shrinkage: Optional[np.ndarray] = None,
                             title: str = 'Shrinkage Curves',
                             ax: Optional[plt.Axes] = None) -> plt.Axes:
        """绘制收缩率曲线"""
        try:
            time, radial_shrinkage = self._validate_and_clean_data(time, radial_shrinkage, 'shrinkage')
            radial_pct = radial_shrinkage * 100
            
            if ax is None:
                _, ax = plt.subplots(figsize=(10, 6))
            
            ax.plot(time, radial_pct, 'r-', linewidth=2, label='Radial Shrinkage')
            
            all_y_data = radial_pct
            
            if axial_shrinkage is not None:
                time_axial, axial_shrinkage = self._validate_and_clean_data(time, axial_shrinkage, 'shrinkage')
                axial_pct = axial_shrinkage * 100
                ax.plot(time_axial, axial_pct, 'b--', linewidth=2, label='Axial Shrinkage')
                all_y_data = np.concatenate([all_y_data, axial_pct])
            
            ax.set_xlabel('Time (min)')
            ax.set_ylabel('Shrinkage (%)')
            ax.set_title(title)
            ax.legend()
            ax.grid(True, alpha=0.3)
            
            self._setup_axes_limits(ax, time, all_y_data)
            
            return ax
            
        except Exception as e:
            raise VisualizationError(f"绘制收缩率曲线失败: {e}") from e
    
    def plot_comparison(self, sim_time: np.ndarray, sim_temp: np.ndarray,
                        sensor_time: np.ndarray, sensor_temp: np.ndarray,
                        title: str = 'Simulation vs Sensor Data',
                        ax: Optional[plt.Axes] = None) -> plt.Axes:
        """绘制仿真与传感器数据对比"""
        try:
            sim_time, sim_temp = self._validate_and_clean_data(sim_time, sim_temp, 'temperature')
            sensor_time, sensor_temp = self._validate_and_clean_data(sensor_time, sensor_temp, 'temperature')
            
            if ax is None:
                _, ax = plt.subplots(figsize=(12, 6))
            
            ax.plot(sim_time, sim_temp, 'r-', linewidth=2, label='Simulation')
            ax.plot(sensor_time, sensor_temp, 'bo', markersize=3, alpha=0.5,
                    label='Sensor Data')
            
            ax.set_xlabel('Time (min)')
            ax.set_ylabel('Temperature (°C)')
            ax.set_title(title)
            ax.legend()
            ax.grid(True, alpha=0.3)
            
            # 合并数据设置统一范围
            all_time = np.concatenate([sim_time, sensor_time])
            all_temp = np.concatenate([sim_temp, sensor_temp])
            self._setup_axes_limits(ax, all_time, all_temp)
            
            return ax
            
        except Exception as e:
            raise VisualizationError(f"绘制对比曲线失败: {e}") from e
    
    def plot_combined_dashboard(self, time: np.ndarray, temperature: np.ndarray,
                                humidity: np.ndarray, oxygen: np.ndarray,
                                co2: np.ndarray, shrinkage: np.ndarray,
                                save_path: Optional[str] = None) -> plt.Figure:
        """绘制综合仪表板"""
        try:
            fig = plt.figure(figsize=(16, 12))
            gs = GridSpec(3, 2, figure=fig)
            
            ax1 = fig.add_subplot(gs[0, 0])
            self.plot_temperature_curve(time, temperature, ax=ax1)
            
            ax2 = fig.add_subplot(gs[0, 1])
            self.plot_humidity_curve(time, humidity, ax=ax2)
            
            ax3 = fig.add_subplot(gs[1, :])
            self.plot_atmosphere_curve(time, oxygen, co2, ax=ax3)
            
            ax4 = fig.add_subplot(gs[2, :])
            self.plot_shrinkage_curve(time, shrinkage, ax=ax4)
            
            plt.tight_layout()
            
            if save_path:
                plt.savefig(save_path, dpi=300, bbox_inches='tight')
            
            self.fig = fig
            return fig
            
        except Exception as e:
            raise VisualizationError(f"绘制综合仪表板失败: {e}") from e
    
    def plot_3d_temperature(self, x: np.ndarray, time: np.ndarray,
                           temp_profile: np.ndarray,
                           title: str = '3D Temperature Distribution',
                           save_path: Optional[str] = None) -> plt.Figure:
        """绘制3D温度分布"""
        try:
            from mpl_toolkits.mplot3d import Axes3D
            
            # 数据校验
            x = np.asarray(x, dtype=np.float64).flatten()
            time = np.asarray(time, dtype=np.float64).flatten()
            temp_profile = np.asarray(temp_profile, dtype=np.float64)
            
            # 检查维度匹配
            if temp_profile.shape != (len(time), len(x)):
                raise VisualizationError(
                    f"温度剖面形状 {temp_profile.shape} 与 时间长度 {len(time)} 和位置长度 {len(x)} 不匹配"
                )
            
            # 处理NaN值
            temp_profile = np.nan_to_num(temp_profile, nan=25.0, posinf=1450.0, neginf=20.0)
            
            fig = plt.figure(figsize=(12, 8))
            ax = fig.add_subplot(111, projection='3d')
            
            X, T = np.meshgrid(x, time)
            
            surf = ax.plot_surface(X, T, temp_profile, cmap='hot',
                                  linewidth=0, antialiased=True, alpha=0.8)
            
            ax.set_xlabel('Position (m)')
            ax.set_ylabel('Time (min)')
            ax.set_zlabel('Temperature (°C)')
            ax.set_title(title)
            
            # 设置合理的坐标轴范围
            ax.set_xlim(np.min(x), np.max(x))
            ax.set_ylim(np.min(time), np.max(time))
            ax.set_zlim(np.min(temp_profile) - 50, np.max(temp_profile) + 50)
            
            fig.colorbar(surf, ax=ax, shrink=0.5, aspect=10)
            
            if save_path:
                plt.savefig(save_path, dpi=300, bbox_inches='tight')
            
            return fig
            
        except Exception as e:
            raise VisualizationError(f"绘制3D温度分布失败: {e}") from e
    
    def plot_stress_analysis(self, time: np.ndarray, temperature: np.ndarray,
                            stress: np.ndarray,
                            title: str = 'Stress Analysis',
                            save_path: Optional[str] = None) -> plt.Figure:
        """绘制应力分析"""
        try:
            time, temperature = self._validate_and_clean_data(time, temperature, 'temperature')
            time, stress = self._validate_and_clean_data(time, stress, 'stress')
            stress_mpa = stress / 1e6
            
            fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))
            
            ax1.plot(time, temperature, 'r-', linewidth=2)
            ax1.set_xlabel('Time (min)')
            ax1.set_ylabel('Temperature (°C)')
            ax1.set_title('Temperature Profile')
            ax1.grid(True, alpha=0.3)
            self._setup_axes_limits(ax1, time, temperature)
            
            ax2.plot(time, stress_mpa, 'b-', linewidth=2)
            ax2.set_xlabel('Time (min)')
            ax2.set_ylabel('Stress (MPa)')
            ax2.set_title('Thermal Stress')
            ax2.grid(True, alpha=0.3)
            self._setup_axes_limits(ax2, time, stress_mpa)
            
            plt.suptitle(title, fontsize=14, y=1.02)
            plt.tight_layout()
            
            if save_path:
                plt.savefig(save_path, dpi=300, bbox_inches='tight')
            
            return fig
            
        except Exception as e:
            raise VisualizationError(f"绘制应力分析失败: {e}") from e
    
    def plot_phase_composition(self, time: np.ndarray, quartz: np.ndarray,
                              mullite: np.ndarray, glass: np.ndarray,
                              title: str = 'Phase Composition Evolution',
                              save_path: Optional[str] = None) -> plt.Figure:
        """绘制相组成演变"""
        try:
            time = np.asarray(time, dtype=np.float64).flatten()
            quartz = np.asarray(quartz, dtype=np.float64).flatten()
            mullite = np.asarray(mullite, dtype=np.float64).flatten()
            glass = np.asarray(glass, dtype=np.float64).flatten()
            
            # 确保所有数据长度一致
            min_len = min(len(time), len(quartz), len(mullite), len(glass))
            time = time[:min_len]
            quartz = quartz[:min_len]
            mullite = mullite[:min_len]
            glass = glass[:min_len]
            
            # 处理NaN
            quartz = np.nan_to_num(quartz, nan=0.0)
            mullite = np.nan_to_num(mullite, nan=0.0)
            glass = np.nan_to_num(glass, nan=0.0)
            
            # 确保总和不超过1
            total = quartz + mullite + glass
            total = np.where(total < 1e-10, 1.0, total)
            quartz = quartz / total
            mullite = mullite / total
            glass = glass / total
            
            fig, ax = plt.subplots(figsize=(12, 6))
            
            ax.stackplot(time, quartz, mullite, glass,
                        labels=['Quartz Transformation', 'Mullite', 'Glass Phase'],
                        colors=['#FF9999', '#66B2FF', '#99FF99'], alpha=0.7)
            
            ax.set_xlabel('Time (min)')
            ax.set_ylabel('Phase Fraction')
            ax.set_title(title)
            ax.legend(loc='upper left')
            ax.grid(True, alpha=0.3)
            ax.set_ylim(0, 1.05)
            ax.set_xlim(np.min(time), np.max(time))
            
            if save_path:
                plt.savefig(save_path, dpi=300, bbox_inches='tight')
            
            return fig
            
        except Exception as e:
            raise VisualizationError(f"绘制相组成演变失败: {e}") from e
    
    def plot_porosity_density(self, time: np.ndarray, porosity: np.ndarray,
                             density: np.ndarray,
                             title: str = 'Porosity and Density Evolution',
                             save_path: Optional[str] = None) -> plt.Figure:
        """绘制孔隙率和密度演变"""
        try:
            time, porosity = self._validate_and_clean_data(time, porosity, 'porosity')
            time, density = self._validate_and_clean_data(time, density, 'density')
            porosity_pct = porosity * 100
            
            fig, ax1 = plt.subplots(figsize=(10, 6))
            
            ax1.plot(time, porosity_pct, 'b-', linewidth=2, label='Porosity')
            ax1.set_xlabel('Time (min)')
            ax1.set_ylabel('Porosity (%)', color='b')
            ax1.tick_params(axis='y', labelcolor='b')
            self._setup_axes_limits(ax1, time, porosity_pct)
            
            ax2 = ax1.twinx()
            ax2.plot(time, density, 'r-', linewidth=2, label='Density')
            ax2.set_ylabel('Density (kg/m³)', color='r')
            ax2.tick_params(axis='y', labelcolor='r')
            self._setup_axes_limits(ax2, time, density)
            
            lines1, labels1 = ax1.get_legend_handles_labels()
            lines2, labels2 = ax2.get_legend_handles_labels()
            ax1.legend(lines1 + lines2, labels1 + labels2, loc='best')
            
            ax1.set_title(title)
            ax1.grid(True, alpha=0.3)
            
            if save_path:
                plt.savefig(save_path, dpi=300, bbox_inches='tight')
            
            return fig
            
        except Exception as e:
            raise VisualizationError(f"绘制孔隙率密度曲线失败: {e}") from e
    
    def show(self):
        """显示图形"""
        try:
            plt.show()
        except Exception as e:
            warnings.warn(f"显示图形失败: {e}")
    
    def close(self):
        """关闭图形"""
        try:
            plt.close('all')
        except Exception as e:
            warnings.warn(f"关闭图形失败: {e}")

import numpy as np
import open3d as o3d
from typing import Optional, Dict, List, Tuple
from pathlib import Path
import matplotlib.pyplot as plt
from matplotlib import cm
import matplotlib
matplotlib.use('Agg')


class PointCloudVisualizer:
    """点云三维可视化类"""
    
    def __init__(self):
        self.point_cloud: Optional[o3d.geometry.PointCloud] = None
        self.defect_labels: Optional[np.ndarray] = None
        self.thickness_values: Optional[np.ndarray] = None
        self.visualizer = None
        
    def set_point_cloud(self, pcd: o3d.geometry.PointCloud):
        """设置主点云"""
        self.point_cloud = pcd
        
    def set_defect_labels(self, labels: np.ndarray):
        """设置缺损标签"""
        self.defect_labels = labels
        
    def set_thickness_values(self, values: np.ndarray):
        """设置厚度值"""
        self.thickness_values = values
        
    def visualize_point_cloud(self,
                               window_name: str = "Point Cloud Visualization",
                               background_color: Tuple[float, float, float] = (0.1, 0.1, 0.1),
                               point_size: int = 2,
                               show_normals: bool = False) -> None:
        """
        可视化点云
        
        Args:
            window_name: 窗口名称
            background_color: 背景颜色
            point_size: 点大小
            show_normals: 是否显示法向量
        """
        if self.point_cloud is None:
            raise ValueError("未设置点云数据")
            
        vis = o3d.visualization.Visualizer()
        vis.create_window(window_name=window_name, width=1200, height=800)
        
        opt = vis.get_render_option()
        opt.background_color = np.asarray(background_color)
        opt.point_size = point_size
        opt.show_coordinate_frame = True
        
        if show_normals and self.point_cloud.has_normals():
            mesh = o3d.geometry.TriangleMesh.create_coordinate_frame()
            vis.add_geometry(mesh)
        
        vis.add_geometry(self.point_cloud)
        
        ctr = vis.get_view_control()
        ctr.set_zoom(0.8)
        
        vis.run()
        vis.destroy_window()
        
    def visualize_defects(self,
                          window_name: str = "Defect Visualization",
                          colormap: str = 'rainbow',
                          background_color: Tuple[float, float, float] = (0.1, 0.1, 0.1)) -> None:
        """
        可视化缺损
        
        Args:
            window_name: 窗口名称
            colormap: 颜色映射
            background_color: 背景颜色
        """
        if self.point_cloud is None or self.defect_labels is None:
            raise ValueError("点云或缺损标签未设置")
            
        points = np.asarray(self.point_cloud.points)
        n_points = len(points)
        
        colors = np.ones((n_points, 3)) * 0.5
        
        n_defects = int(np.max(self.defect_labels))
        if n_defects > 0:
            cmap = cm.get_cmap(colormap, n_defects)
            
            for defect_id in range(1, n_defects + 1):
                mask = self.defect_labels == defect_id
                if np.any(mask):
                    color = cmap(defect_id - 1)[:3]
                    colors[mask] = color
        
        defect_pcd = o3d.geometry.PointCloud()
        defect_pcd.points = o3d.utility.Vector3dVector(points)
        defect_pcd.colors = o3d.utility.Vector3dVector(colors)
        
        vis = o3d.visualization.Visualizer()
        vis.create_window(window_name=window_name, width=1200, height=800)
        
        opt = vis.get_render_option()
        opt.background_color = np.asarray(background_color)
        opt.point_size = 3
        opt.show_coordinate_frame = True
        
        vis.add_geometry(defect_pcd)
        vis.run()
        vis.destroy_window()
        
    def visualize_thickness(self,
                             window_name: str = "Thickness Visualization",
                             colormap: str = 'jet',
                             background_color: Tuple[float, float, float] = (0.1, 0.1, 0.1)) -> None:
        """
        可视化厚度分布
        
        Args:
            window_name: 窗口名称
            colormap: 颜色映射
            background_color: 背景颜色
        """
        if self.point_cloud is None or self.thickness_values is None:
            raise ValueError("点云或厚度值未设置")
            
        points = np.asarray(self.point_cloud.points)
        
        valid_mask = self.thickness_values > 0
        valid_thickness = self.thickness_values[valid_mask]
        
        colors = np.ones((len(points), 3)) * 0.3
        
        if len(valid_thickness) > 0:
            norm_thickness = (self.thickness_values - np.min(valid_thickness)) / \
                             (np.max(valid_thickness) - np.min(valid_thickness) + 1e-6)
            norm_thickness = np.clip(norm_thickness, 0, 1)
            
            cmap = cm.get_cmap(colormap)
            valid_colors = cmap(norm_thickness[valid_mask])[:, :3]
            colors[valid_mask] = valid_colors
        
        thickness_pcd = o3d.geometry.PointCloud()
        thickness_pcd.points = o3d.utility.Vector3dVector(points)
        thickness_pcd.colors = o3d.utility.Vector3dVector(colors)
        
        vis = o3d.visualization.Visualizer()
        vis.create_window(window_name=window_name, width=1200, height=800)
        
        opt = vis.get_render_option()
        opt.background_color = np.asarray(background_color)
        opt.point_size = 3
        opt.show_coordinate_frame = True
        
        vis.add_geometry(thickness_pcd)
        vis.run()
        vis.destroy_window()
        
    def visualize_all(self,
                      window_name: str = "Full Analysis Visualization") -> None:
        """
        综合可视化（多视图）
        
        Args:
            window_name: 窗口名称
        """
        if self.point_cloud is None:
            raise ValueError("未设置点云数据")
            
        o3d.visualization.draw_geometries(
            [self.point_cloud],
            window_name=window_name,
            width=1600,
            height=900,
            left=50,
            top=50
        )
        
    def save_visualization_image(self,
                                  output_path: str,
                                  view: str = 'front',
                                  width: int = 1920,
                                  height: int = 1080) -> str:
        """
        保存可视化图像
        
        Args:
            output_path: 输出路径
            view: 视角 ('front', 'side', 'top', 'iso')
            width: 图像宽度
            height: 图像高度
            
        Returns:
            保存的文件路径
        """
        if self.point_cloud is None:
            raise ValueError("未设置点云数据")
            
        vis = o3d.visualization.Visualizer()
        vis.create_window(width=width, height=height, visible=False)
        vis.add_geometry(self.point_cloud)
        
        ctr = vis.get_view_control()
        
        if view == 'front':
            ctr.set_lookat([0, 0, 0])
            ctr.set_front([0, 0, -1])
            ctr.set_up([0, 1, 0])
        elif view == 'side':
            ctr.set_lookat([0, 0, 0])
            ctr.set_front([-1, 0, 0])
            ctr.set_up([0, 1, 0])
        elif view == 'top':
            ctr.set_lookat([0, 0, 0])
            ctr.set_front([0, -1, 0])
            ctr.set_up([0, 0, -1])
        elif view == 'iso':
            ctr.set_lookat([0, 0, 0])
            ctr.set_front([-1, -1, -1])
            ctr.set_up([0, 1, 0])
        
        ctr.set_zoom(0.8)
        
        vis.poll_events()
        vis.update_renderer()
        
        vis.capture_screen_image(output_path, do_render=True)
        vis.destroy_window()
        
        return output_path
        
    def create_thickness_colormap_legend(self,
                                          output_path: str,
                                          colormap: str = 'jet',
                                          title: str = "Thickness Colormap") -> str:
        """
        创建厚度颜色映射图例
        
        Args:
            output_path: 输出路径
            colormap: 颜色映射名称
            title: 图例标题
            
        Returns:
            保存的文件路径
        """
        if self.thickness_values is None:
            raise ValueError("未设置厚度值")
            
        valid_thickness = self.thickness_values[self.thickness_values > 0]
        if len(valid_thickness) == 0:
            raise ValueError("没有有效的厚度数据")
            
        min_t = np.min(valid_thickness)
        max_t = np.max(valid_thickness)
        
        fig, ax = plt.subplots(figsize=(8, 1))
        fig.subplots_adjust(bottom=0.5)
        
        norm = plt.Normalize(vmin=min_t, vmax=max_t)
        cmap = cm.get_cmap(colormap)
        
        cb = matplotlib.colorbar.ColorbarBase(
            ax, cmap=cmap, norm=norm, orientation='horizontal'
        )
        cb.set_label(title)
        
        plt.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close()
        
        return output_path
        
    def export_3d_model(self,
                         output_path: str,
                         format: str = 'ply',
                         colored_by: str = 'none') -> str:
        """
        导出3D模型
        
        Args:
            output_path: 输出路径
            format: 导出格式 ('ply', 'pcd', 'xyz')
            colored_by: 着色方式 ('none', 'defect', 'thickness')
            
        Returns:
            保存的文件路径
        """
        if self.point_cloud is None:
            raise ValueError("未设置点云数据")
            
        export_pcd = o3d.geometry.PointCloud()
        export_pcd.points = self.point_cloud.points
        
        if colored_by == 'defect' and self.defect_labels is not None:
            n_points = len(self.defect_labels)
            colors = np.ones((n_points, 3)) * 0.5
            
            n_defects = int(np.max(self.defect_labels))
            if n_defects > 0:
                cmap = cm.get_cmap('rainbow', n_defects)
                for defect_id in range(1, n_defects + 1):
                    mask = self.defect_labels == defect_id
                    if np.any(mask):
                        color = cmap(defect_id - 1)[:3]
                        colors[mask] = color
            
            export_pcd.colors = o3d.utility.Vector3dVector(colors)
            
        elif colored_by == 'thickness' and self.thickness_values is not None:
            points = np.asarray(self.point_cloud.points)
            colors = np.ones((len(points), 3)) * 0.3
            
            valid_mask = self.thickness_values > 0
            valid_thickness = self.thickness_values[valid_mask]
            
            if len(valid_thickness) > 0:
                norm_thickness = (self.thickness_values - np.min(valid_thickness)) / \
                                 (np.max(valid_thickness) - np.min(valid_thickness) + 1e-6)
                norm_thickness = np.clip(norm_thickness, 0, 1)
                
                cmap = cm.get_cmap('jet')
                valid_colors = cmap(norm_thickness[valid_mask])[:, :3]
                colors[valid_mask] = valid_colors
            
            export_pcd.colors = o3d.utility.Vector3dVector(colors)
            
        elif self.point_cloud.has_colors():
            export_pcd.colors = self.point_cloud.colors
            
        output_path = str(Path(output_path).with_suffix(f'.{format}'))
        
        if format == 'ply':
            o3d.io.write_point_cloud(output_path, export_pcd, write_ascii=True)
        elif format == 'pcd':
            o3d.io.write_point_cloud(output_path, export_pcd, write_ascii=True)
        elif format == 'xyz':
            o3d.io.write_point_cloud(output_path, export_pcd, write_ascii=True)
        else:
            raise ValueError(f"不支持的导出格式: {format}")
            
        return output_path
        
    def create_comparison_view(self,
                                reference_pcd: o3d.geometry.PointCloud,
                                output_path: str,
                                width: int = 1920,
                                height: int = 1080) -> str:
        """
        创建对比视图
        
        Args:
            reference_pcd: 参考点云
            output_path: 输出路径
            width: 图像宽度
            height: 图像高度
            
        Returns:
            保存的文件路径
        """
        if self.point_cloud is None:
            raise ValueError("未设置点云数据")
            
        pcd1 = o3d.geometry.PointCloud()
        pcd1.points = self.point_cloud.points
        pcd1.paint_uniform_color([1, 0, 0])
        
        pcd2 = o3d.geometry.PointCloud()
        pcd2.points = reference_pcd.points
        pcd2.paint_uniform_color([0, 1, 0])
        
        vis = o3d.visualization.Visualizer()
        vis.create_window(width=width, height=height, visible=False)
        vis.add_geometry(pcd1)
        vis.add_geometry(pcd2)
        
        ctr = vis.get_view_control()
        ctr.set_zoom(0.8)
        
        vis.poll_events()
        vis.update_renderer()
        vis.capture_screen_image(output_path, do_render=True)
        vis.destroy_window()
        
        return output_path
        
    def generate_analysis_plots(self,
                                 output_dir: str,
                                 defect_summary: Optional[Dict] = None,
                                 thickness_stats: Optional[Dict] = None) -> Dict[str, str]:
        """
        生成分析图表
        
        Args:
            output_dir: 输出目录
            defect_summary: 缺损摘要
            thickness_stats: 厚度统计
            
        Returns:
            生成的文件路径字典
        """
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        generated_files = {}
        
        if defect_summary:
            severity_dist = defect_summary.get('severity_distribution', {})
            type_dist = defect_summary.get('type_distribution', {})
            
            if severity_dist:
                fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
                
                severities = list(severity_dist.keys())
                counts = list(severity_dist.values())
                colors = ['#e74c3c', '#e67e22', '#f39c12', '#27ae60'][:len(severities)]
                
                bars = ax1.bar(severities, counts, color=colors)
                ax1.set_xlabel('Severity Level')
                ax1.set_ylabel('Count')
                ax1.set_title('Defect Severity Distribution')
                
                for bar in bars:
                    height = bar.get_height()
                    ax1.text(bar.get_x() + bar.get_width()/2., height,
                            f'{int(height)}', ha='center', va='bottom')
                
                if type_dist:
                    types = list(type_dist.keys())
                    counts = list(type_dist.values())
                    
                    ax2.pie(counts, labels=types, autopct='%1.1f%%', startangle=90)
                    ax2.set_title('Defect Type Distribution')
                
                plt.tight_layout()
                defect_plot_path = output_path / 'defect_analysis.png'
                plt.savefig(defect_plot_path, dpi=150, bbox_inches='tight')
                plt.close()
                
                generated_files['defect_plot'] = str(defect_plot_path)
        
        if thickness_stats:
            fig, ax = plt.subplots(figsize=(10, 6))
            
            stats_labels = ['Min', '25%', 'Median', '75%', 'Max', 'Mean']
            stats_values = [
                thickness_stats.get('min', 0),
                thickness_stats.get('percentile_25', 0),
                thickness_stats.get('median', 0),
                thickness_stats.get('percentile_75', 0),
                thickness_stats.get('max', 0),
                thickness_stats.get('mean', 0)
            ]
            
            bars = ax.bar(stats_labels, stats_values,
                         color=['#e74c3c', '#e67e22', '#f39c12', '#27ae60', '#3498db', '#9b59b6'])
            ax.set_ylabel('Thickness')
            ax.set_title('Thickness Statistics')
            ax.grid(True, alpha=0.3, axis='y')
            
            for bar in bars:
                height = bar.get_height()
                ax.text(bar.get_x() + bar.get_width()/2., height,
                       f'{height:.2f}', ha='center', va='bottom')
            
            plt.tight_layout()
            thickness_plot_path = output_path / 'thickness_analysis.png'
            plt.savefig(thickness_plot_path, dpi=150, bbox_inches='tight')
            plt.close()
            
            generated_files['thickness_plot'] = str(thickness_plot_path)
        
        return generated_files

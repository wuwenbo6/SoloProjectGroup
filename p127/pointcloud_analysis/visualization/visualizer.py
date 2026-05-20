import numpy as np
import open3d as o3d
import matplotlib.pyplot as plt
from typing import Optional, List, Tuple
import os


class Visualizer3D:
    def __init__(self):
        self.vis = None
        self.output_dir = "visualizations"
        os.makedirs(self.output_dir, exist_ok=True)

    def visualize_point_cloud(self, point_cloud: o3d.geometry.PointCloud,
                               title: str = "Point Cloud",
                               save: bool = False,
                               filename: Optional[str] = None) -> None:
        o3d.visualization.draw_geometries(
            [point_cloud],
            window_name=title,
            width=1200,
            height=800
        )

        if save:
            self._save_view(point_cloud, title, filename)

    def visualize_wear_regions(self, reference_cloud: o3d.geometry.PointCloud,
                               test_cloud: o3d.geometry.PointCloud,
                               wear_mask: np.ndarray,
                               title: str = "Wear Regions",
                               save: bool = False) -> None:
        ref_colored = o3d.geometry.PointCloud(reference_cloud)
        ref_colored.paint_uniform_color([0.6, 0.6, 0.6])

        test_points = np.asarray(test_cloud.points)
        test_colors = np.zeros((len(test_points), 3))
        test_colors[wear_mask] = [1, 0, 0]
        test_colors[~wear_mask] = [0, 0.6, 0.9]

        test_colored = o3d.geometry.PointCloud(test_cloud)
        test_colored.colors = o3d.utility.Vector3dVector(test_colors)

        geometries = [ref_colored, test_colored]

        o3d.visualization.draw_geometries(
            geometries,
            window_name=title,
            width=1200,
            height=800
        )

        if save:
            self._save_view(geometries, title, "wear_regions")

    def visualize_thickness(self, point_cloud: o3d.geometry.PointCloud,
                            thickness_values: np.ndarray,
                            title: str = "Thickness Visualization",
                            save: bool = False) -> None:
        points = np.asarray(point_cloud.points)
        valid_mask = ~np.isnan(thickness_values)

        colors = np.zeros((len(points), 3))

        if np.any(valid_mask):
            valid_thickness = thickness_values[valid_mask]
            norm_thickness = (valid_thickness - np.min(valid_thickness)) / \
                             (np.max(valid_thickness) - np.min(valid_thickness) + 1e-8)

            cmap = plt.get_cmap('jet')
            colors[valid_mask] = cmap(norm_thickness)[:, :3]

        colors[~valid_mask] = [0.3, 0.3, 0.3]

        colored_cloud = o3d.geometry.PointCloud(point_cloud)
        colored_cloud.colors = o3d.utility.Vector3dVector(colors)

        o3d.visualization.draw_geometries(
            [colored_cloud],
            window_name=title,
            width=1200,
            height=800
        )

        if save:
            self._save_view([colored_cloud], title, "thickness")

    def visualize_registration(self, reference_cloud: o3d.geometry.PointCloud,
                               source_cloud: o3d.geometry.PointCloud,
                               transformed_source: o3d.geometry.PointCloud,
                               save: bool = False) -> None:
        ref_colored = o3d.geometry.PointCloud(reference_cloud)
        ref_colored.paint_uniform_color([0.1, 0.9, 0.1])

        source_colored = o3d.geometry.PointCloud(source_cloud)
        source_colored.paint_uniform_color([0.9, 0.1, 0.1])

        transformed_colored = o3d.geometry.PointCloud(transformed_source)
        transformed_colored.paint_uniform_color([0.1, 0.1, 0.9])

        geometries = [ref_colored, source_colored, transformed_colored]

        o3d.visualization.draw_geometries(
            geometries,
            window_name="Registration Result",
            width=1200,
            height=800
        )

        if save:
            self._save_view(geometries, "registration", "registration")

    def visualize_risk_zones(self, point_cloud: o3d.geometry.PointCloud,
                             risk_zones: dict,
                             title: str = "Risk Zones",
                             save: bool = False) -> None:
        points = np.asarray(point_cloud.points)
        colors = np.zeros((len(points), 3))

        safe_mask = np.zeros(len(points), dtype=bool)
        for i, p in enumerate(points):
            for zone_point in risk_zones.get('safe', []):
                if np.allclose(p, zone_point, atol=1e-6):
                    safe_mask[i] = True
                    break

        warning_mask = np.zeros(len(points), dtype=bool)
        for i, p in enumerate(points):
            for zone_point in risk_zones.get('warning', []):
                if np.allclose(p, zone_point, atol=1e-6):
                    warning_mask[i] = True
                    break

        danger_mask = np.zeros(len(points), dtype=bool)
        for i, p in enumerate(points):
            for zone_point in risk_zones.get('danger', []):
                if np.allclose(p, zone_point, atol=1e-6):
                    danger_mask[i] = True
                    break

        critical_mask = np.zeros(len(points), dtype=bool)
        for i, p in enumerate(points):
            for zone_point in risk_zones.get('critical', []):
                if np.allclose(p, zone_point, atol=1e-6):
                    critical_mask[i] = True
                    break

        colors[safe_mask] = [0, 1, 0]
        colors[warning_mask] = [1, 1, 0]
        colors[danger_mask] = [1, 0.5, 0]
        colors[critical_mask] = [1, 0, 0]

        default_mask = ~(safe_mask | warning_mask | danger_mask | critical_mask)
        colors[default_mask] = [0.7, 0.7, 0.7]

        colored_cloud = o3d.geometry.PointCloud(point_cloud)
        colored_cloud.colors = o3d.utility.Vector3dVector(colors)

        o3d.visualization.draw_geometries(
            [colored_cloud],
            window_name=title,
            width=1200,
            height=800
        )

        if save:
            self._save_view([colored_cloud], title, "risk_zones")

    def create_comparison_view(self, reference_cloud: o3d.geometry.PointCloud,
                               test_cloud: o3d.geometry.PointCloud,
                               title: str = "Comparison View") -> None:
        ref_colored = o3d.geometry.PointCloud(reference_cloud)
        ref_colored.paint_uniform_color([0.1, 0.9, 0.1])

        test_colored = o3d.geometry.PointCloud(test_cloud)
        test_colored.paint_uniform_color([0.9, 0.1, 0.1])

        test_translated = o3d.geometry.PointCloud(test_cloud)
        bounds = reference_cloud.get_axis_aligned_bounding_box()
        translation = np.array([bounds.get_extent()[0] * 1.5, 0, 0])
        test_translated.translate(translation)
        test_translated.paint_uniform_color([0.9, 0.1, 0.1])

        geometries = [ref_colored, test_translated]

        o3d.visualization.draw_geometries(
            geometries,
            window_name=title,
            width=1600,
            height=800
        )

    def _save_view(self, geometries, title: str, filename: Optional[str] = None) -> None:
        if filename is None:
            filename = title.replace(" ", "_").lower()

        vis = o3d.visualization.Visualizer()
        vis.create_window(width=1200, height=800, visible=False)

        for geo in geometries:
            vis.add_geometry(geo)

        vis.update_renderer()
        image_path = os.path.join(self.output_dir, f"{filename}.png")
        vis.capture_screen_image(image_path)
        vis.destroy_window()

    def create_thickness_histogram(self, thickness_values: np.ndarray,
                                    save: bool = False,
                                    filename: str = "thickness_histogram.png") -> None:
        valid_thickness = thickness_values[~np.isnan(thickness_values)]

        plt.figure(figsize=(12, 6))
        n, bins, patches = plt.hist(valid_thickness, bins=50, edgecolor='black', alpha=0.7)

        cmap = plt.get_cmap('jet')
        bin_centers = 0.5 * (bins[:-1] + bins[1:])
        norm = plt.Normalize(bin_centers.min(), bin_centers.max())

        for c, p in zip(bin_centers, patches):
            plt.setp(p, 'facecolor', cmap(norm(c)))

        plt.xlabel('厚度 (m)', fontsize=12)
        plt.ylabel('点数', fontsize=12)
        plt.title('厚度分布直方图', fontsize=14, fontweight='bold')
        plt.grid(True, alpha=0.3)

        plt.axvline(np.mean(valid_thickness), color='red', linestyle='--',
                    linewidth=2, label=f'平均值: {np.mean(valid_thickness):.4f}m')
        plt.axvline(np.median(valid_thickness), color='green', linestyle='--',
                    linewidth=2, label=f'中位数: {np.median(valid_thickness):.4f}m')
        plt.legend()

        plt.tight_layout()

        if save:
            output_path = os.path.join(self.output_dir, filename)
            plt.savefig(output_path, dpi=300, bbox_inches='tight')
            plt.close()
        else:
            plt.show()

    def create_wear_summary_plot(self, wear_stats: dict,
                                  save: bool = False,
                                  filename: str = "wear_summary.png") -> None:
        fig, axes = plt.subplots(1, 2, figsize=(14, 6))

        categories = ['安全区域', '警告区域', '危险区域', '严重区域']
        percentages = [
            wear_stats.get('safe_percentage', 0),
            wear_stats.get('warning_percentage', 0),
            wear_stats.get('danger_percentage', 0),
            wear_stats.get('critical_percentage', 0)
        ]
        colors = ['#28a745', '#ffc107', '#fd7e14', '#dc3545']

        axes[0].pie(percentages, labels=categories, colors=colors,
                    autopct='%1.1f%%', startangle=90)
        axes[0].set_title('风险区域分布', fontsize=14, fontweight='bold')

        wear_metrics = ['磨损面积', '最大深度', '平均深度']
        wear_values = [
            wear_stats.get('wear_percentage', 0),
            wear_stats.get('max_wear_depth', 0) * 1000,
            wear_stats.get('mean_wear_depth', 0) * 1000
        ]
        wear_units = ['%', 'mm', 'mm']

        bars = axes[1].bar(wear_metrics, wear_values, color=['#667eea', '#764ba2', '#f093fb'])
        axes[1].set_ylabel('数值', fontsize=12)
        axes[1].set_title('磨损统计指标', fontsize=14, fontweight='bold')

        for bar, value, unit in zip(bars, wear_values, wear_units):
            height = bar.get_height()
            axes[1].text(bar.get_x() + bar.get_width() / 2., height,
                         f'{value:.2f} {unit}', ha='center', va='bottom', fontsize=11)

        plt.tight_layout()

        if save:
            output_path = os.path.join(self.output_dir, filename)
            plt.savefig(output_path, dpi=300, bbox_inches='tight')
            plt.close()
        else:
            plt.show()

    def create_comprehensive_report_visuals(self, analysis_results: dict,
                                             save_dir: Optional[str] = None) -> List[str]:
        if save_dir is None:
            save_dir = self.output_dir

        generated_files = []

        thickness_eval = analysis_results.get('thickness_evaluation', {})
        if thickness_eval:
            stats = {
                'safe_percentage': thickness_eval.get('safe_percentage', 0),
                'warning_percentage': thickness_eval.get('warning_percentage', 0),
                'danger_percentage': thickness_eval.get('danger_percentage', 0),
                'critical_percentage': thickness_eval.get('critical_percentage', 0),
                'wear_percentage': analysis_results.get('wear_evaluation', {}).get('wear_percentage', 0),
                'max_wear_depth': analysis_results.get('wear_evaluation', {}).get('max_wear_depth', 0),
                'mean_wear_depth': analysis_results.get('wear_evaluation', {}).get('mean_wear_depth', 0)
            }

            summary_file = os.path.join(save_dir, "report_summary.png")
            self.create_wear_summary_plot(stats, save=True, filename=summary_file)
            generated_files.append(summary_file)

        return generated_files

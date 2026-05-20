import os
import numpy as np
import open3d as o3d
from typing import List, Optional, Tuple, Dict
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap


class PointCloudVisualizer:
    def __init__(self):
        self.output_dir = "visualizations"
        os.makedirs(self.output_dir, exist_ok=True)

    def visualize_point_cloud(self, point_cloud: o3d.geometry.PointCloud,
                               window_name: str = "Point Cloud",
                               width: int = 1280,
                               height: int = 720,
                               background_color: Optional[List[float]] = None):
        vis = o3d.visualization.Visualizer()
        vis.create_window(window_name=window_name, width=width, height=height)
        
        if background_color is not None:
            opt = vis.get_render_option()
            opt.background_color = np.asarray(background_color)
        
        vis.add_geometry(point_cloud)
        vis.run()
        vis.destroy_window()

    def visualize_multiple_point_clouds(self, point_clouds: List[o3d.geometry.PointCloud],
                                        labels: Optional[List[str]] = None,
                                        window_name: str = "Multiple Point Clouds",
                                        separate_windows: bool = False):
        if separate_windows:
            for i, pc in enumerate(point_clouds):
                label = labels[i] if labels else f"Point Cloud {i}"
                self.visualize_point_cloud(pc, window_name=label)
        else:
            vis = o3d.visualization.Visualizer()
            vis.create_window(window_name=window_name)
            
            for pc in point_clouds:
                vis.add_geometry(pc)
            
            vis.run()
            vis.destroy_window()

    def visualize_wear_heatmap(self, point_cloud: o3d.geometry.PointCloud,
                               distances: np.ndarray,
                               window_name: str = "Wear Heatmap",
                               save_to_file: bool = False,
                               filename: str = "wear_heatmap.png"):
        colors = np.zeros((len(distances), 3))
        
        norm_dist = np.clip(distances, -0.05, 0.05)
        norm_dist = (norm_dist + 0.05) / 0.1
        
        cmap = plt.get_cmap('jet')
        
        for i, val in enumerate(norm_dist):
            if val < 0.3:
                colors[i] = [1, 0, 0]
            elif val < 0.5:
                colors[i] = [1, 1, 0]
            elif val < 0.7:
                colors[i] = [0, 1, 0]
            else:
                colors[i] = [0, 0, 1]
        
        heatmap_pcd = o3d.geometry.PointCloud(point_cloud)
        heatmap_pcd.colors = o3d.utility.Vector3dVector(colors)
        
        if save_to_file:
            self.capture_point_cloud_image(heatmap_pcd, filename, window_name)
        
        self.visualize_point_cloud(heatmap_pcd, window_name=window_name)
        
        return heatmap_pcd

    def visualize_thickness_heatmap(self, point_cloud: o3d.geometry.PointCloud,
                                    thickness_values: np.ndarray,
                                    window_name: str = "Thickness Heatmap",
                                    save_to_file: bool = False,
                                    filename: str = "thickness_heatmap.png"):
        colors = np.zeros((len(thickness_values), 3))
        
        valid_mask = thickness_values > 0
        if np.any(valid_mask):
            valid_thickness = thickness_values[valid_mask]
            min_thick = np.min(valid_thickness)
            max_thick = np.max(valid_thickness)
            
            normalized = np.zeros_like(thickness_values)
            normalized[valid_mask] = (valid_thickness - min_thick) / (max_thick - min_thick + 1e-8)
            
            for i, val in enumerate(normalized):
                if not valid_mask[i]:
                    colors[i] = [0.5, 0.5, 0.5]
                elif val < 0.2:
                    colors[i] = [1, 0, 0]
                elif val < 0.4:
                    colors[i] = [1, 0.5, 0]
                elif val < 0.6:
                    colors[i] = [1, 1, 0]
                elif val < 0.8:
                    colors[i] = [0, 1, 0]
                else:
                    colors[i] = [0, 0, 1]
        else:
            colors[:] = [0.5, 0.5, 0.5]
        
        heatmap_pcd = o3d.geometry.PointCloud(point_cloud)
        heatmap_pcd.colors = o3d.utility.Vector3dVector(colors)
        
        if save_to_file:
            self.capture_point_cloud_image(heatmap_pcd, filename, window_name)
        
        self.visualize_point_cloud(heatmap_pcd, window_name=window_name)
        
        return heatmap_pcd

    def visualize_wear_regions(self, original_pcd: o3d.geometry.PointCloud,
                               wear_regions: List[o3d.geometry.PointCloud],
                               window_name: str = "Wear Regions",
                               region_colors: Optional[List[List[float]]] = None):
        vis = o3d.visualization.Visualizer()
        vis.create_window(window_name=window_name)
        
        original_colored = o3d.geometry.PointCloud(original_pcd)
        original_colored.paint_uniform_color([0.7, 0.7, 0.7])
        vis.add_geometry(original_colored)
        
        if region_colors is None:
            region_colors = [
                [1, 0, 0],
                [1, 0.5, 0],
                [1, 1, 0],
                [0, 1, 0],
                [0, 0, 1]
            ]
        
        for i, region in enumerate(wear_regions):
            color = region_colors[i % len(region_colors)]
            region_colored = o3d.geometry.PointCloud(region)
            region_colored.paint_uniform_color(color)
            vis.add_geometry(region_colored)
        
        vis.run()
        vis.destroy_window()

    def visualize_surface_reconstruction(self, point_cloud: o3d.geometry.PointCloud,
                                         method: str = "poisson",
                                         depth: int = 9,
                                         window_name: str = "Surface Reconstruction"):
        if not point_cloud.has_normals():
            point_cloud.estimate_normals(
                search_param=o3d.geometry.KDTreeSearchParamHybrid(radius=0.1, max_nn=30)
            )
            point_cloud.orient_normals_consistent_tangent_plane(k=15)
        
        if method == "poisson":
            mesh, densities = o3d.geometry.TriangleMesh.create_from_point_cloud_poisson(
                point_cloud, depth=depth
            )
            
            densities = np.asarray(densities)
            density_colors = plt.get_cmap('viridis')(
                (densities - densities.min()) / (densities.max() - densities.min())
            )
            density_colors = density_colors[:, :3]
            mesh.vertex_colors = o3d.utility.Vector3dVector(density_colors)
            
        elif method == "ball_pivoting":
            distances = point_cloud.compute_nearest_neighbor_distance()
            avg_dist = np.mean(distances)
            radius = 2 * avg_dist
            
            radii = [radius, radius * 2, radius * 4]
            mesh = o3d.geometry.TriangleMesh.create_from_point_cloud_ball_pivoting(
                point_cloud, o3d.utility.DoubleVector(radii)
            )
            
            mesh.paint_uniform_color([0.7, 0.7, 0.7])
            
        else:
            raise ValueError(f"Unknown method: {method}. Use 'poisson' or 'ball_pivoting'")
        
        vis = o3d.visualization.Visualizer()
        vis.create_window(window_name=window_name)
        vis.add_geometry(mesh)
        vis.run()
        vis.destroy_window()
        
        return mesh

    def capture_point_cloud_image(self, point_cloud: o3d.geometry.PointCloud,
                                  filename: str,
                                  window_name: str = "Capture",
                                  width: int = 1920,
                                  height: int = 1080):
        filepath = os.path.join(self.output_dir, filename)
        
        vis = o3d.visualization.Visualizer()
        vis.create_window(window_name=window_name, width=width, height=height, visible=False)
        vis.add_geometry(point_cloud)
        vis.poll_events()
        vis.update_renderer()
        vis.capture_screen_image(filepath)
        vis.destroy_window()
        
        return filepath

    def create_comparison_visualization(self, reference_pcd: o3d.geometry.PointCloud,
                                        measured_pcd: o3d.geometry.PointCloud,
                                        distances: np.ndarray,
                                        save_to_file: bool = False,
                                        filename: str = "comparison.png"):
        reference_colored = o3d.geometry.PointCloud(reference_pcd)
        reference_colored.paint_uniform_color([0, 1, 0])
        
        measured_colors = np.zeros((len(distances), 3))
        norm_dist = np.clip(distances, -0.05, 0.05)
        norm_dist = (norm_dist + 0.05) / 0.1
        
        for i, val in enumerate(norm_dist):
            if val < 0.3:
                measured_colors[i] = [1, 0, 0]
            elif val < 0.5:
                measured_colors[i] = [1, 1, 0]
            elif val < 0.7:
                measured_colors[i] = [0, 1, 0]
            else:
                measured_colors[i] = [0, 0, 1]
        
        measured_colored = o3d.geometry.PointCloud(measured_pcd)
        measured_colored.colors = o3d.utility.Vector3dVector(measured_colors)
        
        translation = np.array([2, 0, 0])
        reference_translated = o3d.geometry.PointCloud(reference_colored)
        reference_translated.translate(translation)
        
        combined_clouds = [measured_colored, reference_translated]
        
        if save_to_file:
            combined = measured_colored + reference_translated
            self.capture_point_cloud_image(combined, filename)
        
        self.visualize_multiple_point_clouds(combined_clouds, window_name="Comparison: Measured (left) vs Reference (right)")
        
        return combined_clouds

    def visualize_with_bounding_boxes(self, point_cloud: o3d.geometry.PointCloud,
                                       regions: List[o3d.geometry.PointCloud],
                                       window_name: str = "Regions with Bounding Boxes"):
        vis = o3d.visualization.Visualizer()
        vis.create_window(window_name=window_name)
        
        main_colored = o3d.geometry.PointCloud(point_cloud)
        main_colored.paint_uniform_color([0.7, 0.7, 0.7])
        vis.add_geometry(main_colored)
        
        for region in regions:
            bbox = region.get_axis_aligned_bounding_box()
            bbox.color = (1, 0, 0)
            vis.add_geometry(bbox)
            
            region_colored = o3d.geometry.PointCloud(region)
            region_colored.paint_uniform_color([1, 0.2, 0.2])
            vis.add_geometry(region_colored)
        
        vis.run()
        vis.destroy_window()

    def plot_thickness_histogram(self, thickness_values: np.ndarray,
                                 save_to_file: bool = False,
                                 filename: str = "thickness_histogram.png"):
        valid_values = thickness_values[thickness_values > 0]
        
        plt.figure(figsize=(10, 6))
        plt.hist(valid_values, bins=50, edgecolor='black', alpha=0.7)
        plt.xlabel('Thickness (m)')
        plt.ylabel('Frequency')
        plt.title('Thickness Distribution Histogram')
        plt.grid(True, alpha=0.3)
        
        mean_val = np.mean(valid_values)
        plt.axvline(mean_val, color='red', linestyle='--', label=f'Mean: {mean_val:.4f} m')
        plt.legend()
        
        if save_to_file:
            filepath = os.path.join(self.output_dir, filename)
            plt.savefig(filepath, dpi=300, bbox_inches='tight')
        
        plt.close()
        
        return filepath if save_to_file else None

    def plot_wear_depth_distribution(self, wear_distances: np.ndarray,
                                     save_to_file: bool = False,
                                     filename: str = "wear_depth_distribution.png"):
        wear_depths = np.abs(wear_distances[wear_distances < 0])
        
        plt.figure(figsize=(10, 6))
        plt.hist(wear_depths, bins=30, edgecolor='black', alpha=0.7, color='red')
        plt.xlabel('Wear Depth (m)')
        plt.ylabel('Frequency')
        plt.title('Wear Depth Distribution')
        plt.grid(True, alpha=0.3)
        
        if len(wear_depths) > 0:
            mean_depth = np.mean(wear_depths)
            max_depth = np.max(wear_depths)
            plt.axvline(mean_depth, color='blue', linestyle='--', label=f'Mean: {mean_depth:.4f} m')
            plt.axvline(max_depth, color='green', linestyle='--', label=f'Max: {max_depth:.4f} m')
            plt.legend()
        
        if save_to_file:
            filepath = os.path.join(self.output_dir, filename)
            plt.savefig(filepath, dpi=300, bbox_inches='tight')
        
        plt.close()
        
        return filepath if save_to_file else None


__all__ = ['PointCloudVisualizer']
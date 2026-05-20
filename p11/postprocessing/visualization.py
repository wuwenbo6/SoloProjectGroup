import numpy as np
import matplotlib.pyplot as plt
from matplotlib import animation
from dolfin import *


class Visualizer2D:
    def __init__(self, simulation):
        self.simulation = simulation
        self.mesh = simulation.mesh

    def plot_mesh(self, title="Mesh", show=True, save_path=None):
        plt.figure(figsize=(8, 6))
        plot(self.mesh, title=title)
        plt.xlabel("x")
        plt.ylabel("y")
        plt.axis("equal")
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches="tight")
        if show:
            plt.show()
        else:
            plt.close()

    def plot_displacement(self, title="Displacement Field", show=True, save_path=None, warp_factor=1.0):
        plt.figure(figsize=(10, 8))
        p = plot(self.simulation.u, mode="displacement", title=title, warp_factor=warp_factor)
        plt.colorbar(p, label="Displacement magnitude")
        plt.xlabel("x")
        plt.ylabel("y")
        plt.axis("equal")
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches="tight")
        if show:
            plt.show()
        else:
            plt.close()

    def plot_displacement_components(self, show=True, save_prefix=None):
        ux = project(self.simulation.u.sub(0), FunctionSpace(self.mesh, "P", 1))
        uy = project(self.simulation.u.sub(1), FunctionSpace(self.mesh, "P", 1))

        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 6))

        plt.sca(ax1)
        p1 = plot(ux, title="x-displacement")
        plt.colorbar(p1, label="u_x")
        plt.xlabel("x")
        plt.ylabel("y")
        plt.axis("equal")

        plt.sca(ax2)
        p2 = plot(uy, title="y-displacement")
        plt.colorbar(p2, label="u_y")
        plt.xlabel("x")
        plt.ylabel("y")
        plt.axis("equal")

        plt.tight_layout()
        if save_prefix:
            plt.savefig(f"{save_prefix}_displacement_components.png", dpi=300, bbox_inches="tight")
        if show:
            plt.show()
        else:
            plt.close()

    def plot_von_mises_stress(self, title="Von Mises Stress", show=True, save_path=None):
        von_mises = self.simulation.get_von_mises_stress()
        if von_mises is None:
            return

        plt.figure(figsize=(10, 8))
        p = plot(von_mises, title=title)
        plt.colorbar(p, label="Stress")
        plt.xlabel("x")
        plt.ylabel("y")
        plt.axis("equal")
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches="tight")
        if show:
            plt.show()
        else:
            plt.close()

    def plot_stress_components(self, show=True, save_prefix=None):
        if self.simulation.sigma is None:
            return

        V_scalar = FunctionSpace(self.mesh, "P", 1)
        sigma_xx = project(self.simulation.sigma[0, 0], V_scalar)
        sigma_yy = project(self.simulation.sigma[1, 1], V_scalar)
        sigma_xy = project(self.simulation.sigma[0, 1], V_scalar)

        fig, axes = plt.subplots(1, 3, figsize=(18, 5))

        plt.sca(axes[0])
        p1 = plot(sigma_xx, title=r"$\sigma_{xx}$")
        plt.colorbar(p1)
        plt.xlabel("x")
        plt.ylabel("y")
        plt.axis("equal")

        plt.sca(axes[1])
        p2 = plot(sigma_yy, title=r"$\sigma_{yy}$")
        plt.colorbar(p2)
        plt.xlabel("x")
        plt.ylabel("y")
        plt.axis("equal")

        plt.sca(axes[2])
        p3 = plot(sigma_xy, title=r"$\sigma_{xy}$")
        plt.colorbar(p3)
        plt.xlabel("x")
        plt.ylabel("y")
        plt.axis("equal")

        plt.tight_layout()
        if save_prefix:
            plt.savefig(f"{save_prefix}_stress_components.png", dpi=300, bbox_inches="tight")
        if show:
            plt.show()
        else:
            plt.close()

    def plot_strain_components(self, show=True, save_prefix=None):
        if self.simulation.epsilon is None:
            return

        V_scalar = FunctionSpace(self.mesh, "P", 1)
        eps_xx = project(self.simulation.epsilon[0, 0], V_scalar)
        eps_yy = project(self.simulation.epsilon[1, 1], V_scalar)
        eps_xy = project(self.simulation.epsilon[0, 1], V_scalar)

        fig, axes = plt.subplots(1, 3, figsize=(18, 5))

        plt.sca(axes[0])
        p1 = plot(eps_xx, title=r"$\epsilon_{xx}$")
        plt.colorbar(p1)
        plt.xlabel("x")
        plt.ylabel("y")
        plt.axis("equal")

        plt.sca(axes[1])
        p2 = plot(eps_yy, title=r"$\epsilon_{yy}$")
        plt.colorbar(p2)
        plt.xlabel("x")
        plt.ylabel("y")
        plt.axis("equal")

        plt.sca(axes[2])
        p3 = plot(eps_xy, title=r"$\epsilon_{xy}$")
        plt.colorbar(p3)
        plt.xlabel("x")
        plt.ylabel("y")
        plt.axis("equal")

        plt.tight_layout()
        if save_prefix:
            plt.savefig(f"{save_prefix}_strain_components.png", dpi=300, bbox_inches="tight")
        if show:
            plt.show()
        else:
            plt.close()

    def create_deformation_animation(self, num_frames=50, max_warp=1.0, interval=50,
                                     title="Deformation Animation", save_path=None,
                                     downsample_ratio=1, use_blit=True, show_progress=True):
        from matplotlib.tri import Triangulation
        import time

        coords_orig = self.mesh.coordinates().copy()
        cells = self.mesh.cells()
        num_cells = len(cells)

        if downsample_ratio > 1 and num_cells > 1000:
            sample_indices = np.arange(0, num_cells, downsample_ratio)
            cells = cells[sample_indices]
            warnings.warn(f"网格降采样: {num_cells} -> {len(cells)} 单元 (ratio={downsample_ratio})")

        u_values = self.simulation.u.compute_vertex_values(self.mesh)
        ux = u_values[:len(coords_orig)]
        uy = u_values[len(coords_orig):]

        warp_factors = max_warp * np.sin(np.linspace(0, np.pi, num_frames))

        x_min = coords_orig[:, 0].min() + np.min(warp_factors) * ux.min()
        x_max = coords_orig[:, 0].max() + np.max(warp_factors) * ux.max()
        y_min = coords_orig[:, 1].min() + np.min(warp_factors) * uy.min()
        y_max = coords_orig[:, 1].max() + np.max(warp_factors) * uy.max()

        margin_x = 0.05 * (x_max - x_min)
        margin_y = 0.05 * (y_max - y_min)

        fig, ax = plt.subplots(figsize=(10, 8))
        ax.set_xlabel("x")
        ax.set_ylabel("y")
        ax.set_title(f"{title} (Frame 1/{num_frames})")
        ax.set_xlim(x_min - margin_x, x_max + margin_x)
        ax.set_ylim(y_min - margin_y, y_max + margin_y)
        ax.set_aspect("equal", adjustable="box")

        coords_warped_0 = coords_orig.copy()
        coords_warped_0[:, 0] += warp_factors[0] * ux
        coords_warped_0[:, 1] += warp_factors[0] * uy

        tri = Triangulation(coords_warped_0[:, 0], coords_warped_0[:, 1], cells)
        tri_plot = ax.triplot(tri, color="black", linewidth=0.5)
        line = tri_plot[0]

        start_time = time.time()

        def update(frame):
            warp_factor = warp_factors[frame]
            coords_warped = coords_orig.copy()
            coords_warped[:, 0] += warp_factor * ux
            coords_warped[:, 1] += warp_factor * uy

            tri.x[:] = coords_warped[:, 0]
            tri.y[:] = coords_warped[:, 1]

            line.set_data(tri.x, tri.y)
            ax.set_title(f"{title} (Frame {frame+1}/{num_frames})")

            if show_progress and (frame + 1) % max(1, num_frames // 10) == 0:
                elapsed = time.time() - start_time
                print(f"进度: {frame+1}/{num_frames} ({100*(frame+1)/num_frames:.0f}%) - 已用时间: {elapsed:.1f}s")

            return line,

        anim = animation.FuncAnimation(
            fig, update, frames=num_frames,
            interval=interval,
            blit=use_blit,
            repeat=False
        )

        if save_path:
            writer_kwargs = {
                "fps": 1000 // interval,
                "bitrate": 2000,
                "codec": "h264",
                "extra_args": ["-pix_fmt", "yuv420p"]
            }

            try:
                writer = animation.FFMpegWriter(**writer_kwargs)
                print("开始保存动画...")
                anim.save(save_path, writer=writer, dpi=150)
                total_time = time.time() - start_time
                print(f"动画保存完成! 总时间: {total_time:.1f}s")
            except Exception as e:
                warnings.warn(f"FFmpeg 保存失败 ({str(e)}), 使用默认方式保存...")
                anim.save(save_path, dpi=150)

        plt.close(fig)
        return anim

    def plot_summary(self, show=True, save_path=None):
        fig = plt.figure(figsize=(16, 12))

        plt.subplot(2, 3, 1)
        plot(self.mesh, title="Mesh")
        plt.xlabel("x")
        plt.ylabel("y")
        plt.axis("equal")

        plt.subplot(2, 3, 2)
        p = plot(self.simulation.u, mode="displacement", title="Displacement Field")
        plt.colorbar(p, label="Displacement")
        plt.xlabel("x")
        plt.ylabel("y")
        plt.axis("equal")

        plt.subplot(2, 3, 3)
        von_mises = self.simulation.get_von_mises_stress()
        if von_mises:
            p = plot(von_mises, title="Von Mises Stress")
            plt.colorbar(p, label="Stress")
        plt.xlabel("x")
        plt.ylabel("y")
        plt.axis("equal")

        if self.simulation.sigma:
            V_scalar = FunctionSpace(self.mesh, "P", 1)
            plt.subplot(2, 3, 4)
            p = plot(project(self.simulation.sigma[0, 0], V_scalar), title=r"$\sigma_{xx}$")
            plt.colorbar(p)
            plt.xlabel("x")
            plt.ylabel("y")
            plt.axis("equal")

            plt.subplot(2, 3, 5)
            p = plot(project(self.simulation.sigma[1, 1], V_scalar), title=r"$\sigma_{yy}$")
            plt.colorbar(p)
            plt.xlabel("x")
            plt.ylabel("y")
            plt.axis("equal")

            plt.subplot(2, 3, 6)
            p = plot(project(self.simulation.sigma[0, 1], V_scalar), title=r"$\sigma_{xy}$")
            plt.colorbar(p)
            plt.xlabel("x")
            plt.ylabel("y")
            plt.axis("equal")

        plt.tight_layout()
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches="tight")
        if show:
            plt.show()
        else:
            plt.close()

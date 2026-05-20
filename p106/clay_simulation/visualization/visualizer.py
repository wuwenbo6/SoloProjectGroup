import numpy as np
import matplotlib.pyplot as plt
from matplotlib import cm
from matplotlib.animation import FuncAnimation
from typing import Optional, Dict, List, Tuple
import os
try:
    from ..force_simulation import SimulationResult, SimulationConfig
    from ..data_acquisition import ClayParameter
except ImportError:
    from force_simulation import SimulationResult, SimulationConfig
    from data_acquisition import ClayParameter


class ResultVisualizer:
    def __init__(self, figsize: Tuple[int, int] = (12, 10)):
        self.figsize = figsize
        self.fig = None
        self.output_dir = "simulation_output"
        os.makedirs(self.output_dir, exist_ok=True)

    def _get_valid_grid(self, data: np.ndarray):
        ny, nx = data.shape
        x = np.linspace(0, 1, nx)
        y = np.linspace(0, 1, ny)
        X, Y = np.meshgrid(x, y)
        return X, Y, x, y

    def plot_stress_distribution(self, result: SimulationResult,
                                  config: SimulationConfig,
                                  show: bool = True,
                                  save_path: Optional[str] = None) -> None:
        fig, axes = plt.subplots(2, 2, figsize=self.figsize)
        fig.suptitle(f'Stress Distribution - {config.clay_type}', fontsize=14)

        sigmax, sigmay, sigmaxy = result.stress
        von_mises = result.von_mises_stress

        X, Y, x, y = self._get_valid_grid(von_mises)

        im1 = axes[0, 0].pcolormesh(X, Y, sigmax, cmap='jet', shading='auto')
        axes[0, 0].set_title('σₓₓ (Normal Stress X)')
        axes[0, 0].set_xlabel('X Position (m)')
        axes[0, 0].set_ylabel('Y Position (m)')
        axes[0, 0].set_xlim(0, 1)
        axes[0, 0].set_ylim(0, 1)
        fig.colorbar(im1, ax=axes[0, 0], label='Stress (Pa)')

        im2 = axes[0, 1].pcolormesh(X, Y, sigmay, cmap='jet', shading='auto')
        axes[0, 1].set_title('σᵧᵧ (Normal Stress Y)')
        axes[0, 1].set_xlabel('X Position (m)')
        axes[0, 1].set_ylabel('Y Position (m)')
        axes[0, 1].set_xlim(0, 1)
        axes[0, 1].set_ylim(0, 1)
        fig.colorbar(im2, ax=axes[0, 1], label='Stress (Pa)')

        im3 = axes[1, 0].pcolormesh(X, Y, sigmaxy, cmap='jet', shading='auto')
        axes[1, 0].set_title('σₓᵧ (Shear Stress)')
        axes[1, 0].set_xlabel('X Position (m)')
        axes[1, 0].set_ylabel('Y Position (m)')
        axes[1, 0].set_xlim(0, 1)
        axes[1, 0].set_ylim(0, 1)
        fig.colorbar(im3, ax=axes[1, 0], label='Stress (Pa)')

        im4 = axes[1, 1].pcolormesh(X, Y, von_mises, cmap='jet', shading='auto')
        axes[1, 1].set_title('Von Mises Stress')
        axes[1, 1].set_xlabel('X Position (m)')
        axes[1, 1].set_ylabel('Y Position (m)')
        axes[1, 1].set_xlim(0, 1)
        axes[1, 1].set_ylim(0, 1)
        fig.colorbar(im4, ax=axes[1, 1], label='Stress (Pa)')

        plt.tight_layout()

        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')

        if show:
            plt.show()
        else:
            plt.close()

    def plot_strain_distribution(self, result: SimulationResult,
                               config: SimulationConfig,
                               show: bool = True,
                               save_path: Optional[str] = None) -> None:
        fig, axes = plt.subplots(1, 3, figsize=(15, 5))
        fig.suptitle(f'Strain Distribution - {config.clay_type}', fontsize=14)

        ex, ey, exy = result.strain

        nx, ny = ex.shape
        x = np.linspace(0, 1, nx)
        y = np.linspace(0, 1, ny)
        X, Y = np.meshgrid(x, y)

        im1 = axes[0].pcolormesh(X, Y, ex, cmap='RdBu_r', shading='auto')
        axes[0].set_title('εₓₓ')
        axes[0].set_xlabel('X')
        axes[0].set_ylabel('Y')
        fig.colorbar(im1, ax=axes[0])

        im2 = axes[1].pcolormesh(X, Y, ey, cmap='RdBu_r', shading='auto')
        axes[1].set_title('εᵧᵧ')
        axes[1].set_xlabel('X')
        axes[1].set_ylabel('Y')
        fig.colorbar(im2, ax=axes[1])

        im3 = axes[2].pcolormesh(X, Y, exy, cmap='RdBu_r', shading='auto')
        axes[2].set_title('γₓᵧ')
        axes[2].set_xlabel('X')
        axes[2].set_ylabel('Y')
        fig.colorbar(im3, ax=axes[2])

        plt.tight_layout()

        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')

        if show:
            plt.show()
        else:
            plt.close()

    def plot_displacement_field(self, result: SimulationResult,
                                 config: SimulationConfig,
                                 show: bool = True,
                                 save_path: Optional[str] = None) -> None:
        fig, axes = plt.subplots(1, 2, figsize=(12, 5))
        fig.suptitle(f'Displacement Field - {config.clay_type}', fontsize=14)

        u, v = result.displacement
        displacement_magnitude = np.sqrt(u ** 2 + v ** 2)

        nx, ny = u.shape
        x = np.linspace(0, 1, nx)
        y = np.linspace(0, 1, ny)
        X, Y = np.meshgrid(x, y)

        im1 = axes[0].pcolormesh(X, Y, displacement_magnitude, cmap='viridis', shading='auto')
        axes[0].set_title('Displacement Magnitude')
        axes[0].set_xlabel('X')
        axes[0].set_ylabel('Y')
        fig.colorbar(im1, ax=axes[0])

        skip = max(1, nx // 20)
        axes[1].quiver(X[::skip, ::skip], Y[::skip, ::skip],
                       u[::skip, ::skip], v[::skip, ::skip])
        axes[1].set_title('Displacement Vectors')
        axes[1].set_xlabel('X')
        axes[1].set_ylabel('Y')
        axes[1].axis('equal')

        plt.tight_layout()

        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')

        if show:
            plt.show()
        else:
            plt.close()

    def plot_stress_profile(self, result: SimulationResult,
                             axis: str = 'x',
                             position: float = 0.5,
                             show: bool = True,
                             save_path: Optional[str] = None) -> None:
        von_mises = result.von_mises_stress
        ny, nx = von_mises.shape

        position = np.clip(position, 0.0, 1.0)

        fig, ax = plt.subplots(figsize=(10, 6))

        if axis == 'x':
            idx = int(position * (ny - 1))
            idx = np.clip(idx, 0, ny - 1)
            profile = von_mises[idx, :]
            x_axis = np.linspace(0, 1, nx)
            ax.plot(x_axis, profile, 'b-', linewidth=2)
            ax.set_xlabel('X Position (m)')
            ax.set_title(f'Von Mises Stress Profile at Y = {position:.2f}')
        elif axis == 'y':
            idx = int(position * (nx - 1))
            idx = np.clip(idx, 0, nx - 1)
            profile = von_mises[:, idx]
            x_axis = np.linspace(0, 1, ny)
            ax.plot(x_axis, profile, 'r-', linewidth=2)
            ax.set_xlabel('Y Position (m)')
            ax.set_title(f'Von Mises Stress Profile at X = {position:.2f}')
        else:
            raise ValueError(f"Invalid axis: {axis}. Use 'x' or 'y'")

        ax.set_ylabel('Stress (Pa)')
        ax.grid(True, alpha=0.3)
        ax.legend(['Von Mises Stress'])
        ax.set_xlim(0, 1)

        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')

        if show:
            plt.show()
        else:
            plt.close()

    def plot_moisture_effect(self, moisture_data: Dict,
                              show: bool = True,
                              save_path: Optional[str] = None) -> None:
        fig, axes = plt.subplots(1, 3, figsize=(15, 5))

        axes[0].plot(moisture_data['moistures'], moisture_data['youngs_modulus'], 'b-o', linewidth=2)
        axes[0].set_xlabel('Moisture Content')
        axes[0].set_ylabel("Young's Modulus (Pa)")
        axes[0].set_title('Young Modulus vs Moisture')
        axes[0].grid(True, alpha=0.3)

        axes[1].plot(moisture_data['moistures'], moisture_data['yield_strength'], 'r-s', linewidth=2)
        axes[1].set_xlabel('Moisture Content')
        axes[1].set_ylabel('Yield Strength (Pa)')
        axes[1].set_title('Yield Strength vs Moisture')
        axes[1].grid(True, alpha=0.3)

        axes[2].plot(moisture_data['moistures'], moisture_data['max_stress'], 'g-^', linewidth=2)
        axes[2].set_xlabel('Moisture Content')
        axes[2].set_ylabel('Max Von Mises Stress (Pa)')
        axes[2].set_title('Max Stress vs Moisture')
        axes[2].grid(True, alpha=0.3)

        plt.tight_layout()

        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')

        if show:
            plt.show()
        else:
            plt.close()

    def plot_force_direction_effect(self, direction_data: Dict,
                                     show: bool = True,
                                     save_path: Optional[str] = None) -> None:
        fig, axes = plt.subplots(1, 2, figsize=(12, 5))

        axes[0].plot(direction_data['angles'], direction_data['max_stress'], 'b-o', linewidth=2)
        axes[0].set_xlabel('Force Angle (degrees)')
        axes[0].set_ylabel('Max Von Mises Stress (Pa)')
        axes[0].set_title('Max Stress vs Force Direction')
        axes[0].grid(True, alpha=0.3)

        axes[1].plot(direction_data['angles'], direction_data['max_deformation'], 'r-s', linewidth=2)
        axes[1].set_xlabel('Force Angle (degrees)')
        axes[1].set_ylabel('Max Deformation')
        axes[1].set_title('Deformation vs Force Direction')
        axes[1].grid(True, alpha=0.3)

        plt.tight_layout()

        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')

        if show:
            plt.show()
        else:
            plt.close()

    def animate_deformation(self, result: SimulationResult,
                             config: SimulationConfig,
                             show: bool = True,
                             save_path: Optional[str] = None) -> None:
        if result.deformation_history is None:
            print("No deformation history available for animation")
            return

        fig, ax = plt.subplots(figsize=(8, 6))
        history = result.deformation_history

        nx, ny = history.shape[2], history.shape[3]
        x = np.linspace(0, 1, nx)
        y = np.linspace(0, 1, ny)
        X, Y = np.meshgrid(x, y)

        von_mises_initial = np.sqrt(history[0, 0] ** 2 + history[0, 1] ** 2)
        im = ax.pcolormesh(X, Y, von_mises_initial, cmap='jet', shading='auto')
        plt.colorbar(im, ax=ax)
        ax.set_title('Deformation Animation')
        ax.set_xlabel('X')
        ax.set_ylabel('Y')

        def update(frame):
            deformation = np.sqrt(history[frame, 0] ** 2 + history[frame, 1] ** 2)
            im.set_array(deformation.ravel())
            ax.set_title(f'Deformation - Time Step {frame}')
            return im,

        anim = FuncAnimation(fig, update, frames=history.shape[0],
                           interval=50, blit=True)

        if save_path:
            if save_path.endswith('.gif'):
                anim.save(save_path, writer='pillow', fps=20)
            else:
                anim.save(save_path, writer='ffmpeg', fps=20)

        if show:
            plt.show()
        else:
            plt.close()

    def plot_summary_statistics(self, stats: Dict,
                                 clay_param: ClayParameter,
                                 show: bool = True,
                                 save_path: Optional[str] = None) -> None:
        fig, ax = plt.subplots(figsize=(10, 6))

        labels = ['Max\nStress', 'Min\nStress', 'Mean\nStress', 'Std\nStress',
                  'Max\nDisplacement', 'Max\nShear\nStress', 'Safety\nFactor']
        values = [
            stats['max_von_mises_stress'],
            stats['min_von_mises_stress'],
            stats['mean_von_mises_stress'],
            stats['std_von_mises_stress'],
            stats['max_displacement'],
            stats['max_shear_stress'],
            stats['safety_factor']
        ]

        colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4',
                  '#ffeaa7', '#dfe6e9', '#fd79a8']

        bars = ax.bar(labels, values, color=colors)
        ax.set_title(f'Simulation Summary Statistics - {clay_param.name}', fontsize=14)
        ax.set_ylabel('Value')
        ax.grid(True, alpha=0.3, axis='y')
        plt.xticks(rotation=45)

        for bar, val in zip(bars, values):
            height = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2., height,
                    f'{val:.2e}', ha='center', va='bottom', fontsize=9)

        plt.tight_layout()

        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')

        if show:
            plt.show()
        else:
            plt.close()

    def generate_comparative_report(self, results_list: List[SimulationResult],
                                  configs_list: List[SimulationConfig],
                                  clay_names: List[str],
                                  show: bool = True,
                                  save_path: Optional[str] = None) -> None:
        fig, axes = plt.subplots(1, 2, figsize=(14, 6))

        max_stresses = [np.max(r.von_mises_stress) for r in results_list]
        max_displacements = [np.max(np.sqrt(r.displacement[0] ** 2 + r.displacement[1] ** 2)) for r in results_list]

        x = np.arange(len(clay_names))
        width = 0.35

        bars1 = axes[0].bar(x - width/2, max_stresses, width, label='Max Stress', color='#3498db')
        axes[0].set_ylabel('Stress (Pa)')
        axes[0].set_title('Maximum Von Mises Stress Comparison')
        axes[0].set_xticks(x)
        axes[0].set_xticklabels(clay_names, rotation=45)
        axes[0].legend()
        axes[0].grid(True, alpha=0.3, axis='y')

        bars2 = axes[1].bar(x - width/2, max_displacements, width, label='Max Displacement', color='#e74c3c')
        axes[1].set_ylabel('Displacement')
        axes[1].set_title('Maximum Displacement Comparison')
        axes[1].set_xticks(x)
        axes[1].set_xticklabels(clay_names, rotation=45)
        axes[1].legend()
        axes[1].grid(True, alpha=0.3, axis='y')

        for bars in [bars1, bars2]:
            for bar in bars:
                height = bar.get_height()
                axes[list([bars1, bars2]).index(bars)].text(
                    bar.get_x() + bar.get_width()/2., height,
                    f'{height:.2e}', ha='center', va='bottom', fontsize=8)

        plt.tight_layout()

        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')

        if show:
            plt.show()
        else:
            plt.close()

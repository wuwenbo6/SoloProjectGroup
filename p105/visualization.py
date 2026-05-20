import numpy as np
import matplotlib.pyplot as plt
from matplotlib import rcParams
import os
from typing import Optional, Dict

rcParams['font.sans-serif'] = ['SimHei', 'DejaVu Sans']
rcParams['axes.unicode_minus'] = False


class DryingVisualizer:
    def __init__(self, output_dir: str = 'results'):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        plt.style.use('seaborn-v0_8-whitegrid')

    def plot_drying_curve(self, time: np.ndarray, moisture: np.ndarray,
                          title: str = "干燥曲线", filename: Optional[str] = None,
                          show: bool = False) -> str:
        fig, ax = plt.subplots(figsize=(10, 6))

        time_hours = time / 3600
        moisture_percent = moisture * 100

        ax.plot(time_hours, moisture_percent, 'b-', linewidth=2)
        ax.set_xlabel('时间 (小时)', fontsize=12)
        ax.set_ylabel('含水率 (%)', fontsize=12)
        ax.set_title(title, fontsize=14, fontweight='bold')
        ax.grid(True, alpha=0.3)

        ax.annotate(f'初始: {moisture_percent[0]:.1f}%',
                    xy=(0, moisture_percent[0]),
                    xytext=(10, 10), textcoords='offset points')
        ax.annotate(f'最终: {moisture_percent[-1]:.1f}%',
                    xy=(time_hours[-1], moisture_percent[-1]),
                    xytext=(-70, 10), textcoords='offset points')

        plt.tight_layout()

        if filename is None:
            filename = 'drying_curve.png'
        filepath = os.path.join(self.output_dir, filename)
        plt.savefig(filepath, dpi=300, bbox_inches='tight')

        if show:
            plt.show()
        plt.close()

        return filepath

    def plot_temperature_curve(self, time: np.ndarray, temperature: np.ndarray,
                               title: str = "温度变化曲线", filename: Optional[str] = None,
                               show: bool = False) -> str:
        fig, ax = plt.subplots(figsize=(10, 6))

        time_hours = time / 3600

        ax.plot(time_hours, temperature, 'r-', linewidth=2)
        ax.set_xlabel('时间 (小时)', fontsize=12)
        ax.set_ylabel('温度 (°C)', fontsize=12)
        ax.set_title(title, fontsize=14, fontweight='bold')
        ax.grid(True, alpha=0.3)

        plt.tight_layout()

        if filename is None:
            filename = 'temperature_curve.png'
        filepath = os.path.join(self.output_dir, filename)
        plt.savefig(filepath, dpi=300, bbox_inches='tight')

        if show:
            plt.show()
        plt.close()

        return filepath

    def plot_drying_rate(self, time: np.ndarray, drying_rate: np.ndarray,
                         title: str = "干燥速率曲线", filename: Optional[str] = None,
                         show: bool = False) -> str:
        fig, ax = plt.subplots(figsize=(10, 6))

        time_hours = time / 3600

        ax.plot(time_hours, drying_rate * 3600, 'g-', linewidth=2)
        ax.set_xlabel('时间 (小时)', fontsize=12)
        ax.set_ylabel('干燥速率 (1/h)', fontsize=12)
        ax.set_title(title, fontsize=14, fontweight='bold')
        ax.grid(True, alpha=0.3)

        max_rate_idx = np.argmax(drying_rate)
        ax.annotate(f'最大: {drying_rate[max_rate_idx] * 3600:.4f} 1/h',
                    xy=(time_hours[max_rate_idx], drying_rate[max_rate_idx] * 3600),
                    xytext=(10, 10), textcoords='offset points')

        plt.tight_layout()

        if filename is None:
            filename = 'drying_rate.png'
        filepath = os.path.join(self.output_dir, filename)
        plt.savefig(filepath, dpi=300, bbox_inches='tight')

        if show:
            plt.show()
        plt.close()

        return filepath

    def plot_moisture_profile(self, x: np.ndarray, moisture_history: np.ndarray,
                              time_indices: list, time_array: Optional[np.ndarray] = None,
                              title: str = "含水率分布",
                              filename: Optional[str] = None, show: bool = False) -> str:
        fig, ax = plt.subplots(figsize=(10, 6))

        x_mm = x * 1000

        valid_indices = [idx for idx in time_indices if 0 <= idx < len(moisture_history)]
        colors = plt.cm.viridis(np.linspace(0, 1, max(len(valid_indices), 1)))

        for i, idx in enumerate(valid_indices):
            moisture = moisture_history[idx] * 100
            if time_array is not None:
                time_hours = time_array[idx] / 3600
                if time_hours >= 1.0:
                    label = f't = {time_hours:.1f} h'
                else:
                    label = f't = {time_hours * 60:.0f} min'
            else:
                label = f't = {idx}'

            color = colors[i] if len(valid_indices) > 1 else colors[0]
            ax.plot(x_mm, moisture, color=color, linewidth=2, label=label)

        ax.set_xlabel('位置 (mm)', fontsize=12)
        ax.set_ylabel('含水率 (%)', fontsize=12)
        ax.set_title(title, fontsize=14, fontweight='bold')
        if valid_indices:
            ax.legend(loc='best', framealpha=0.9)
        ax.grid(True, alpha=0.3)

        plt.tight_layout()

        if filename is None:
            filename = 'moisture_profile.png'
        filepath = os.path.join(self.output_dir, filename)
        plt.savefig(filepath, dpi=300, bbox_inches='tight')

        if show:
            plt.show()
        plt.close()

        return filepath

    def plot_temperature_profile(self, x: np.ndarray, temp_history: np.ndarray,
                                 time_indices: list, time_array: Optional[np.ndarray] = None,
                                 title: str = "温度分布",
                                 filename: Optional[str] = None, show: bool = False) -> str:
        fig, ax = plt.subplots(figsize=(10, 6))

        x_mm = x * 1000

        valid_indices = [idx for idx in time_indices if 0 <= idx < len(temp_history)]
        colors = plt.cm.plasma(np.linspace(0, 1, max(len(valid_indices), 1)))

        for i, idx in enumerate(valid_indices):
            temp = temp_history[idx]
            if time_array is not None:
                time_hours = time_array[idx] / 3600
                if time_hours >= 1.0:
                    label = f't = {time_hours:.1f} h'
                else:
                    label = f't = {time_hours * 60:.0f} min'
            else:
                label = f't = {idx}'

            color = colors[i] if len(valid_indices) > 1 else colors[0]
            ax.plot(x_mm, temp, color=color, linewidth=2, label=label)

        ax.set_xlabel('位置 (mm)', fontsize=12)
        ax.set_ylabel('温度 (°C)', fontsize=12)
        ax.set_title(title, fontsize=14, fontweight='bold')
        if valid_indices:
            ax.legend(loc='best', framealpha=0.9)
        ax.grid(True, alpha=0.3)

        plt.tight_layout()

        if filename is None:
            filename = 'temperature_profile.png'
        filepath = os.path.join(self.output_dir, filename)
        plt.savefig(filepath, dpi=300, bbox_inches='tight')

        if show:
            plt.show()
        plt.close()

        return filepath

    def plot_combined_results(self, simulation_results: Dict,
                              filename: Optional[str] = None, show: bool = False) -> str:
        fig, axes = plt.subplots(2, 2, figsize=(14, 10))

        time = simulation_results['time']
        moisture_history = simulation_results['moisture_history']
        temp_history = simulation_results['temperature_history']
        drying_rate = simulation_results['drying_rate']
        x = simulation_results['x_coordinates']

        time_hours = time / 3600
        avg_moisture = np.mean(moisture_history, axis=1) * 100
        avg_temp = np.mean(temp_history, axis=1)

        ax = axes[0, 0]
        ax.plot(time_hours, avg_moisture, 'b-', linewidth=2)
        ax.set_xlabel('时间 (小时)')
        ax.set_ylabel('平均含水率 (%)')
        ax.set_title('干燥曲线')
        ax.grid(True, alpha=0.3)

        ax = axes[0, 1]
        ax.plot(time_hours, avg_temp, 'r-', linewidth=2)
        ax.set_xlabel('时间 (小时)')
        ax.set_ylabel('平均温度 (°C)')
        ax.set_title('温度变化曲线')
        ax.grid(True, alpha=0.3)

        ax = axes[1, 0]
        ax.plot(time_hours, drying_rate * 3600, 'g-', linewidth=2)
        ax.set_xlabel('时间 (小时)')
        ax.set_ylabel('干燥速率 (1/h)')
        ax.set_title('干燥速率曲线')
        ax.grid(True, alpha=0.3)

        ax = axes[1, 1]
        x_mm = x * 1000
        time_indices = [0, len(time) // 4, len(time) // 2, 3 * len(time) // 4, len(time) - 1]
        colors = plt.cm.viridis(np.linspace(0, 1, len(time_indices)))

        for i, idx in enumerate(time_indices):
            moisture = moisture_history[idx] * 100
            ax.plot(x_mm, moisture, color=colors[i], linewidth=2,
                    label=f't = {time[idx] / 3600:.1f} h')

        ax.set_xlabel('位置 (mm)')
        ax.set_ylabel('含水率 (%)')
        ax.set_title('含水率分布')
        ax.legend(loc='best', fontsize=8, framealpha=0.9)
        ax.grid(True, alpha=0.3)

        plt.suptitle('漆器干燥过程仿真结果', fontsize=16, fontweight='bold')
        plt.tight_layout()

        if filename is None:
            filename = 'combined_results.png'
        filepath = os.path.join(self.output_dir, filename)
        plt.savefig(filepath, dpi=300, bbox_inches='tight')

        if show:
            plt.show()
        plt.close()

        return filepath

    def plot_moisture_heatmap(self, time: np.ndarray, x: np.ndarray,
                              moisture_history: np.ndarray,
                              title: str = "含水率时空分布",
                              filename: Optional[str] = None, show: bool = False) -> str:
        fig, ax = plt.subplots(figsize=(12, 6))

        time_hours = time / 3600
        x_mm = x * 1000

        moisture_percent = moisture_history.T * 100

        im = ax.pcolormesh(time_hours, x_mm, moisture_percent,
                          cmap='viridis', shading='auto')

        cbar = plt.colorbar(im, ax=ax)
        cbar.set_label('含水率 (%)', fontsize=12)

        ax.set_xlabel('时间 (小时)', fontsize=12)
        ax.set_ylabel('位置 (mm)', fontsize=12)
        ax.set_title(title, fontsize=14, fontweight='bold')

        plt.tight_layout()

        if filename is None:
            filename = 'moisture_heatmap.png'
        filepath = os.path.join(self.output_dir, filename)
        plt.savefig(filepath, dpi=300, bbox_inches='tight')

        if show:
            plt.show()
        plt.close()

        return filepath

    def generate_all_plots(self, simulation_results: Dict, prefix: str = '') -> Dict[str, str]:
        output_files = {}

        time = simulation_results['time']
        moisture_history = simulation_results['moisture_history']
        temp_history = simulation_results['temperature_history']
        drying_rate = simulation_results['drying_rate']
        x = simulation_results['x_coordinates']

        avg_moisture = np.mean(moisture_history, axis=1)
        avg_temp = np.mean(temp_history, axis=1)

        output_files['drying_curve'] = self.plot_drying_curve(
            time, avg_moisture, filename=f'{prefix}drying_curve.png')

        output_files['temperature_curve'] = self.plot_temperature_curve(
            time, avg_temp, filename=f'{prefix}temperature_curve.png')

        output_files['drying_rate'] = self.plot_drying_rate(
            time, drying_rate, filename=f'{prefix}drying_rate.png')

        time_indices = [0, len(time) // 4, len(time) // 2, 3 * len(time) // 4, len(time) - 1]
        output_files['moisture_profile'] = self.plot_moisture_profile(
            x, moisture_history, time_indices, time_array=time,
            filename=f'{prefix}moisture_profile.png')

        output_files['temperature_profile'] = self.plot_temperature_profile(
            x, temp_history, time_indices, time_array=time,
            filename=f'{prefix}temperature_profile.png')

        output_files['combined'] = self.plot_combined_results(
            simulation_results, filename=f'{prefix}combined_results.png')

        output_files['moisture_heatmap'] = self.plot_moisture_heatmap(
            time, x, moisture_history, filename=f'{prefix}moisture_heatmap.png')

        return output_files

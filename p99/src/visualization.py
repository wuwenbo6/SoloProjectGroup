import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import cm
from typing import Optional, List, Dict


class ResultVisualizer:
    def __init__(self, results: Optional[Dict] = None):
        self.results = results
        self.figures = {}
        plt.rcParams['font.sans-serif'] = ['SimHei', 'DejaVu Sans']
        plt.rcParams['axes.unicode_minus'] = False

    def set_results(self, results: Dict):
        self.results = results

    def _check_results(self):
        if self.results is None:
            raise ValueError("未设置结果数据，请先调用set_results()")

    def plot_temperature(self, save_path: Optional[str] = None,
                          show_kiln: bool = True):
        self._check_results()

        time = self.results['time'] / 3600
        temp = self.results['temperature']
        pos = self.results['position']

        fig, ax = plt.subplots(figsize=(12, 6))

        idx_surface = 0
        idx_center = len(pos) // 2
        idx_mid = len(pos) // 4

        lines = []
        labels = []

        l, = ax.plot(time, temp[:, idx_surface] - 273.15,
                     linewidth=2, color='red')
        lines.append(l)
        labels.append(f'表面 (x={pos[idx_surface]:.3f}m)')

        if idx_mid != idx_surface and idx_mid != idx_center:
            l, = ax.plot(time, temp[:, idx_mid] - 273.15,
                         linewidth=2, color='orange')
            lines.append(l)
            labels.append(f'1/4处 (x={pos[idx_mid]:.3f}m)')

        l, = ax.plot(time, temp[:, idx_center] - 273.15,
                     linewidth=2, color='blue')
        lines.append(l)
        labels.append(f'中心 (x={pos[idx_center]:.3f}m)')

        if show_kiln and 'kiln_temperature' in self.results:
            l, = ax.plot(time, self.results['kiln_temperature'] - 273.15,
                         linewidth=2, color='green', linestyle='--')
            lines.append(l)
            labels.append('窑温设定')

        ax.set_xlabel('时间 (小时)', fontsize=12)
        ax.set_ylabel('温度 (°C)', fontsize=12)
        ax.set_title('陶瓷烧制温度变化曲线', fontsize=14, fontweight='bold')
        ax.legend(lines, labels, fontsize=10, loc='best')
        ax.grid(True, alpha=0.3)

        self.figures['temperature'] = fig

        if save_path:
            fig.savefig(save_path, dpi=300, bbox_inches='tight')
            plt.close(fig)

        return fig

    def plot_temperature_heatmap(self, save_path: Optional[str] = None):
        self._check_results()

        time = self.results['time'] / 3600
        temp = self.results['temperature'] - 273.15
        pos = self.results['position']

        fig, ax = plt.subplots(figsize=(12, 6))

        T, X = np.meshgrid(time, pos)
        im = ax.pcolormesh(T, X, temp.T, cmap=cm.jet, shading='auto')

        cbar = fig.colorbar(im, ax=ax)
        cbar.set_label('温度 (°C)', fontsize=12)

        ax.set_xlabel('时间 (小时)', fontsize=12)
        ax.set_ylabel('位置 (m)', fontsize=12)
        ax.set_title('陶瓷烧制温度分布热图', fontsize=14, fontweight='bold')

        self.figures['temperature_heatmap'] = fig

        if save_path:
            fig.savefig(save_path, dpi=300, bbox_inches='tight')
            plt.close(fig)

        return fig

    def plot_humidity(self, save_path: Optional[str] = None):
        self._check_results()

        if 'relative_humidity' not in self.results:
            raise KeyError("结果中不包含湿度数据")

        time = self.results['time'] / 3600

        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 8))

        ax1.plot(time, self.results['relative_humidity'],
                 linewidth=2, color='blue')
        ax1.set_xlabel('时间 (小时)', fontsize=12)
        ax1.set_ylabel('相对湿度 (%)', fontsize=12)
        ax1.set_title('窑内相对湿度变化', fontsize=14, fontweight='bold')
        ax1.grid(True, alpha=0.3)

        ax2.plot(time, self.results['absolute_humidity'] * 1000,
                 linewidth=2, color='green')
        ax2.set_xlabel('时间 (小时)', fontsize=12)
        ax2.set_ylabel('绝对湿度 (g/kg)', fontsize=12)
        ax2.set_title('窑内绝对湿度变化', fontsize=14, fontweight='bold')
        ax2.grid(True, alpha=0.3)

        plt.tight_layout()

        self.figures['humidity'] = fig

        if save_path:
            fig.savefig(save_path, dpi=300, bbox_inches='tight')
            plt.close(fig)

        return fig

    def plot_atmosphere(self, save_path: Optional[str] = None):
        self._check_results()

        time = self.results['time'] / 3600

        has_oxygen = 'oxygen_content' in self.results
        has_co2 = 'co2_production' in self.results

        if not has_oxygen and not has_co2:
            return None

        fig, axes = plt.subplots(
            sum([has_oxygen, has_co2]), 1, figsize=(12, 4 * sum([has_oxygen, has_co2]))
        )
        
        if sum([has_oxygen, has_co2]) == 1:
            axes = [axes]

        ax_idx = 0

        if has_oxygen:
            ax = axes[ax_idx]
            ax.plot(time, self.results['oxygen_content'] * 100,
                    linewidth=2, color='red')
            ax.set_xlabel('时间 (小时)', fontsize=12)
            ax.set_ylabel('氧气含量 (%)', fontsize=12)
            ax.set_title('窑内氧气含量变化', fontsize=14, fontweight='bold')
            ax.grid(True, alpha=0.3)
            ax_idx += 1

        if has_co2:
            ax = axes[ax_idx]
            ax.plot(time, self.results['co2_production'] * 1000,
                    linewidth=2, color='purple')
            ax.set_xlabel('时间 (小时)', fontsize=12)
            ax.set_ylabel('CO2产生速率 (mg/s)', fontsize=12)
            ax.set_title('CO2产生速率变化', fontsize=14, fontweight='bold')
            ax.grid(True, alpha=0.3)

        plt.tight_layout()

        self.figures['atmosphere'] = fig

        if save_path:
            fig.savefig(save_path, dpi=300, bbox_inches='tight')
            plt.close(fig)

        return fig

    def plot_physical_changes(self, save_path: Optional[str] = None):
        self._check_results()

        time = self.results['time'] / 3600

        has_water = 'water_remaining' in self.results
        has_organic = 'organic_remaining' in self.results
        has_shrinkage = 'shrinkage' in self.results

        num_plots = sum([has_water or has_organic, has_shrinkage])
        if num_plots == 0:
            return None

        fig, axes = plt.subplots(num_plots, 1, figsize=(12, 4 * num_plots))
        if num_plots == 1:
            axes = [axes]

        ax_idx = 0

        if has_water or has_organic:
            ax = axes[ax_idx]
            lines = []
            labels = []

            if has_water:
                l, = ax.plot(time, self.results['water_remaining'] * 100,
                             linewidth=2, color='blue')
                lines.append(l)
                labels.append('水分')
            if has_organic:
                l, = ax.plot(time, self.results['organic_remaining'] * 100,
                             linewidth=2, color='brown')
                lines.append(l)
                labels.append('有机物')

            ax.set_xlabel('时间 (小时)', fontsize=12)
            ax.set_ylabel('剩余含量 (%)', fontsize=12)
            ax.set_title('水分与有机物排出过程', fontsize=14, fontweight='bold')
            if lines:
                ax.legend(lines, labels, fontsize=10, loc='best')
            ax.grid(True, alpha=0.3)
            ax_idx += 1

        if has_shrinkage:
            ax = axes[ax_idx]
            idx_center = self.results['shrinkage'].shape[1] // 2
            shrinkage_pct = (self.results['shrinkage'][:, idx_center] - 1) * 100
            ax.plot(time, shrinkage_pct, linewidth=2, color='red')
            ax.set_xlabel('时间 (小时)', fontsize=12)
            ax.set_ylabel('收缩率 (%)', fontsize=12)
            ax.set_title('陶瓷热收缩变化', fontsize=14, fontweight='bold')
            ax.grid(True, alpha=0.3)

        plt.tight_layout()

        self.figures['physical'] = fig

        if save_path:
            fig.savefig(save_path, dpi=300, bbox_inches='tight')
            plt.close(fig)

        return fig

    def plot_comparison(self, sensor_data: Dict,
                         save_path: Optional[str] = None):
        self._check_results()

        if 'kiln_temperature' not in self.results or 'temperature' not in sensor_data:
            return None

        time_sim = self.results['time'] / 3600
        temp_sim = self.results['kiln_temperature'] - 273.15

        time_sensor = sensor_data['time'] / 3600
        temp_sensor = sensor_data['temperature'] - 273.15

        fig, ax = plt.subplots(figsize=(12, 6))

        lines = []
        labels = []

        l, = ax.plot(time_sim, temp_sim, linewidth=2, color='blue')
        lines.append(l)
        labels.append('仿真设定')

        l, = ax.plot(time_sensor, temp_sensor, linewidth=2, color='red', alpha=0.7)
        lines.append(l)
        labels.append('实测数据')

        ax.set_xlabel('时间 (小时)', fontsize=12)
        ax.set_ylabel('温度 (°C)', fontsize=12)
        ax.set_title('仿真与实测温度对比', fontsize=14, fontweight='bold')
        ax.legend(lines, labels, fontsize=10, loc='best')
        ax.grid(True, alpha=0.3)

        self.figures['comparison'] = fig

        if save_path:
            fig.savefig(save_path, dpi=300, bbox_inches='tight')
            plt.close(fig)

        return fig

    def generate_all_plots(self, output_dir: str = 'results'):
        import os
        os.makedirs(output_dir, exist_ok=True)

        plots = {
            'temperature': self.plot_temperature,
            'temperature_heatmap': self.plot_temperature_heatmap,
            'humidity': self.plot_humidity,
            'atmosphere': self.plot_atmosphere,
            'physical': self.plot_physical_changes
        }

        paths = {}
        for name, plot_func in plots.items():
            try:
                path = os.path.join(output_dir, f'{name}.png')
                result = plot_func(save_path=path)
                if result is not None:
                    paths[name] = path
            except Exception as e:
                print(f"生成{name}图表时出错: {e}")

        return paths

    def close_all(self):
        for fig in self.figures.values():
            plt.close(fig)
        self.figures.clear()
